/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const page = { numItems: 20, cursor: null };
const everyone = { search: "", filter: "all" as const, paginationOpts: page };

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
    nextStep: 4, revision: 4, updatedAt: Date.now(), ...(onboarded ? { completedAt: Date.now() } : {}),
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
    const admins = await member.query(api.dashboard.members, { ...everyone, filter: "admin" });
    expect(admins.page.map((row) => row.email)).toEqual(["member@example.com"]);
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
    const rows = (await owner.query(api.dashboard.members, everyone)).page;
    expect(rows.map((row) => [row.email, row.role]).sort()).toEqual([["member@example.com", "member"], ["owner@example.com", "owner"]]);
    expect(await owner.query(api.dashboard.stats)).toEqual({ members: 2, admins: 0, reviewers: 0, core: 0, bod: 0, deactivated: 0 });
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
      appreciations: 1, appreciationReviews: 1, submissions: 1, submissionReviews: 1, files: 2, gameRuns: 1, gameBests: 1, reviewerGrants: 1, sessions: 1, accounts: 0,
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
    expect((await owner.query(api.dashboard.members, { ...everyone, filter: "reviewer" })).page.map((row) => [row.email, row.reviewer])).toEqual([["member@example.com", true]]);
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
    expect((await owner.query(api.dashboard.members, { ...everyone, filter: "deactivated" })).page.map((row) => row.email)).toEqual(["member@example.com"]);

    await admin.mutation(api.dashboard.setActive, { ownerId: member.id, active: true });
    expect(await member.query(api.assignments.list)).toEqual([]);
  });

  it("finds members by name", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com");
    await account(t, "a@example.com", { name: "Rania Putri" });
    await account(t, "b@example.com", { name: "Bima Sakti" });
    const found = await owner.query(api.dashboard.members, { ...everyone, search: "rania" });
    expect(found.page.map((row) => row.fullName)).toEqual(["Rania Putri"]);
  });
  it("lets staff correct a member's community role and filter the core team", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com");
    const member = await account(t, "member@example.com");
    await expect(member.mutation(api.dashboard.setMemberType, { ownerId: owner.id, memberType: "core", division: "Technical" })).rejects.toThrow("hanya untuk admin");
    await expect(owner.mutation(api.dashboard.setMemberType, { ownerId: member.id, memberType: "core", division: "" })).rejects.toThrow("Pilih divisimu");
    await owner.mutation(api.dashboard.setMemberType, { ownerId: member.id, memberType: "core", division: "Community & External" });
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ memberType: "core", division: "Community & External" });
    const core = await owner.query(api.dashboard.members, { ...everyone, filter: "core" });
    expect(core.page.map((row) => [row.email, row.division])).toEqual([["member@example.com", "Community & External"]]);
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
    const bod = await owner.query(api.dashboard.members, { ...everyone, filter: "bod" });
    expect(bod.page.map((row) => [row.email, row.memberType, row.division])).toEqual([["member@example.com", "bod", "Technical"]]);
    expect((await owner.query(api.dashboard.members, { ...everyone, filter: "core" })).page).toHaveLength(0);
    expect(await owner.query(api.dashboard.stats)).toMatchObject({ bod: 1, core: 0 });
    await owner.mutation(api.dashboard.setMemberType, { ownerId: member.id, memberType: "member", division: "Technical" });
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ memberType: "member", division: null });
  });
});
