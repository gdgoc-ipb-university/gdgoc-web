/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const page = { numItems: 20, cursor: null };
const everyone = { search: "", filters: {}, page: 1, pageSize: 20 };

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
async function account(t: ReturnType<typeof setup>, email: string, { onboarded = true, name = email.split("@")[0] } = {}) {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name, email, emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: Date.now() + 3600000, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  await t.run((ctx) => ctx.db.insert("memberProfiles", {
    ownerId: user._id, fullName: name, campus: "IPB University", studyProgram: "Ilmu Komputer",
    nextStep: 4, revision: 4, updatedAt: Date.now(), memberType: "member", ...(onboarded ? { completedAt: Date.now() } : {}),
  }));
  return Object.assign(t.withIdentity({ subject: user._id, sessionId: session._id, email }), { id: user._id as string });
}
beforeEach(() => vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com"));
afterEach(() => vi.unstubAllEnvs());

describe("dashboard roles and member management", () => {
  it("derives roles from the allowlist and profile, and requires completed onboarding", async () => {
    const t = setup();
    expect(await t.query(api.dashboard.viewer)).toBeNull();
    const owner = await account(t, "owner@example.com");
    const fresh = await account(t, "fresh@example.com", { onboarded: false });
    expect(await owner.query(api.dashboard.viewer)).toMatchObject({ role: "owner", active: true, onboarded: true });
    expect(await fresh.query(api.dashboard.viewer)).toMatchObject({ role: "member", onboarded: false });
    await expect(fresh.query(api.assignments.list)).rejects.toThrow("Selesaikan perkenalan");
  });

  it("lets only owners promote and demote admins, never other owners", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com");
    const member = await account(t, "member@example.com");
    const other = await account(t, "other@example.com");
    await expect(member.query(api.dashboard.members, everyone)).rejects.toThrow("hanya untuk admin");
    await expect(member.mutation(api.dashboard.setRole, { ownerId: other.id, role: "admin" })).rejects.toThrow("Hanya pemilik");
    await owner.mutation(api.dashboard.setRole, { ownerId: member.id, role: "admin" });
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ role: "admin" });
    await expect(member.mutation(api.dashboard.setRole, { ownerId: other.id, role: "admin" })).rejects.toThrow("Hanya pemilik");
    await expect(owner.mutation(api.dashboard.setRole, { ownerId: owner.id, role: "member" })).rejects.toThrow("konfigurasi server");
    const admins = await member.query(api.dashboard.members, { ...everyone, filters: { access: ["admin" as const] } });
    expect(admins.rows.map((row) => row.email)).toEqual(["member@example.com"]);
    await owner.mutation(api.dashboard.setRole, { ownerId: member.id, role: "member" });
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ role: "member" });
    const profile = await t.run((ctx) => ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", member.id)).unique());
    expect(profile).not.toHaveProperty("role");
  });

  it("lists only onboarded members with emails and roles", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik" });
    await account(t, "member@example.com", { name: "Anggota Satu" });
    await account(t, "fresh@example.com", { onboarded: false });
    const rows = (await owner.query(api.dashboard.members, everyone)).rows;
    expect(rows.map((row) => [row.email, row.role]).sort()).toEqual([["member@example.com", "member"], ["owner@example.com", "owner"]]);
    expect(await owner.query(api.dashboard.stats)).toMatchObject({ members: 2, owners: 1, admins: 0, reviewers: 0, core: 0, bod: 0, deactivated: 0, unconfirmed: 0 });
  });

  it("lets only owners export members, with every onboarded member and their review access", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik" });
    const admin = await account(t, "admin@example.com", { name: "Admin" });
    const member = await account(t, "member@example.com", { name: "Anggota" });
    await account(t, "fresh@example.com", { onboarded: false });
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
    await expect(admin.query(api.dashboard.exportMembers, { paginationOpts: page })).rejects.toThrow("Hanya pemilik");
    await expect(member.query(api.dashboard.exportMembers, { paginationOpts: page })).rejects.toThrow("Hanya pemilik");
    const first = await owner.query(api.dashboard.exportMembers, { paginationOpts: { numItems: 2, cursor: null } });
    const rest = await owner.query(api.dashboard.exportMembers, { paginationOpts: { numItems: 2, cursor: first.continueCursor } });
    const rows = [...first.page, ...rest.page].map((row) => [row.email, row.role, row.reviewer]).sort();
    expect(rows).toEqual([["admin@example.com", "admin", true], ["member@example.com", "member", false], ["owner@example.com", "owner", true]]);
  });

  it("shows staff when a member last changed their Instagram username, in the list, the member page and the CSV (#235)", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik" });
    const admin = await account(t, "admin@example.com", { name: "Admin" });
    const member = await account(t, "member@example.com", { name: "Anggota" });
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
    const row = async () => (await admin.query(api.dashboard.members, everyone)).rows.find((item) => item.ownerId === member.id)!;
    expect(await row()).toMatchObject({ instagramChangedAt: null });
    const values = { fullName: "Anggota", institutionKind: "campus" as const, campus: "IPB University", studyProgram: "Ilmu Komputer", instagram: "anggota.baru" };
    const saved = await member.mutation(api.members.updateProfile, { revision: 4, values });
    expect(await row()).toMatchObject({ instagram: "anggota.baru", instagramChangedAt: saved.instagramChangedAt });
    expect(await admin.query(api.dashboard.member, { ownerId: member.id })).toMatchObject({ instagramChangedAt: saved.instagramChangedAt });
    const exported = (await owner.query(api.dashboard.exportMembers, { paginationOpts: page })).page;
    expect(exported.find((item) => item.ownerId === member.id)).toMatchObject({ instagramChangedAt: saved.instagramChangedAt });
    expect(exported.find((item) => item.ownerId === admin.id)).toMatchObject({ instagramChangedAt: null });
  });

  it("shows staff one member's profile, submissions, sent Apresiasi, reviews and last access change", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik" });
    const member = await account(t, "member@example.com", { name: "Anggota Satu" });
    const fresh = await account(t, "fresh@example.com", { onboarded: false });
    const due = new Date(Date.now() + 48 * 3600000 + 7 * 3600000).toISOString().slice(0, 16);
    const task = { title: "Landing page", description: "Buat landing page.", dueAt: due };
    const id = await owner.mutation(api.assignments.create, { values: task, publish: true });
    const reviewed = await owner.mutation(api.assignments.create, { values: { ...task, title: "Tugas mentor" }, publish: true });
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Jawaban", fileIds: [] });
    const [row] = (await owner.query(api.assignments.submissions, { id, paginationOpts: page })).page;
    await owner.mutation(api.assignments.review, { submissionId: row._id, submissionRevision: 1, score: 90, feedback: "" });
    await owner.mutation(api.assignments.setReviewer, { id: reviewed, ownerId: member.id, reviewer: true });
    const values = { fullName: "Anggota Satu", memberType: "Member", campus: "IPB University", studyProgram: "", instagram: "anggota", achievement: "Juara 1 UI/UX", eventName: "Lomba", organizer: "Panitia", level: "Nasional", participation: "Individu", teamName: "", teamMembers: "", eventDate: "2026-08-10", story: "Cerita", documentationLinks: "https://example.com", publicationConsent: true };
    await t.run(async (ctx) => {
      await ctx.db.insert("appreciations", { ownerId: member.id, ownerName: "Anggota Satu", ownerEmail: "member@example.com", clientId: "a", values, status: "submitted", revision: 2, updatedAt: Date.now(), submittedAt: Date.now() });
      await ctx.db.insert("appreciations", { ownerId: member.id, ownerName: "Anggota Satu", ownerEmail: "member@example.com", clientId: "b", values: { ...values, achievement: "Draft rahasia" }, status: "draft", revision: 0, updatedAt: Date.now() });
    });
    await owner.mutation(api.dashboard.setActive, { ownerId: member.id, active: false });

    await expect(member.query(api.dashboard.member, { ownerId: member.id })).rejects.toThrow();
    expect(await owner.query(api.dashboard.member, { ownerId: fresh.id })).toBeNull();
    expect(await owner.query(api.dashboard.member, { ownerId: "missing" })).toBeNull();
    const detail = await owner.query(api.dashboard.member, { ownerId: member.id });
    expect(detail).toMatchObject({
      fullName: "Anggota Satu", email: "member@example.com", studyProgram: "Ilmu Komputer", role: "member", active: false, accessUpdatedBy: "Pemilik",
      submissions: [{ title: "Landing page", score: 90, maxScore: 100, late: false, stale: false, revisionRequestedAt: null }],
      appreciations: [{ achievement: "Juara 1 UI/UX", status: "submitted", level: "Nasional" }],
      drafts: 1,
      reviewing: [{ _id: reviewed, title: "Tugas mentor" }],
    });
    expect(JSON.stringify(detail)).not.toContain("Draft rahasia");
  });

  it("lets Media & Creative Core Team and BoD review Apresiasi once staff confirm their tag", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik" });
    const admin = await account(t, "admin@example.com", { name: "Admin" });
    const media = await account(t, "media@example.com", { name: "Mira Media" });
    const tech = await account(t, "tech@example.com", { name: "Teguh Teknis" });
    const board = await account(t, "board@example.com", { name: "Bima BoD" });
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
    // Self-declared during onboarding: no review yet.
    await t.run(async (ctx) => {
      for (const [id, division] of [[media.id, "Media & Creative"], [tech.id, "Technical"]]) {
        const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", id)).unique();
        await ctx.db.patch(profile!._id, { memberType: "core", division });
      }
    });
    const queue = { status: "submitted" as const, paginationOpts: page };
    expect(await media.query(api.dashboard.viewer)).toMatchObject({ reviewer: false });
    await expect(media.query(api.appreciations.queue, queue)).rejects.toThrow("tim peninjau");

    // Staff confirm the tag unchanged: Media & Creative reviews, Technical does not.
    await admin.mutation(api.dashboard.setMemberType, { ownerId: media.id, memberType: "core", division: "Media & Creative" });
    await admin.mutation(api.dashboard.setMemberType, { ownerId: tech.id, memberType: "core", division: "Technical" });
    expect(await media.query(api.dashboard.viewer)).toMatchObject({ reviewer: true });
    await expect(media.query(api.appreciations.queue, queue)).resolves.toMatchObject({ page: [] });
    expect(await tech.query(api.dashboard.viewer)).toMatchObject({ reviewer: false });
    // BoD set by staff is confirmed from the start.
    await admin.mutation(api.dashboard.setMemberType, { ownerId: board.id, memberType: "bod", division: "Media & Creative" });
    expect(await board.query(api.dashboard.viewer)).toMatchObject({ reviewer: true });
    const reviewers = await admin.query(api.dashboard.members, { ...everyone, filters: { reviewer: true } });
    expect(reviewers.rows.map((row) => [row.fullName, row.reviewer, row.reviewsByTag, row.tagConfirmed]).sort()).toEqual([["Bima BoD", false, true, true], ["Mira Media", false, true, true]]);
    expect(await admin.query(api.dashboard.stats)).toMatchObject({ reviewers: 2 });
    expect((await owner.query(api.dashboard.exportMembers, { paginationOpts: page })).page.find((row) => row.fullName === "Mira Media")).toMatchObject({ reviewer: true });

    // Deactivation suspends it; reactivation brings it back.
    await admin.mutation(api.dashboard.setActive, { ownerId: media.id, active: false });
    expect(await media.query(api.dashboard.viewer)).toMatchObject({ reviewer: false });
    await admin.mutation(api.dashboard.setActive, { ownerId: media.id, active: true });
    expect(await media.query(api.dashboard.viewer)).toMatchObject({ reviewer: true });

    const log = await owner.query(api.dashboard.accessLog, { ownerId: media.id, paginationOpts: page });
    expect(log.page.map(({ change, from, to, actor }) => [change, from, to, actor])).toEqual([
      ["active", "deactivated", "active", "Admin"],
      ["active", "active", "deactivated", "Admin"],
      ["tagConfirmed", "unconfirmed", "core:Media & Creative", "Admin"],
    ]);
  });

  it("logs every access change for owners, with the value before and after, and skips no-ops", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik" });
    const admin = await account(t, "admin@example.com", { name: "Admin Satu" });
    const member = await account(t, "member@example.com", { name: "Rania Putri" });
    const leaver = await account(t, "leaver@example.com", { name: "Akan Pergi" });
    const due = new Date(Date.now() + 55 * 3600000).toISOString().slice(0, 16);
    const assignment = await owner.mutation(api.assignments.create, { values: { title: "Tugas mentor", description: "Nilai.", dueAt: due }, publish: true });

    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" }); // already admin: not logged
    await owner.mutation(api.dashboard.setReviewer, { ownerId: member.id, reviewer: true });
    await admin.mutation(api.dashboard.setActive, { ownerId: member.id, active: false });
    await admin.mutation(api.dashboard.setActive, { ownerId: member.id, active: true });
    await admin.mutation(api.dashboard.setMemberType, { ownerId: member.id, memberType: "core", division: "Technical" });
    await admin.mutation(api.dashboard.setMemberType, { ownerId: member.id, memberType: "core", division: "Technical" }); // unchanged
    await admin.mutation(api.assignments.setReviewer, { id: assignment, ownerId: member.id, reviewer: true });
    await admin.mutation(api.assignments.setReviewer, { id: assignment, ownerId: member.id, reviewer: false });
    await admin.mutation(api.assignments.setReviewer, { id: assignment, ownerId: member.id, reviewer: false }); // not a reviewer: not logged
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "member" });
    await owner.mutation(api.dashboard.deleteAccount, { ownerId: leaver.id, confirmName: "Akan Pergi" });

    await expect(admin.query(api.dashboard.accessLog, { paginationOpts: page })).rejects.toThrow("Hanya pemilik");
    await expect(member.query(api.dashboard.accessLog, { ownerId: member.id, paginationOpts: page })).rejects.toThrow("Hanya pemilik");
    const all = await owner.query(api.dashboard.accessLog, { paginationOpts: page });
    expect(all.page.map(({ change, from, to, actor, target }) => [change, from, to, actor, target])).toEqual([
      ["deleted", "member", "deleted", "Pemilik", null],
      ["role", "admin", "member", "Pemilik", "Admin Satu"],
      ["assignmentReviewer", "on", "off", "Admin Satu", "Rania Putri"],
      ["assignmentReviewer", "off", "on", "Admin Satu", "Rania Putri"],
      ["memberType", "member", "core:Technical", "Admin Satu", "Rania Putri"],
      ["active", "deactivated", "active", "Admin Satu", "Rania Putri"],
      ["active", "active", "deactivated", "Admin Satu", "Rania Putri"],
      ["reviewer", "off", "on", "Pemilik", "Rania Putri"],
      ["role", "member", "admin", "Pemilik", "Admin Satu"],
    ]);
    expect(all.page[2].assignment).toEqual({ _id: assignment, slug: "tugas-mentor", title: "Tugas mentor" });
    const mine = await owner.query(api.dashboard.accessLog, { ownerId: member.id, paginationOpts: { numItems: 3, cursor: null } });
    expect(mine.page.map((entry) => entry.change)).toEqual(["assignmentReviewer", "assignmentReviewer", "memberType"]);
    expect(mine.isDone).toBe(false);
    // An assignment deleted later keeps its log rows, without a title.
    await t.run((ctx) => ctx.db.delete(assignment));
    expect((await owner.query(api.dashboard.accessLog, { ownerId: member.id, paginationOpts: page })).page[0].assignment).toEqual({ _id: assignment, slug: undefined, title: null });
  });

  it("lets owners delete a member's account and everything tied to it, keeping only a count", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik" });
    const admin = await account(t, "admin@example.com", { name: "Admin" });
    const member = await account(t, "member@example.com", { name: "Anggota Hapus" });
    const keeper = await account(t, "keeper@example.com", { name: "Anggota Lain" });
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
    const due = new Date(Date.now() + 55 * 3600000).toISOString().slice(0, 16);
    const id = await owner.mutation(api.assignments.create, { values: { title: "Tugas", description: "Kerjakan.", dueAt: due }, publish: true });
    const other = await owner.mutation(api.assignments.create, { values: { title: "Tugas mentor", description: "Nilai.", dueAt: due }, publish: true });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(1024)], { type: "application/pdf" })));
    const attached = await member.mutation(api.assignments.attachFile, { assignmentId: id, storageId, name: "laporan.pdf" });
    if ("error" in attached) throw new Error(attached.error);
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Jawaban", fileIds: [attached.fileId] });
    await keeper.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Tetap", fileIds: [] });
    const pending = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(10)], { type: "application/pdf" })));
    await member.mutation(api.assignments.attachFile, { assignmentId: id, storageId: pending, name: "draft.pdf" });
    const [row] = (await owner.query(api.assignments.submissions, { id, paginationOpts: page })).page.filter((entry) => entry.email === "member@example.com");
    await owner.mutation(api.assignments.review, { submissionId: row._id, submissionRevision: 1, score: 70, feedback: "" });
    await owner.mutation(api.assignments.setReviewer, { id: other, ownerId: member.id, reviewer: true });
    await member.mutation(api.cards.ensure, {});
    await t.run(async (ctx) => {
      const values = { fullName: "Anggota Hapus", memberType: "Member", campus: "IPB", studyProgram: "", instagram: "hapus", achievement: "Juara", eventName: "Lomba", organizer: "Panitia", level: "Nasional", participation: "Individu", teamName: "", teamMembers: "", eventDate: "2026-08-10", story: "Cerita", documentationLinks: "https://example.com", publicationConsent: true };
      const appreciation = await ctx.db.insert("appreciations", { ownerId: member.id, ownerName: "Anggota Hapus", ownerEmail: "member@example.com", clientId: "a", values, status: "submitted", revision: 2, updatedAt: Date.now(), submittedAt: Date.now() });
      await ctx.db.insert("appreciationReviews", { appreciationId: appreciation, reviewerId: owner.id, status: "reviewing", note: "", postUrl: "", createdAt: Date.now() });
      await ctx.db.insert("gameRuns", { ownerId: member.id, nonce: "n", seed: 1, issuedAt: 1, endTick: 1, score: 10, week: "2026-W41", submittedAt: Date.now() });
      await ctx.db.insert("gameBests", { ownerId: member.id, period: "all", score: 10, name: "Anggota", achievedAt: Date.now(), hidden: false });
      await ctx.db.insert("gamePlayers", { ownerId: member.id });
    });

    await expect(admin.mutation(api.dashboard.deleteAccount, { ownerId: member.id, confirmName: "Anggota Hapus" })).rejects.toThrow("Hanya pemilik");
    await expect(owner.mutation(api.dashboard.deleteAccount, { ownerId: owner.id, confirmName: "Pemilik" })).rejects.toThrow("akunmu sendiri");
    await expect(owner.mutation(api.dashboard.deleteAccount, { ownerId: member.id, confirmName: "anggota" })).rejects.toThrow("Ketik nama");
    expect(await owner.mutation(api.dashboard.deleteAccount, { ownerId: member.id, confirmName: " Anggota Hapus " })).toEqual({
      appreciations: 1, appreciationReviews: 1, submissions: 1, submissionReviews: 1, files: 2, gameRuns: 1, gameBests: 1, reviewerGrants: 1, sessions: 1, accounts: 0, enrolments: 0, mentorGrants: 0, cards: 1, checkIns: 0, helperGrants: 0, techSupportRequests: 0, photos: 0, leagueTeams: 0, flagSolves: 0, flagAttempts: 0,
    });

    const left = await t.run(async (ctx) => {
      const owned = async (table: "appreciations" | "assignmentSubmissions" | "submissionFiles" | "gameRuns" | "gameBests" | "gamePlayers" | "memberProfiles") =>
        (await ctx.db.query(table).collect()).filter((doc) => doc.ownerId === member.id).length;
      return {
        profiles: await owned("memberProfiles"), appreciations: await owned("appreciations"), submissions: await owned("assignmentSubmissions"), files: await owned("submissionFiles"),
        runs: await owned("gameRuns"), bests: await owned("gameBests"), players: await owned("gamePlayers"),
        reviews: (await ctx.db.query("submissionReviews").collect()).length, appreciationReviews: (await ctx.db.query("appreciationReviews").collect()).length,
        storage: await Promise.all([storageId, pending].map((idx) => ctx.storage.getUrl(idx))),
        reviewers: (await ctx.db.get(other))?.reviewers, deletions: await ctx.db.query("accountDeletions").collect(),
      };
    });
    expect(left).toMatchObject({ profiles: 0, appreciations: 0, submissions: 0, files: 0, runs: 0, bests: 0, players: 0, reviews: 0, appreciationReviews: 0, storage: [null, null], reviewers: [] });
    expect(left.deletions).toHaveLength(1);
    expect(left.deletions[0]).toMatchObject({ deletedBy: owner.id });
    expect(JSON.stringify(left.deletions)).not.toContain("member@example.com");
    expect(await t.query(components.betterAuth.adapter.findOne, { model: "user", where: [{ field: "_id", operator: "eq", value: member.id }] })).toBeNull();
    // The account can no longer sign in, and other members' work is untouched.
    expect(await member.query(api.dashboard.viewer)).toBeNull();
    expect((await owner.query(api.assignments.submissions, { id, paginationOpts: page })).page.map((entry) => entry.email)).toEqual(["keeper@example.com"]);
    await expect(owner.mutation(api.dashboard.deleteAccount, { ownerId: member.id, confirmName: "Anggota Hapus" })).rejects.toThrow("tidak ditemukan");
  });

  it("lets admins review Apresiasi by role, and owners grant it to members, suspended while deactivated", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com");
    const admin = await account(t, "admin@example.com");
    const member = await account(t, "member@example.com");
    const queue = { status: "submitted" as const, paginationOpts: page };
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
    // Admins review by role, but cannot grant review to others.
    expect(await admin.query(api.dashboard.viewer)).toMatchObject({ role: "admin", reviewer: true });
    expect(await admin.query(api.auth.viewer)).toMatchObject({ isAdmin: true });
    expect((await admin.query(api.appreciations.queue, queue)).page).toEqual([]);
    await expect(admin.mutation(api.dashboard.setReviewer, { ownerId: member.id, reviewer: true })).rejects.toThrow("Hanya pemilik");
    await expect(owner.mutation(api.dashboard.setReviewer, { ownerId: admin.id, reviewer: true })).rejects.toThrow("Admin sudah bisa");
    await expect(owner.mutation(api.dashboard.setReviewer, { ownerId: owner.id, reviewer: true })).rejects.toThrow("konfigurasi server");

    await owner.mutation(api.dashboard.setReviewer, { ownerId: member.id, reviewer: true });
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ role: "member", reviewer: true });
    expect(await member.query(api.auth.viewer)).toMatchObject({ isAdmin: true });
    expect((await member.query(api.appreciations.queue, queue)).page).toEqual([]);
    expect((await owner.query(api.dashboard.members, { ...everyone, filters: { reviewer: true } })).rows.map((row) => [row.email, row.reviewer])).toEqual([["member@example.com", true]]);
    expect(await owner.query(api.dashboard.stats)).toMatchObject({ reviewers: 1, admins: 1 });

    // Deactivation suspends review without clearing the grant; reactivation restores it.
    await owner.mutation(api.dashboard.setActive, { ownerId: member.id, active: false });
    await expect(member.query(api.appreciations.queue, queue)).rejects.toThrow("tim peninjau");
    await owner.mutation(api.dashboard.setReviewer, { ownerId: member.id, reviewer: true }); // already granted: no-op, not an error
    const idle = await account(t, "idle@example.com");
    await owner.mutation(api.dashboard.setActive, { ownerId: idle.id, active: false });
    await expect(owner.mutation(api.dashboard.setReviewer, { ownerId: idle.id, reviewer: true })).rejects.toThrow("Aktifkan kembali");
    await owner.mutation(api.dashboard.setActive, { ownerId: member.id, active: true });
    expect((await member.query(api.appreciations.queue, queue)).page).toEqual([]);

    await owner.mutation(api.dashboard.setReviewer, { ownerId: member.id, reviewer: false });
    await expect(member.query(api.appreciations.queue, queue)).rejects.toThrow("tim peninjau");
    const profile = await t.run((ctx) => ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", member.id)).unique());
    expect(profile).not.toHaveProperty("appreciationReviewer");
    // Demoting an admin ends review that came from the role.
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "member" });
    expect(await admin.query(api.dashboard.viewer)).toMatchObject({ role: "member", reviewer: false });
    await expect(admin.query(api.appreciations.queue, queue)).rejects.toThrow("tim peninjau");
  });

  it("deactivates members, blocks their dashboard access, and protects admins and owners", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com");
    const admin = await account(t, "admin@example.com");
    const member = await account(t, "member@example.com");
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
    await expect(member.mutation(api.dashboard.setActive, { ownerId: admin.id, active: false })).rejects.toThrow("hanya untuk admin");
    await expect(admin.mutation(api.dashboard.setActive, { ownerId: owner.id, active: false })).rejects.toThrow("pemilik tidak bisa");
    await expect(admin.mutation(api.dashboard.setActive, { ownerId: admin.id, active: false })).rejects.toThrow("akunmu sendiri");
    await expect(owner.mutation(api.dashboard.setActive, { ownerId: admin.id, active: false })).rejects.toThrow("Turunkan peran admin");

    await admin.mutation(api.dashboard.setActive, { ownerId: member.id, active: false });
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ active: false });
    await expect(member.query(api.assignments.list)).rejects.toThrow("dinonaktifkan");
    await expect(owner.mutation(api.dashboard.setRole, { ownerId: member.id, role: "admin" })).rejects.toThrow("Aktifkan kembali");
    expect((await owner.query(api.dashboard.members, { ...everyone, filters: { status: "deactivated" as const } })).rows.map((row) => row.email)).toEqual(["member@example.com"]);

    await admin.mutation(api.dashboard.setActive, { ownerId: member.id, active: true });
    expect(await member.query(api.assignments.list)).toEqual([]);
  });

  it("finds members by name", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com");
    await account(t, "a@example.com", { name: "Rania Putri" });
    await account(t, "b@example.com", { name: "Bima Sakti" });
    const found = await owner.query(api.dashboard.members, { ...everyone, search: "rania" });
    expect(found.rows.map((row) => row.fullName)).toEqual(["Rania Putri"]);
  });

  it("filters members by access, community, division, tag confirmation, status, and review, and counts each option", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik" });
    const admin = await account(t, "admin@example.com", { name: "Admin" });
    const tech = await account(t, "tech@example.com", { name: "Tekno" });
    const media = await account(t, "media@example.com", { name: "Media" });
    const gone = await account(t, "gone@example.com", { name: "Pergi" });
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
    await owner.mutation(api.dashboard.setMemberType, { ownerId: media.id, memberType: "core", division: "Media & Creative" });
    await owner.mutation(api.dashboard.setActive, { ownerId: gone.id, active: false });
    // A self-declared tag: Core Team Technical, not yet confirmed by staff.
    await t.run(async (ctx) => {
      const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", tech.id)).unique();
      await ctx.db.patch(profile!._id, { memberType: "core", division: "Technical" });
    });
    const names = async (filters: object) => (await owner.query(api.dashboard.members, { ...everyone, filters, sort: "name-asc" as const })).rows.map((row) => row.fullName);
    expect(await names({ access: ["owner"] })).toEqual(["Pemilik"]);
    expect(await names({ access: ["owner", "admin"] })).toEqual(["Admin", "Pemilik"]);
    expect(await names({ access: ["member"] })).toEqual(["Media", "Pergi", "Tekno"]);
    expect(await names({ community: ["core"] })).toEqual(["Media", "Tekno"]);
    expect(await names({ community: ["core"], divisions: ["Technical"] })).toEqual(["Tekno"]);
    expect(await names({ tag: "unconfirmed" })).toEqual(["Tekno"]);
    expect(await names({ tag: "confirmed" })).toEqual(["Media"]);
    expect(await names({ reviewer: true })).toEqual(["Media"]);
    expect(await names({ status: "deactivated" })).toEqual(["Pergi"]);
    expect(await names({ status: "active", access: ["member"] })).toEqual(["Media", "Tekno"]);
    expect(await owner.query(api.dashboard.stats)).toMatchObject({
      members: 5, owners: 1, admins: 1, core: 2, bod: 0, reviewers: 1, deactivated: 1, unconfirmed: 1,
      divisions: expect.objectContaining({ Technical: 1, "Media & Creative": 1, "Program & Development": 0 }),
    });
  });

  it("pages members by number, with a total, sorted by join date or name", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik" });
    const joined = ["Pemilik", "Dewi", "Bima", "Citra", "Adi"];
    for (const name of joined.slice(1)) await account(t, `${name.toLowerCase()}@example.com`, { name });
    await t.run(async (ctx) => {
      for (const profile of await ctx.db.query("memberProfiles").collect()) await ctx.db.patch(profile._id, { completedAt: 1000 + joined.indexOf(profile.fullName) });
    });
    const first = await owner.query(api.dashboard.members, { ...everyone, sort: "name-asc", pageSize: 2 });
    expect(first).toMatchObject({ total: 5, page: 1, pageSize: 2, pageCount: 3 });
    expect(first.rows.map((row) => row.fullName)).toEqual(["Adi", "Bima"]);
    const last = await owner.query(api.dashboard.members, { ...everyone, sort: "name-asc", page: 3, pageSize: 2 });
    expect(last.rows.map((row) => row.fullName)).toEqual(["Pemilik"]);
    // A page past the end (e.g. after a deactivation emptied it) comes back as the last page.
    expect(await owner.query(api.dashboard.members, { ...everyone, sort: "name-asc", page: 9, pageSize: 2 })).toMatchObject({ page: 3 });
    const newest = await owner.query(api.dashboard.members, { ...everyone, pageSize: 2 });
    expect(newest.rows.map((row) => row.fullName)).toEqual(["Adi", "Citra"]);
    const oldest = await owner.query(api.dashboard.members, { ...everyone, sort: "joined-asc", pageSize: 2 });
    expect(oldest.rows.map((row) => row.fullName)).toEqual(["Pemilik", "Dewi"]);
  });
  it("lets staff assign Core Team with a division, which members cannot do for themselves, and filter the core team", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com");
    const admin = await account(t, "admin@example.com");
    const member = await account(t, "member@example.com");
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
    for (const ownerId of [owner.id, member.id]) {
      await expect(member.mutation(api.dashboard.setMemberType, { ownerId, memberType: "core", division: "Technical" })).rejects.toThrow("hanya untuk admin");
    }
    await expect(owner.mutation(api.dashboard.setMemberType, { ownerId: member.id, memberType: "core", division: "" })).rejects.toThrow("Pilih divisi untuk Core Team");
    await admin.mutation(api.dashboard.setMemberType, { ownerId: member.id, memberType: "core", division: "Media & Creative" });
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ memberType: "core", division: "Media & Creative", tagConfirmed: true });
    await owner.mutation(api.dashboard.setMemberType, { ownerId: member.id, memberType: "core", division: "Community & External" });
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ memberType: "core", division: "Community & External", tagConfirmed: true });
    const core = await owner.query(api.dashboard.members, { ...everyone, filters: { community: ["core" as const] } });
    expect(core.rows.map((row) => [row.email, row.division])).toEqual([["member@example.com", "Community & External"]]);
    expect((await owner.query(api.dashboard.stats)).core).toBe(1);
  });

  it("lets staff tag BoD with an optional division, and filter and count BoD", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com");
    const member = await account(t, "member@example.com");
    await expect(member.mutation(api.dashboard.setMemberType, { ownerId: member.id, memberType: "bod", division: "" })).rejects.toThrow("hanya untuk admin");
    await expect(owner.mutation(api.dashboard.setMemberType, { ownerId: member.id, memberType: "bod", division: "Divisi Karangan" })).rejects.toThrow("kosongkan untuk BoD");
    await owner.mutation(api.dashboard.setMemberType, { ownerId: member.id, memberType: "bod", division: "" });
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ memberType: "bod", division: null, role: "member" }); // a tag, not access
    await owner.mutation(api.dashboard.setMemberType, { ownerId: member.id, memberType: "bod", division: " Technical " });
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ memberType: "bod", division: "Technical" });
    const bod = await owner.query(api.dashboard.members, { ...everyone, filters: { community: ["bod" as const] } });
    expect(bod.rows.map((row) => [row.email, row.memberType, row.division])).toEqual([["member@example.com", "bod", "Technical"]]);
    expect((await owner.query(api.dashboard.members, { ...everyone, filters: { community: ["core" as const] } })).rows).toHaveLength(0);
    expect(await owner.query(api.dashboard.stats)).toMatchObject({ bod: 1, core: 0 });
    await owner.mutation(api.dashboard.setMemberType, { ownerId: member.id, memberType: "member", division: "Technical" });
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ memberType: "member", division: null });
  });
});

describe("staff correcting a member's profile (#235)", () => {
  const values = { fullName: "Rania Putri", institutionKind: "campus" as const, campus: "IPB University", studyProgram: "Ilmu Komputer", instagram: "rania" };
  const logRows = (t: ReturnType<typeof setup>) => t.run((ctx) => ctx.db.query("accessLog").collect()).then((rows) => rows.filter((row) => row.change === "profile"));
  const profileOf = (t: ReturnType<typeof setup>, ownerId: string) => t.run((ctx) => ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique());

  async function people() {
    const t = setup();
    const owner = await account(t, "owner@example.com", { name: "Pemilik" });
    const admin = await account(t, "admin@example.com", { name: "Admin Satu" });
    const other = await account(t, "other-admin@example.com", { name: "Admin Dua" });
    const member = await account(t, "member@example.com", { name: "Rania" });
    const fresh = await account(t, "fresh@example.com", { onboarded: false });
    for (const id of [admin.id, other.id]) await owner.mutation(api.dashboard.setRole, { ownerId: id, role: "admin" });
    return { t, owner, admin, other, member, fresh };
  }

  it("lets an admin correct a member, normalised like onboarding, and logs which fields changed", async () => {
    const { t, owner, admin, member } = await people();
    await expect(member.mutation(api.dashboard.correctProfile, { ownerId: member.id, revision: 4, values })).rejects.toThrow("hanya untuk admin");
    expect(await admin.query(api.dashboard.member, { ownerId: member.id })).toMatchObject({ revision: 4, institutionKind: null });
    expect(await admin.mutation(api.dashboard.correctProfile, { ownerId: member.id, revision: 4, values: { ...values, fullName: " Rania   Putri ", instagram: "@Rania" } })).toEqual({ revision: 5 });
    const profile = await profileOf(t, member.id);
    expect(profile).toMatchObject({ fullName: "Rania Putri", institutionKind: "campus", instagram: "rania", revision: 5, instagramChangedAt: expect.any(Number) });
    const [row] = await logRows(t);
    expect(row).toMatchObject({ actorId: admin.id, targetId: member.id, from: "fullName,institutionKind,instagram", to: "fullName,institutionKind,instagram", at: expect.any(Number) });
    // The log keeps which fields, never the values.
    expect(JSON.stringify(row)).not.toMatch(/Rania|rania/);
    const [entry] = (await owner.query(api.dashboard.accessLog, { ownerId: member.id, paginationOpts: page })).page;
    expect(entry).toMatchObject({ change: "profile", actor: "Admin Satu", target: "Rania Putri" });
    // The member's own edits are not logged.
    await member.mutation(api.members.updateProfile, { revision: 5, values: { ...values, studyProgram: "Statistika" } });
    expect(await logRows(t)).toHaveLength(1);
  });

  it("follows the member hierarchy: admins correct members, owners also admins, no one an owner or themselves", async () => {
    const { t, owner, admin, other, member, fresh } = await people();
    await expect(admin.mutation(api.dashboard.correctProfile, { ownerId: other.id, revision: 4, values })).rejects.toThrow("Hanya pemilik");
    await expect(admin.mutation(api.dashboard.correctProfile, { ownerId: owner.id, revision: 4, values })).rejects.toThrow("Profil pemilik");
    await expect(admin.mutation(api.dashboard.correctProfile, { ownerId: admin.id, revision: 4, values })).rejects.toThrow("halaman Profil");
    await expect(owner.mutation(api.dashboard.correctProfile, { ownerId: owner.id, revision: 4, values })).rejects.toThrow("halaman Profil");
    await expect(owner.mutation(api.dashboard.correctProfile, { ownerId: fresh.id, revision: 4, values })).rejects.toThrow("tidak ditemukan");
    expect(await logRows(t)).toHaveLength(0);
    await owner.mutation(api.dashboard.correctProfile, { ownerId: other.id, revision: 4, values: { ...values, fullName: "Admin Dua Benar" } });
    await owner.mutation(api.dashboard.correctProfile, { ownerId: member.id, revision: 4, values });
    expect((await logRows(t)).map((row) => [row.actorId, row.targetId])).toEqual([[owner.id, other.id], [owner.id, member.id]]);
    // A deactivated member can still be corrected.
    await owner.mutation(api.dashboard.setActive, { ownerId: member.id, active: false });
    await admin.mutation(api.dashboard.correctProfile, { ownerId: member.id, revision: 5, values: { ...values, campus: "Universitas Pakuan" } });
    expect(await profileOf(t, member.id)).toMatchObject({ campus: "Universitas Pakuan" });
  });

  it("refuses a stale revision and answers onboarding refuses, and logs nothing for no change", async () => {
    const { t, admin, member } = await people();
    await member.mutation(api.members.updateProfile, { revision: 4, values });
    await expect(admin.mutation(api.dashboard.correctProfile, { ownerId: member.id, revision: 4, values: { ...values, fullName: "Tab Lama" } })).rejects.toThrow("Profil berubah di tab atau perangkat lain");
    await expect(admin.mutation(api.dashboard.correctProfile, { ownerId: member.id, revision: 5, values: { ...values, instagram: "a..b" } })).rejects.toThrow("Periksa isian");
    await expect(admin.mutation(api.dashboard.correctProfile, { ownerId: member.id, revision: 5, values: { ...values, fullName: "" } })).rejects.toThrow("Periksa isian");
    expect(await admin.mutation(api.dashboard.correctProfile, { ownerId: member.id, revision: 5, values })).toEqual({ revision: 5 });
    expect(await logRows(t)).toHaveLength(0);
    expect(await profileOf(t, member.id)).toMatchObject({ fullName: "Rania Putri", revision: 5 });
  });

  it("leaves nothing personal behind when the account is deleted, with the same counts", async () => {
    const { t, owner, admin, member } = await people();
    await member.mutation(api.members.updateProfile, { revision: 4, values });
    await admin.mutation(api.dashboard.correctProfile, { ownerId: member.id, revision: 5, values: { ...values, instagram: "rania.putri" } });
    expect(await owner.mutation(api.dashboard.deleteAccount, { ownerId: member.id, confirmName: "Rania Putri" })).toEqual({
      appreciations: 0, appreciationReviews: 0, submissions: 0, submissionReviews: 0, files: 0, gameRuns: 0, gameBests: 0, reviewerGrants: 0, sessions: 1, accounts: 0, enrolments: 0, mentorGrants: 0, cards: 0, checkIns: 0, helperGrants: 0, techSupportRequests: 0, photos: 0, leagueTeams: 0, flagSolves: 0, flagAttempts: 0,
    });
    // The profile with its Instagram time is gone; the correction's log row keeps the account ID and field names only.
    expect(await profileOf(t, member.id)).toBeNull();
    const [row] = await logRows(t);
    expect(row).toMatchObject({ targetId: member.id, from: "instagram", to: "instagram" });
    const [entry] = (await owner.query(api.dashboard.accessLog, { ownerId: member.id, paginationOpts: page })).page.filter((item) => item.change === "profile");
    expect(entry).toMatchObject({ actor: "Admin Satu", target: null });
  });
});
