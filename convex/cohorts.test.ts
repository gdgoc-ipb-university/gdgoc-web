/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { catalystCohort } from "../src/lib/cohort";

const modules = import.meta.glob("./**/*.ts");
const page = { numItems: 20, cursor: null };
const hour = 3600000;

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
type Test = ReturnType<typeof setup>;
async function account(t: Test, email: string, { verified = true, onboarded = true } = {}) {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name: email.split("@")[0], email, emailVerified: verified, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: Date.now() + 7 * 24 * hour, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  if (onboarded) await t.run((ctx) => ctx.db.insert("memberProfiles", {
    ownerId: user._id, fullName: `Nama ${email.split("@")[0]}`, campus: "SMK Negeri 1 Bogor", studyProgram: "RPL",
    nextStep: 4, revision: 4, updatedAt: Date.now(), completedAt: Date.now(), memberType: "member",
  }));
  return Object.assign(t.withIdentity({ subject: user._id, sessionId: session._id, email }), { id: user._id as string });
}
const enrol = (t: Test, cohortId: Id<"cohorts">, email: string, role: string, extra: { ownerId?: string; status?: "active" | "withdrawn" } = {}) =>
  t.run((ctx) => ctx.db.insert("enrolments", { cohortId, email, name: email.split("@")[0], role, status: "active", importedAt: Date.now(), importedBy: "test", ...extra }));
const mentor = (t: Test, cohortId: Id<"cohorts">, ownerId: string, role: string) =>
  t.run((ctx) => ctx.db.insert("cohortMentors", { cohortId, ownerId, role, addedBy: "test", addedAt: Date.now() }));
/** A published assignment for one cohort, created by staff and then scoped like the editor in #105 will. */
async function cohortTask(t: Test, owner: Awaited<ReturnType<typeof account>>, cohortId: Id<"cohorts">, title: string, cohortRoles?: string[]) {
  const dueAt = new Date(Date.now() + 48 * hour).toISOString().slice(0, 16);
  const id = await owner.mutation(api.assignments.create, { values: { title, description: "Kerjakan.", dueAt }, publish: true });
  await t.run((ctx) => ctx.db.patch(id, { cohortId, ...(cohortRoles ? { cohortRoles } : {}) }));
  return id;
}

async function world() {
  const t = setup();
  const owner = await account(t, "owner@example.com");
  const hacker = await account(t, "hacker@example.com");
  const hustler = await account(t, "hustler@example.com");
  const outsider = await account(t, "member@example.com");
  const hackerMentor = await account(t, "mentor-hacker@example.com");
  const cohort = await t.mutation(internal.cohorts.seedCatalyst, {});
  await enrol(t, cohort, "hacker@example.com", "hacker");
  await enrol(t, cohort, "hustler@example.com", "hustler");
  await mentor(t, cohort, hackerMentor.id, "hacker");
  for (const caller of [hacker, hustler]) await caller.mutation(api.cohorts.claimMine, {});
  const hackerTask = await cohortTask(t, owner, cohort, "Tugas Hacker", ["hacker"]);
  const allTask = await cohortTask(t, owner, cohort, "Tugas semua peran");
  return { t, owner, hacker, hustler, outsider, hackerMentor, cohort, hackerTask, allTask };
}
const titles = async (caller: { query: Test["query"] }) => (await caller.query(api.assignments.list, {})).map((item) => item.title).sort();

beforeEach(() => vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com"));
afterEach(() => vi.unstubAllEnvs());

describe("cohorts", () => {
  it("creates and edits cohorts for staff, refusing taken slugs and roles still in use", async () => {
    const t = setup();
    const owner = await account(t, "owner@example.com");
    const id = await owner.mutation(api.cohorts.create, { values: { slug: "", name: "Member Intake 2027", roles: [{ key: "member", name: "Member" }] } });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ slug: "member-intake-2027", status: "setup" });
    await expect(owner.mutation(api.cohorts.create, { values: { slug: "member-intake-2027", name: "Lagi", roles: [{ key: "a", name: "A" }] } })).rejects.toThrow("sudah dipakai");
    await expect(owner.mutation(api.cohorts.create, { values: { slug: "x", name: "X", roles: [] } })).rejects.toThrow("Lengkapi isian");

    await enrol(t, id, "a@example.com", "member");
    const renamed = { slug: "member-intake-2027", name: "Member Intake 2027", roles: [{ key: "member", name: "Anggota" }, { key: "lead", name: "Lead" }] };
    await owner.mutation(api.cohorts.update, { id, values: renamed, status: "active" });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ status: "active", roles: renamed.roles });
    await expect(owner.mutation(api.cohorts.update, { id, values: { ...renamed, roles: [{ key: "lead", name: "Lead" }] }, status: "active" })).rejects.toThrow("masih dipakai");
    // An unused role can go.
    await owner.mutation(api.cohorts.update, { id, values: { ...renamed, roles: [{ key: "member", name: "Anggota" }] }, status: "active" });
  });

  it("seeds Catalyst once", async () => {
    const t = setup();
    const first = await t.mutation(internal.cohorts.seedCatalyst, {});
    expect(await t.mutation(internal.cohorts.seedCatalyst, {})).toBe(first);
    expect(await t.run((ctx) => ctx.db.get(first))).toMatchObject({ slug: catalystCohort.slug, roles: catalystCohort.roles, attendanceTarget: 0.7 });
  });

  it("claims enrolments for the caller's verified email only, ignoring case, and never moves a claimed row", async () => {
    const t = setup();
    const cohort = await t.mutation(internal.cohorts.seedCatalyst, {});
    await enrol(t, cohort, "rania@example.com", "hipster");
    const rania = await account(t, "Rania@Example.com", { verified: false, onboarded: false });
    expect(await rania.mutation(api.cohorts.claimMine, {})).toBe(0);
    await t.mutation(components.betterAuth.adapter.updateOne, { input: { model: "user", where: [{ field: "_id", operator: "eq", value: rania.id }], update: { emailVerified: true } } });
    expect(await rania.mutation(api.cohorts.claimMine, {})).toBe(1);
    expect(await rania.mutation(api.cohorts.claimMine, {})).toBe(0);
    const row = await t.run((ctx) => ctx.db.query("enrolments").first());
    expect(row).toMatchObject({ ownerId: rania.id });
    expect(row?.claimedAt).toBeTypeOf("number");
    // A row already linked to one account stays with it, whoever signs in with its address later.
    const budi = await account(t, "budi@example.com");
    const linked = await enrol(t, cohort, "budi@example.com", "hacker", { ownerId: rania.id });
    expect(await budi.mutation(api.cohorts.claimMine, {})).toBe(0);
    expect(await t.run((ctx) => ctx.db.get(linked))).toMatchObject({ ownerId: rania.id });
  });

  it("gives cohort assignments only to claimed, active participants in their roles", async () => {
    const { t, owner, hacker, hustler, outsider, cohort, hackerTask } = await world();
    expect(await titles(hacker)).toEqual(["Tugas Hacker", "Tugas semua peran"]);
    expect(await titles(hustler)).toEqual(["Tugas semua peran"]);
    expect(await titles(outsider)).toEqual([]);
    expect(await titles(owner)).toEqual(["Tugas Hacker", "Tugas semua peran"]);
    expect(await hustler.query(api.assignments.get, { id: hackerTask })).toBeNull();
    await expect(hustler.mutation(api.assignments.submit, { assignmentId: hackerTask, revision: 0, answer: "Halo", fileIds: [] })).rejects.toThrow("tidak ditemukan");
    await hacker.mutation(api.assignments.submit, { assignmentId: hackerTask, revision: 0, answer: "Selesai", fileIds: [] });

    // Imported but never signed in: nothing reaches the account that later uses another email.
    await enrol(t, cohort, "belum@example.com", "hacker");
    const other = await account(t, "lain@example.com");
    await other.mutation(api.cohorts.claimMine, {});
    expect(await titles(other)).toEqual([]);

    // Withdrawn: the row and submission stay, the assignments go.
    await t.run(async (ctx) => {
      const row = await ctx.db.query("enrolments").withIndex("by_owner", (q) => q.eq("ownerId", hacker.id)).unique();
      await ctx.db.patch(row!._id, { status: "withdrawn", withdrawnAt: Date.now(), withdrawnBy: "test" });
    });
    expect(await titles(hacker)).toEqual([]);
    expect(await hacker.query(api.assignments.get, { id: hackerTask })).toBeNull();
    expect((await owner.query(api.assignments.submissions, { id: hackerTask, paginationOpts: page })).page).toHaveLength(1);
  });

  it("lets a role's mentors review that role's assignments, without emails or management", async () => {
    const { t, hacker, hackerMentor, cohort, hackerTask, allTask } = await world();
    await hacker.mutation(api.assignments.submit, { assignmentId: hackerTask, revision: 0, answer: "Selesai", fileIds: [] });
    const submissions = await hackerMentor.query(api.assignments.submissions, { id: hackerTask, paginationOpts: page });
    expect(submissions.page).toHaveLength(1);
    expect(submissions.page[0].email).toBe("");
    const view = await hackerMentor.query(api.assignments.get, { id: hackerTask });
    expect(view).toMatchObject({ canReview: true, canManage: false });
    const submission = submissions.page[0];
    await hackerMentor.mutation(api.assignments.review, { submissionId: submission._id, submissionRevision: submission.revision, score: 90, feedback: "Rapi." });
    expect((await hackerMentor.query(api.assignments.reviewing, {})).map((item) => item.title).sort()).toEqual(["Tugas Hacker", "Tugas semua peran"]);
    // Mentors are not participants: they review but do not get the tasks to submit.
    expect(await titles(hackerMentor)).toEqual([]);
    await expect(hackerMentor.mutation(api.assignments.update, { id: hackerTask, revision: 0, values: { title: "Ubah", description: "x", dueAt: new Date(Date.now() + 9 * hour).toISOString().slice(0, 16) } })).rejects.toThrow("hanya untuk admin");

    // A Hustler mentor gets the all-roles task but not the Hacker one.
    const hustlerMentor = await account(t, "mentor-hustler@example.com");
    await mentor(t, cohort, hustlerMentor.id, "hustler");
    expect((await hustlerMentor.query(api.assignments.reviewing, {})).map((item) => item.title)).toEqual(["Tugas semua peran"]);
    await expect(hustlerMentor.query(api.assignments.submissions, { id: hackerTask, paginationOpts: page })).rejects.toThrow("penilai tugas ini");
    expect((await hustlerMentor.query(api.assignments.submissions, { id: allTask, paginationOpts: page })).page).toHaveLength(0);
  });

  it("counts a cohort assignment's missing submissions from its participants, not community tags", async () => {
    const { owner, hacker, hackerTask, allTask } = await world();
    expect(await owner.query(api.assignments.missing, { id: hackerTask })).toMatchObject({ active: 1, submitted: 0, missing: [{ name: "Nama hacker", email: "hacker@example.com" }] });
    await hacker.mutation(api.assignments.submit, { assignmentId: allTask, revision: 0, answer: "Selesai", fileIds: [] });
    const all = await owner.query(api.assignments.missing, { id: allTask });
    expect(all).toMatchObject({ active: 2, submitted: 1 });
    expect(all.missing.map((row) => row.name)).toEqual(["Nama hustler"]);
  });

  it("deletes an account's enrolments, unclaimed ones for its email, and mentor grants", async () => {
    const { t, owner, hacker, hackerMentor } = await world();
    // The claimed Catalyst enrolment, plus a still-unclaimed one for the same email in another cohort.
    const intake = await owner.mutation(api.cohorts.create, { values: { slug: "intake", name: "Intake", roles: [{ key: "member", name: "Member" }] } });
    await enrol(t, intake, "hacker@example.com", "member");
    const counts = await owner.mutation(api.dashboard.deleteAccount, { ownerId: hacker.id, confirmName: "Nama hacker" });
    expect(counts).toMatchObject({ enrolments: 2, mentorGrants: 0 });
    expect(await owner.mutation(api.dashboard.deleteAccount, { ownerId: hackerMentor.id, confirmName: "Nama mentor-hacker" })).toMatchObject({ enrolments: 0, mentorGrants: 1 });
    const left = await t.run(async (ctx) => ({
      byEmail: await ctx.db.query("enrolments").withIndex("by_email", (q) => q.eq("email", "hacker@example.com")).collect(),
      mentors: await ctx.db.query("cohortMentors").collect(),
    }));
    expect(left).toEqual({ byEmail: [], mentors: [] });
  });
});
