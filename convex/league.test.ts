/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { formatInviteCode, inviteCodePattern, leagueTeamSize, teamCodePattern } from "../src/lib/league-team";

const modules = import.meta.glob("./**/*.ts");
const hour = 3600000;

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
type Test = ReturnType<typeof setup>;
async function account(t: Test, email: string, { onboarded = true, deactivated = false } = {}) {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name: email.split("@")[0], email, emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: Date.now() + 7 * 24 * hour, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  await t.run((ctx) => ctx.db.insert("memberProfiles", {
    ownerId: user._id, fullName: `Nama ${email.split("@")[0]}`, campus: "IPB University", studyProgram: "Ilmu Komputer",
    nextStep: onboarded ? 4 : 2, revision: 1, updatedAt: Date.now(), memberType: "member",
    ...(onboarded ? { completedAt: Date.now() } : {}), ...(deactivated ? { deactivatedAt: Date.now() } : {}),
  }));
  return Object.assign(t.withIdentity({ subject: user._id, sessionId: session._id, email }), { id: user._id as string });
}
type Account = Awaited<ReturnType<typeof account>>;
const teamOf = async (caller: Account) => {
  const result = await caller.query(api.league.mine, {});
  if (!result.eligible || !result.team) throw new Error("no team");
  return result.team;
};
const rowsOf = (t: Test, teamId: Id<"leagueTeams">) => t.run((ctx) => ctx.db.query("leagueTeamMembers").withIndex("by_team", (q) => q.eq("teamId", teamId)).collect());

beforeEach(() => vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com"));
afterEach(() => vi.unstubAllEnvs());

async function world() {
  const t = setup();
  const captain = await account(t, "kapten@example.com");
  const teamId = await captain.mutation(api.league.create, { name: "  Tim   Hujan ", track: "software" });
  const { inviteCode } = await teamOf(captain);
  return { t, captain, teamId, code: inviteCode! };
}

describe("league teams", () => {
  it("creates a team with the creator as captain, a team code for staff and an invite code only the captain sees", async () => {
    const { t, captain, teamId, code } = await world();
    const team = await t.run((ctx) => ctx.db.get(teamId));
    expect(team).toMatchObject({ name: "Tim Hujan", track: "software", captainId: captain.id, season: "2026/27" });
    expect(team!.code).toMatch(teamCodePattern);
    expect(code).toMatch(inviteCodePattern);
    expect(await teamOf(captain)).toMatchObject({ captain: true, standing: "forming", members: [{ name: "Nama kapten", captain: true, you: true }] });

    const member = await account(t, "anggota@example.com");
    expect(await member.query(api.league.invite, { code })).toMatchObject({ name: "Tim Hujan", trackName: "Software Development", captain: "Nama kapten", members: 1, full: false, joined: false });
    // A code typed in lower case with its dash opens the same team.
    await member.mutation(api.league.join, { code: formatInviteCode(code).toLowerCase() });
    expect(await teamOf(member)).toMatchObject({ captain: false, inviteCode: null, standing: "complete" });
    // Participants never receive the team code, which is for staff and judges only.
    for (const sent of [await teamOf(captain), await teamOf(member), await member.query(api.league.invite, { code })]) {
      expect(sent).not.toHaveProperty("code");
      expect(JSON.stringify(sent)).not.toContain(team!.code);
    }
    // Joining twice changes nothing.
    await member.mutation(api.league.join, { code });
    expect(await rowsOf(t, teamId)).toHaveLength(2);
  });

  it("takes only active, onboarded members", async () => {
    const { t, code } = await world();
    const guest = await account(t, "baru@example.com", { onboarded: false });
    const off = await account(t, "nonaktif@example.com", { deactivated: true });
    expect(await guest.query(api.league.mine, {})).toEqual({ eligible: false, reason: "onboarding" });
    expect(await off.query(api.league.mine, {})).toEqual({ eligible: false, reason: "deactivated" });
    expect(await t.query(api.league.mine, {})).toEqual({ eligible: false, reason: "signedOut" });
    await expect(guest.mutation(api.league.create, { name: "Tim Lain", track: "uiux" })).rejects.toThrow("Selesaikan perkenalan");
    await expect(guest.mutation(api.league.join, { code })).rejects.toThrow("Selesaikan perkenalan");
    await expect(off.mutation(api.league.join, { code })).rejects.toThrow("dinonaktifkan");
    await expect(t.mutation(api.league.join, { code })).rejects.toThrow("Masuk kembali");
  });

  it("keeps a member in one team per season and team names unique", async () => {
    const { t, code } = await world();
    const other = await account(t, "lain@example.com");
    await expect(other.mutation(api.league.create, { name: "tim hujan", track: "business" })).rejects.toThrow("sudah dipakai");
    await other.mutation(api.league.create, { name: "Tim Lain", track: "business" });
    await expect(other.mutation(api.league.join, { code })).rejects.toThrow("sudah punya tim");
    await expect(other.mutation(api.league.create, { name: "Tim Ketiga", track: "business" })).rejects.toThrow("sudah punya tim");
    expect(await other.query(api.league.invite, { code })).toMatchObject({ otherTeam: "Tim Lain", joined: false });
  });

  it(`stops at ${leagueTeamSize.max} members, and two joins racing for the last place cannot both get in`, async () => {
    const { t, teamId, code } = await world();
    for (let i = 1; i < leagueTeamSize.max - 1; i++) await (await account(t, `a${i}@example.com`)).mutation(api.league.join, { code });
    expect(await rowsOf(t, teamId)).toHaveLength(leagueTeamSize.max - 1);
    const [first, second] = [await account(t, "cepat@example.com"), await account(t, "lambat@example.com")];
    const results = await Promise.allSettled([first.mutation(api.league.join, { code }), second.mutation(api.league.join, { code })]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(String((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason)).toContain("sudah penuh");
    expect(await rowsOf(t, teamId)).toHaveLength(leagueTeamSize.max);
    expect(await (await account(t, "telat@example.com")).query(api.league.invite, { code })).toMatchObject({ full: true });
  });

  it("refuses an old or wrong invite code once the captain replaces it, and takes the new one in a link", async () => {
    const { t, captain, code } = await world();
    const fresh = await captain.mutation(api.league.rotateInvite, {});
    expect(fresh).not.toBe(code);
    const member = await account(t, "anggota@example.com");
    expect(await member.query(api.league.invite, { code })).toBeNull();
    expect(await member.query(api.league.invite, { code: "not a code" })).toBeNull();
    expect(await member.query(api.league.invite, { code: "abcdefghijABCDEFGHIJ_-" })).toBeNull();
    await expect(member.mutation(api.league.join, { code })).rejects.toThrow("tidak berlaku");
    await member.mutation(api.league.join, { code: `https://league.gdgocipb.com/daftar?undangan=${fresh}` });
    await expect(member.mutation(api.league.rotateInvite, {})).rejects.toThrow("Hanya kapten");
  });

  it("replaces the invite code with one that no other team holds", async () => {
    const { t, code } = await world();
    const other = await account(t, "lain@example.com");
    await other.mutation(api.league.create, { name: "Tim Lain", track: "uiux" });
    // The first draw repeats the other team's code, so the rotation draws again.
    const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    const draws = [code, "ABCD2345"];
    const random = vi.spyOn(crypto, "getRandomValues").mockImplementation(((array: Uint8Array) => {
      array.set([...draws.shift()!].map((char) => alphabet.indexOf(char)));
      return array;
    }) as typeof crypto.getRandomValues);
    expect(await other.mutation(api.league.rotateInvite, {})).toBe("ABCD2345");
    expect(random).toHaveBeenCalledTimes(2);
    random.mockRestore();
  });

  it("gives teams from before invite codes a fresh one once, and their old links stop working", async () => {
    const { t, captain, teamId } = await world();
    const old = "abcdefghijABCDEFGHIJ_-";
    await t.run((ctx) => ctx.db.patch(teamId, { inviteToken: old }));
    // Between the release and the migration, the captain has no code to share, and the old link opens nothing.
    expect(await teamOf(captain)).toMatchObject({ captain: true, inviteCode: null });
    const member = await account(t, "anggota@example.com");
    expect(await member.query(api.league.invite, { code: `https://league.gdgocipb.com/daftar?undangan=${old}` })).toBeNull();
    // A captain who makes a code in that gap keeps it.
    const early = await account(t, "awal@example.com");
    const earlyId = await early.mutation(api.league.create, { name: "Tim Awal", track: "uiux" });
    await t.run((ctx) => ctx.db.patch(earlyId, { inviteToken: "zyxwvutsrqZYXWVUTSRQ-_" }));
    const made = await early.mutation(api.league.rotateInvite, {});

    expect(await t.mutation(internal.league.assignInviteCodes, {})).toEqual({ assigned: 1, unchanged: 1 });
    const codes = await t.run(async (ctx) => (await ctx.db.query("leagueTeams").collect()).map((team) => team.inviteToken));
    for (const code of codes) expect(code).toMatch(inviteCodePattern);
    expect(new Set(codes).size).toBe(2);
    expect(codes).toContain(made);
    expect(await t.mutation(internal.league.assignInviteCodes, {})).toEqual({ assigned: 0, unchanged: 2 });
    expect(await t.run(async (ctx) => (await ctx.db.query("leagueTeams").collect()).map((team) => team.inviteToken))).toEqual(codes);

    const { inviteCode } = await teamOf(captain);
    expect(codes).toContain(inviteCode);
    await member.mutation(api.league.join, { code: inviteCode! });
    expect(await rowsOf(t, teamId)).toHaveLength(2);
  });

  it("lets only the captain hand over, remove, rename and change the track, and locks the track after a submission", async () => {
    const { t, captain, teamId, code } = await world();
    const member = await account(t, "anggota@example.com");
    const third = await account(t, "ketiga@example.com");
    for (const caller of [member, third]) await caller.mutation(api.league.join, { code });
    const rows = await rowsOf(t, teamId);
    const rowOf = (id: string) => rows.find((row) => row.ownerId === id)!._id;

    await expect(member.mutation(api.league.rename, { name: "Bukan Kapten" })).rejects.toThrow("Hanya kapten");
    await expect(member.mutation(api.league.removeMember, { memberId: rowOf(third.id) })).rejects.toThrow("Hanya kapten");
    await expect(member.mutation(api.league.changeTrack, { track: "uiux" })).rejects.toThrow("Hanya kapten");
    await expect(member.mutation(api.league.handOver, { memberId: rowOf(member.id) })).rejects.toThrow("Hanya kapten");
    await expect(captain.mutation(api.league.handOver, { memberId: rowOf(captain.id) })).rejects.toThrow("anggota lain");

    await captain.mutation(api.league.rename, { name: "Tim Pelangi" });
    await captain.mutation(api.league.changeTrack, { track: "uiux" });
    const before = await t.run((ctx) => ctx.db.get(teamId));
    expect(before).toMatchObject({ name: "Tim Pelangi", track: "uiux" });
    await captain.mutation(api.league.removeMember, { memberId: rowOf(third.id) });
    expect(await third.query(api.league.mine, {})).toEqual({ eligible: true, team: null });

    await captain.mutation(api.league.handOver, { memberId: rowOf(member.id) });
    expect(await teamOf(member)).toMatchObject({ captain: true, inviteCode: code });
    expect(await teamOf(captain)).toMatchObject({ captain: false, inviteCode: null });

    await t.run((ctx) => ctx.db.patch(teamId, { submittedAt: Date.now() }));
    await expect(member.mutation(api.league.changeTrack, { track: "business" })).rejects.toThrow("setelah timmu mengumpulkan");
    expect((await t.run((ctx) => ctx.db.get(teamId)))!.code).toBe(before!.code);
  });

  it("passes captaincy to the earliest member when the captain leaves, and deletes the team when the last one goes", async () => {
    const { t, captain, teamId, code } = await world();
    const second = await account(t, "kedua@example.com");
    const third = await account(t, "ketiga@example.com");
    await second.mutation(api.league.join, { code });
    await third.mutation(api.league.join, { code });
    await captain.mutation(api.league.leave, {});
    expect(await t.run((ctx) => ctx.db.get(teamId))).toMatchObject({ captainId: second.id });
    await third.mutation(api.league.leave, {});
    await second.mutation(api.league.leave, {});
    expect(await t.run((ctx) => ctx.db.get(teamId))).toBeNull();
    expect(await rowsOf(t, teamId)).toHaveLength(0);
    await expect(second.mutation(api.league.leave, {})).rejects.toThrow("belum punya tim");
  });

  it("shows staff every team with members by name and only the captain's email", async () => {
    const { t, captain, code } = await world();
    const owner = await account(t, "owner@example.com");
    const member = await account(t, "anggota@example.com");
    await member.mutation(api.league.join, { code });
    await expect(member.query(api.league.staffTeams, {})).rejects.toThrow("hanya untuk admin");
    const [team] = await owner.query(api.league.staffTeams, {});
    expect(team).toMatchObject({
      name: "Tim Hujan", trackName: "Software Development", standing: "complete", registration: null,
      captain: { name: "Nama kapten", email: "kapten@example.com" },
      members: [{ ownerId: captain.id, name: "Nama kapten", captain: true }, { ownerId: member.id, name: "Nama anggota", captain: false }],
    });
    expect(JSON.stringify(team)).not.toContain("anggota@example.com");
  });

  it("imports registrations by the captain's email, keeps payment without a column, and returns unmatched emails", async () => {
    const { t, teamId } = await world();
    const owner = await account(t, "owner@example.com");
    await expect((await account(t, "anggota@example.com")).mutation(api.league.importRegistrations, { rows: [] })).rejects.toThrow("hanya untuk admin");
    expect(await owner.mutation(api.league.importRegistrations, { rows: [{ email: " Kapten@Example.com ", paid: false }, { email: "orang@example.com", paid: true }] }))
      .toEqual({ registered: 1, updated: 0, unchanged: 0, unmatched: ["orang@example.com"] });
    expect((await t.run((ctx) => ctx.db.get(teamId)))!.registration).toMatchObject({ paid: false, importedBy: owner.id });
    expect(await owner.mutation(api.league.importRegistrations, { rows: [{ email: "kapten@example.com" }] })).toMatchObject({ unchanged: 1 });
    expect(await owner.mutation(api.league.importRegistrations, { rows: [{ email: "kapten@example.com", paid: true }] })).toMatchObject({ updated: 1 });
    expect((await owner.query(api.league.staffTeams, {}))[0].registration).toMatchObject({ paid: true });
  });

  it("takes a deleted member out of their team: a deleted captain's team gets a new captain, a registered empty team is flagged", async () => {
    const { t, captain, teamId, code } = await world();
    const owner = await account(t, "owner@example.com");
    const member = await account(t, "anggota@example.com");
    await member.mutation(api.league.join, { code });
    expect(await owner.mutation(api.dashboard.deleteAccount, { ownerId: captain.id, confirmName: "Nama kapten" })).toMatchObject({ leagueTeams: 1 });
    expect(await t.run((ctx) => ctx.db.get(teamId))).toMatchObject({ captainId: member.id });
    expect(await rowsOf(t, teamId)).toHaveLength(1);

    await owner.mutation(api.league.importRegistrations, { rows: [{ email: "anggota@example.com", paid: true }] });
    await owner.mutation(api.dashboard.deleteAccount, { ownerId: member.id, confirmName: "Nama anggota" });
    const [flagged] = await owner.query(api.league.staffTeams, {});
    expect(flagged).toMatchObject({ captain: null, members: [], standing: "flagged", registration: { paid: true } });

    // Whoever joins a flagged team with its link becomes its captain.
    const back = await account(t, "kembali@example.com");
    await back.mutation(api.league.join, { code });
    expect(await teamOf(back)).toMatchObject({ captain: true, standing: "forming" });

    // An unregistered team whose last member is deleted goes.
    const solo = await account(t, "sendiri@example.com");
    const soloTeam = await solo.mutation(api.league.create, { name: "Tim Sendiri", track: "business" });
    await owner.mutation(api.dashboard.deleteAccount, { ownerId: solo.id, confirmName: "Nama sendiri" });
    expect(await t.run((ctx) => ctx.db.get(soloTeam))).toBeNull();
  });
});
