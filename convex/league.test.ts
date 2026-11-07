/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { leagueTeamSize, teamCodePattern } from "../src/lib/league-team";

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
  const { inviteToken } = await teamOf(captain);
  return { t, captain, teamId, token: inviteToken! };
}

describe("league teams", () => {
  it("creates a team with the creator as captain, a team code and an invite only the captain sees", async () => {
    const { t, captain, teamId, token } = await world();
    const team = await t.run((ctx) => ctx.db.get(teamId));
    expect(team).toMatchObject({ name: "Tim Hujan", track: "software", captainId: captain.id, season: "2026/27" });
    expect(team!.code).toMatch(teamCodePattern);
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await teamOf(captain)).toMatchObject({ captain: true, standing: "forming", members: [{ name: "Nama kapten", captain: true, you: true }] });

    const member = await account(t, "anggota@example.com");
    expect(await member.query(api.league.invite, { token })).toMatchObject({ name: "Tim Hujan", trackName: "Software Development", captain: "Nama kapten", members: 1, full: false, joined: false });
    await member.mutation(api.league.join, { token });
    expect(await teamOf(member)).toMatchObject({ captain: false, inviteToken: null, code: team!.code, standing: "complete" });
    // Joining twice changes nothing.
    await member.mutation(api.league.join, { token });
    expect(await rowsOf(t, teamId)).toHaveLength(2);
  });

  it("takes only active, onboarded members", async () => {
    const { t, token } = await world();
    const guest = await account(t, "baru@example.com", { onboarded: false });
    const off = await account(t, "nonaktif@example.com", { deactivated: true });
    expect(await guest.query(api.league.mine, {})).toEqual({ eligible: false, reason: "onboarding" });
    expect(await off.query(api.league.mine, {})).toEqual({ eligible: false, reason: "deactivated" });
    expect(await t.query(api.league.mine, {})).toEqual({ eligible: false, reason: "signedOut" });
    await expect(guest.mutation(api.league.create, { name: "Tim Lain", track: "uiux" })).rejects.toThrow("Selesaikan perkenalan");
    await expect(guest.mutation(api.league.join, { token })).rejects.toThrow("Selesaikan perkenalan");
    await expect(off.mutation(api.league.join, { token })).rejects.toThrow("dinonaktifkan");
    await expect(t.mutation(api.league.join, { token })).rejects.toThrow("Masuk kembali");
  });

  it("keeps a member in one team per season and team names unique", async () => {
    const { t, token } = await world();
    const other = await account(t, "lain@example.com");
    await expect(other.mutation(api.league.create, { name: "tim hujan", track: "business" })).rejects.toThrow("sudah dipakai");
    await other.mutation(api.league.create, { name: "Tim Lain", track: "business" });
    await expect(other.mutation(api.league.join, { token })).rejects.toThrow("sudah punya tim");
    await expect(other.mutation(api.league.create, { name: "Tim Ketiga", track: "business" })).rejects.toThrow("sudah punya tim");
    expect(await other.query(api.league.invite, { token })).toMatchObject({ inOtherTeam: true });
  });

  it(`stops at ${leagueTeamSize.max} members, and two joins racing for the last place cannot both get in`, async () => {
    const { t, teamId, token } = await world();
    for (let i = 1; i < leagueTeamSize.max - 1; i++) await (await account(t, `a${i}@example.com`)).mutation(api.league.join, { token });
    expect(await rowsOf(t, teamId)).toHaveLength(leagueTeamSize.max - 1);
    const [first, second] = [await account(t, "cepat@example.com"), await account(t, "lambat@example.com")];
    const results = await Promise.allSettled([first.mutation(api.league.join, { token }), second.mutation(api.league.join, { token })]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(String((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason)).toContain("sudah penuh");
    expect(await rowsOf(t, teamId)).toHaveLength(leagueTeamSize.max);
    expect(await (await account(t, "telat@example.com")).query(api.league.invite, { token })).toMatchObject({ full: true });
  });

  it("refuses an old or wrong invite once the captain replaces it", async () => {
    const { t, captain, token } = await world();
    const fresh = await captain.mutation(api.league.rotateInvite, {});
    expect(fresh).not.toBe(token);
    const member = await account(t, "anggota@example.com");
    expect(await member.query(api.league.invite, { token })).toBeNull();
    expect(await member.query(api.league.invite, { token: "not a token" })).toBeNull();
    await expect(member.mutation(api.league.join, { token })).rejects.toThrow("tidak berlaku");
    await member.mutation(api.league.join, { token: fresh });
    await expect(member.mutation(api.league.rotateInvite, {})).rejects.toThrow("Hanya kapten");
  });

  it("lets only the captain hand over, remove, rename and change the track, and locks the track after a submission", async () => {
    const { t, captain, teamId, token } = await world();
    const member = await account(t, "anggota@example.com");
    const third = await account(t, "ketiga@example.com");
    for (const caller of [member, third]) await caller.mutation(api.league.join, { token });
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
    expect(await teamOf(member)).toMatchObject({ captain: true, inviteToken: token });
    expect(await teamOf(captain)).toMatchObject({ captain: false, inviteToken: null });

    await t.run((ctx) => ctx.db.patch(teamId, { submittedAt: Date.now() }));
    await expect(member.mutation(api.league.changeTrack, { track: "business" })).rejects.toThrow("setelah timmu mengumpulkan");
    expect((await t.run((ctx) => ctx.db.get(teamId)))!.code).toBe(before!.code);
  });

  it("passes captaincy to the earliest member when the captain leaves, and deletes the team when the last one goes", async () => {
    const { t, captain, teamId, token } = await world();
    const second = await account(t, "kedua@example.com");
    const third = await account(t, "ketiga@example.com");
    await second.mutation(api.league.join, { token });
    await third.mutation(api.league.join, { token });
    await captain.mutation(api.league.leave, {});
    expect(await t.run((ctx) => ctx.db.get(teamId))).toMatchObject({ captainId: second.id });
    await third.mutation(api.league.leave, {});
    await second.mutation(api.league.leave, {});
    expect(await t.run((ctx) => ctx.db.get(teamId))).toBeNull();
    expect(await rowsOf(t, teamId)).toHaveLength(0);
    await expect(second.mutation(api.league.leave, {})).rejects.toThrow("belum punya tim");
  });

  it("shows staff every team with members by name and only the captain's email", async () => {
    const { t, captain, token } = await world();
    const owner = await account(t, "owner@example.com");
    const member = await account(t, "anggota@example.com");
    await member.mutation(api.league.join, { token });
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
});
