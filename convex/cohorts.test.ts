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
const dueAt = () => new Date(Date.now() + 48 * hour).toISOString().slice(0, 16);
/** A published assignment for one cohort, from the editor's "Untuk" (every role when none are given). */
async function cohortTask(owner: Awaited<ReturnType<typeof account>>, cohortId: Id<"cohorts">, title: string, cohortRoles = ["hacker", "hipster", "hustler"]) {
  return owner.mutation(api.assignments.create, { values: { title, description: "Kerjakan.", dueAt: dueAt(), cohortId, cohortRoles }, publish: true });
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
  const hackerTask = await cohortTask(owner, cohort, "Tugas Hacker", ["hacker"]);
  const allTask = await cohortTask(owner, cohort, "Tugas semua peran");
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

  it("counts participants who have not signed in as missing, with their email for staff only", async () => {
    const { t, owner, hackerMentor, cohort, hackerTask } = await world();
    await enrol(t, cohort, "belum@example.com", "hacker");
    await enrol(t, cohort, "keluar@example.com", "hacker", { status: "withdrawn" });
    const staff = await owner.query(api.assignments.missing, { id: hackerTask });
    expect(staff).toMatchObject({ active: 2, submitted: 0 });
    expect(staff.missing.map((row) => [row.name, row.email, row.unclaimed])).toEqual([["belum", "belum@example.com", true], ["Nama hacker", "hacker@example.com", false]]);
    const mentorView = await hackerMentor.query(api.assignments.missing, { id: hackerTask });
    expect(mentorView.missing.map((row) => [row.name, row.email])).toEqual([["belum", ""], ["Nama hacker", ""]]);
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

describe("roster and import (#104)", () => {
  async function staffWithCohort() {
    const t = setup();
    const owner = await account(t, "owner@example.com");
    const cohort = await t.mutation(internal.cohorts.seedCatalyst, {});
    return { t, owner, cohort };
  }
  const log = (t: Test) => t.run((ctx) => ctx.db.query("accessLog").collect());

  it("adds new participants, links existing accounts at once, updates known emails, and keeps withdrawn ones withdrawn", async () => {
    const { t, owner, cohort } = await staffWithCohort();
    const member = await account(t, "rania@example.com");
    expect(await owner.mutation(api.cohorts.importEnrolments, { cohortId: cohort, rows: [
      { email: " Rania@Example.com", name: "Rania  Putri", role: "hipster" }, { email: "budi@example.com", name: "Budi", role: "hacker" },
    ] })).toEqual({ added: 2, updated: 0, unchanged: 0, linked: 1 });
    const roster = await owner.query(api.cohorts.roster, { slug: "catalyst-2026" });
    expect(roster?.rows.map((row) => [row.email, row.name, row.role, row.ownerId === member.id, row.fullName]).sort()).toEqual([
      ["budi@example.com", "Budi", "hacker", false, null], ["rania@example.com", "Rania Putri", "hipster", true, "Nama rania"],
    ]);

    const budi = roster!.rows.find((row) => row.email === "budi@example.com")!;
    await owner.mutation(api.cohorts.setStatus, { id: budi._id, status: "withdrawn" });
    expect(await owner.mutation(api.cohorts.importEnrolments, { cohortId: cohort, rows: [
      { email: "rania@example.com", name: "Rania Putri", role: "hipster" }, { email: "budi@example.com", name: "Budi Santoso", role: "hustler" },
    ] })).toEqual({ added: 0, updated: 1, unchanged: 1, linked: 0 });
    expect(await t.run((ctx) => ctx.db.get(budi._id))).toMatchObject({ name: "Budi Santoso", role: "hustler", status: "withdrawn" });
    expect((await log(t)).map((row) => [row.change, row.from, row.to, row.targetId])).toEqual([
      ["enrolmentStatus", "active", "withdrawn", ""], ["enrolmentRole", "hacker", "hustler", ""],
    ]);
    expect(await owner.query(api.cohorts.list, {})).toMatchObject([{ slug: "catalyst-2026", active: 1, claimed: 1, withdrawn: 1 }]);
  });

  it("refuses bad rows, repeated emails, roles outside the cohort, and oversized batches", async () => {
    const { owner, cohort } = await staffWithCohort();
    const row = { email: "a@example.com", name: "A", role: "hacker" };
    await expect(owner.mutation(api.cohorts.importEnrolments, { cohortId: cohort, rows: [{ ...row, email: "a@example" }] })).rejects.toThrow("tidak valid");
    await expect(owner.mutation(api.cohorts.importEnrolments, { cohortId: cohort, rows: [row, { ...row, email: "A@example.com" }] })).rejects.toThrow("lebih dari sekali");
    await expect(owner.mutation(api.cohorts.importEnrolments, { cohortId: cohort, rows: [{ ...row, name: " " }] })).rejects.toThrow("Nama");
    await expect(owner.mutation(api.cohorts.importEnrolments, { cohortId: cohort, rows: [{ ...row, role: "mentor" }] })).rejects.toThrow("tidak ada");
    const many = Array.from({ length: 201 }, (_, i) => ({ email: `p${i}@example.com`, name: `P${i}`, role: "hacker" }));
    await expect(owner.mutation(api.cohorts.importEnrolments, { cohortId: cohort, rows: many })).rejects.toThrow("Maksimal 200");
  });

  it("changes a role, withdraws and restores, and corrects an email by relinking, each in the access log", async () => {
    const { t, owner, cohort } = await staffWithCohort();
    const wrong = await account(t, "rania.lain@example.com");
    const right = await account(t, "rania@example.com");
    await owner.mutation(api.cohorts.importEnrolments, { cohortId: cohort, rows: [{ email: "rania.lain@example.com", name: "Rania", role: "hacker" }, { email: "budi@example.com", name: "Budi", role: "hacker" }] });
    const id = (await t.run((ctx) => ctx.db.query("enrolments").withIndex("by_email", (q) => q.eq("email", "rania.lain@example.com")).unique()))!._id;
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ ownerId: wrong.id });

    await owner.mutation(api.cohorts.setRole, { id, role: "hustler" });
    await owner.mutation(api.cohorts.setRole, { id, role: "hustler" }); // no change, no log row
    await expect(owner.mutation(api.cohorts.setRole, { id, role: "mentor" })).rejects.toThrow("tidak ada");
    await owner.mutation(api.cohorts.setStatus, { id, status: "withdrawn" });
    await owner.mutation(api.cohorts.setStatus, { id, status: "active" });
    const restored = await t.run((ctx) => ctx.db.get(id));
    expect(restored?.status).toBe("active");
    expect(restored?.withdrawnAt).toBeUndefined();
    await expect(owner.mutation(api.cohorts.setEmail, { id, email: "budi@example.com" })).rejects.toThrow("sudah terdaftar");
    expect(await owner.mutation(api.cohorts.setEmail, { id, email: "Rania@Example.com" })).toEqual({ linked: true });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ email: "rania@example.com", ownerId: right.id });
    // An address without an account yet unlinks the row until someone signs in with it.
    expect(await owner.mutation(api.cohorts.setEmail, { id, email: "baru@example.com" })).toEqual({ linked: false });
    expect((await t.run((ctx) => ctx.db.get(id)))?.ownerId).toBeUndefined();

    const entries = (await owner.query(api.dashboard.accessLog, { paginationOpts: page })).page.reverse();
    expect(entries.map((row) => [row.change, row.from, row.to])).toEqual([
      ["enrolmentRole", "hacker", "hustler"], ["enrolmentStatus", "active", "withdrawn"], ["enrolmentStatus", "withdrawn", "active"],
      ["enrolmentEmail", "email", "email"], ["enrolmentEmail", "email", "email"],
    ]);
    expect(entries[0]).toMatchObject({ target: "Nama rania.lain", cohort: { name: "GDGoC Catalyst 2026/27", slug: "catalyst-2026" } });
    expect(entries[4]).toMatchObject({ targetId: right.id, target: "Nama rania" });
  });

  it("names an unclaimed participant in the log by their oprec name", async () => {
    const { t, owner, cohort } = await staffWithCohort();
    await owner.mutation(api.cohorts.importEnrolments, { cohortId: cohort, rows: [{ email: "citra@example.com", name: "Citra Dewi", role: "hacker" }] });
    const id = (await t.run((ctx) => ctx.db.query("enrolments").first()))!._id;
    await owner.mutation(api.cohorts.setRole, { id, role: "hipster" });
    expect((await owner.query(api.dashboard.accessLog, { paginationOpts: page })).page[0]).toMatchObject({ targetId: "", target: "Citra Dewi" });
  });

  it("tells an accepted applicant their program and role before onboarding, and nobody else", async () => {
    const { t, owner, cohort } = await staffWithCohort();
    await owner.mutation(api.cohorts.importEnrolments, { cohortId: cohort, rows: [{ email: "dina@example.com", name: "Dina", role: "hustler" }] });
    const dina = await account(t, "dina@example.com", { onboarded: false });
    const other = await account(t, "lain@example.com", { onboarded: false });
    expect(await dina.query(api.cohorts.myInvitation, {})).toEqual({ cohort: "GDGoC Catalyst 2026/27", role: "Hustler" });
    expect(await other.query(api.cohorts.myInvitation, {})).toBeNull();
    expect(await t.query(api.cohorts.myInvitation, {})).toBeNull();
    const id = (await t.run((ctx) => ctx.db.query("enrolments").first()))!._id;
    await owner.mutation(api.cohorts.setStatus, { id, status: "withdrawn" });
    expect(await dina.query(api.cohorts.myInvitation, {})).toBeNull();
  });

  it("exports active participants for Bevy to owners only, with the profile name once signed in", async () => {
    const { t, owner, cohort } = await staffWithCohort();
    const admin = await account(t, "admin@example.com");
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
    await account(t, "rania@example.com");
    await owner.mutation(api.cohorts.importEnrolments, { cohortId: cohort, rows: [
      { email: "rania@example.com", name: "Rania P", role: "hacker" }, { email: "budi@example.com", name: "Budi", role: "hipster" }, { email: "eka@example.com", name: "Eka", role: "hustler" },
    ] });
    const eka = (await t.run((ctx) => ctx.db.query("enrolments").withIndex("by_email", (q) => q.eq("email", "eka@example.com")).unique()))!._id;
    await owner.mutation(api.cohorts.setStatus, { id: eka, status: "withdrawn" });
    expect((await owner.query(api.cohorts.exportBevy, { cohortId: cohort })).sort((a, b) => a.email.localeCompare(b.email))).toEqual([
      { email: "budi@example.com", name: "Budi" }, { email: "rania@example.com", name: "Nama rania" },
    ]);
    await expect(admin.query(api.cohorts.exportBevy, { cohortId: cohort })).rejects.toThrow("Hanya pemilik");
  });

  it("returns null for an unknown cohort", async () => {
    const { owner } = await staffWithCohort();
    expect(await owner.query(api.cohorts.roster, { slug: "tidak-ada" })).toBeNull();
  });
});

describe("role tasks and mentors (#105)", () => {
  it("targets a cohort and its roles from the editor, checked against the cohort", async () => {
    const { t, owner, cohort, hackerTask, allTask } = await world();
    const stored = async (id: Id<"assignments">) => t.run(async (ctx) => { const doc = (await ctx.db.get(id))!; return [doc.cohortId ?? null, doc.cohortRoles ?? null]; });
    expect(await stored(hackerTask)).toEqual([cohort, ["hacker"]]);
    // Every role is stored as none, which means all of them.
    expect(await stored(allTask)).toEqual([cohort, null]);
    const values = { title: "Tugas", description: "Kerjakan.", dueAt: dueAt(), cohortId: cohort };
    await expect(owner.mutation(api.assignments.create, { values: { ...values, cohortRoles: [] }, publish: false })).rejects.toThrow("Lengkapi");
    await expect(owner.mutation(api.assignments.create, { values: { ...values, cohortRoles: ["designer"] }, publish: false })).rejects.toThrow("tidak ada di GDGoC Catalyst");

    // An edit without a target (a tab from before cohorts) keeps it; null moves the task back to community tags.
    const revision = async () => t.run(async (ctx) => (await ctx.db.get(hackerTask))!.revision);
    await owner.mutation(api.assignments.update, { id: hackerTask, revision: await revision(), values: { title: "Tugas Hacker", description: "Kerjakan lagi.", dueAt: dueAt() } });
    expect(await stored(hackerTask)).toEqual([cohort, ["hacker"]]);
    await owner.mutation(api.assignments.update, { id: hackerTask, revision: await revision(), values: { title: "Tugas Hacker", description: "Kerjakan lagi.", dueAt: dueAt(), cohortId: cohort, cohortRoles: ["hacker", "hipster"] } });
    expect(await stored(hackerTask)).toEqual([cohort, ["hacker", "hipster"]]);
    await owner.mutation(api.assignments.update, { id: hackerTask, revision: await revision(), values: { title: "Tugas Hacker", description: "Kerjakan lagi.", dueAt: dueAt(), audience: ["member"], cohortId: null } });
    expect(await stored(hackerTask)).toEqual([null, null]);

    // Staff see the target on the list.
    const listed = (await owner.query(api.assignments.adminList, { paginationOpts: page })).page.find((item) => item._id === allTask);
    expect(listed?.cohort).toMatchObject({ name: "GDGoC Catalyst 2026/27" });
  });

  it("shows a Hacker task only to Hackers, staff and Hacker mentors, who score it and ask for revisions without being added", async () => {
    const { t, owner, hacker, hustler, outsider, hackerMentor, cohort, hackerTask } = await world();
    const hipster = await account(t, "hipster@example.com");
    await enrol(t, cohort, "hipster@example.com", "hipster");
    await hipster.mutation(api.cohorts.claimMine, {});
    const hipsterMentor = await account(t, "mentor-hipster@example.com");
    await mentor(t, cohort, hipsterMentor.id, "hipster");

    for (const caller of [hustler, hipster, outsider, hipsterMentor]) expect(await caller.query(api.assignments.get, { id: hackerTask })).toBeNull();
    expect(await hacker.query(api.assignments.get, { id: hackerTask })).toMatchObject({ canReview: false });
    expect(await owner.query(api.assignments.get, { id: hackerTask })).toMatchObject({ canManage: true });
    expect(await hackerMentor.query(api.assignments.get, { id: hackerTask })).toMatchObject({ canReview: true, canManage: false, cohort: { name: "GDGoC Catalyst 2026/27" } });
    expect(await t.run(async (ctx) => (await ctx.db.get(hackerTask))!.reviewers ?? [])).toEqual([]);

    await hacker.mutation(api.assignments.submit, { assignmentId: hackerTask, revision: 0, answer: "Selesai", fileIds: [] });
    const [submission] = (await hackerMentor.query(api.assignments.submissions, { id: hackerTask, paginationOpts: page })).page;
    await hackerMentor.mutation(api.assignments.requestRevision, { submissionId: submission._id, submissionRevision: submission.revision, note: "Tambahkan README." });
    expect(await hacker.query(api.assignments.get, { id: hackerTask })).toMatchObject({ submission: { feedback: "Tambahkan README.", revisionRequestedAt: expect.any(Number) } });
    await hacker.mutation(api.assignments.submit, { assignmentId: hackerTask, revision: 1, answer: "Sudah ada README.", fileIds: [] });
    await hackerMentor.mutation(api.assignments.review, { submissionId: submission._id, submissionRevision: 2, score: 85, feedback: "Lengkap." });
    expect(await hacker.query(api.assignments.get, { id: hackerTask })).toMatchObject({ submission: { score: 85, reviewerName: "Nama mentor-hacker" } });

    // A Hacker mentor can neither see nor score a Hipster task.
    const hipsterTask = await cohortTask(owner, cohort, "Tugas Hipster", ["hipster"]);
    await hipster.mutation(api.assignments.submit, { assignmentId: hipsterTask, revision: 0, answer: "Desain", fileIds: [] });
    const hipsterSubmission = await t.run(async (ctx) => (await ctx.db.query("assignmentSubmissions").withIndex("by_assignment_owner", (q) => q.eq("assignmentId", hipsterTask).eq("ownerId", hipster.id)).unique())!);
    expect(await hackerMentor.query(api.assignments.get, { id: hipsterTask })).toBeNull();
    expect((await hackerMentor.query(api.assignments.reviewing, {})).map((item) => item.title)).not.toContain("Tugas Hipster");
    await expect(hackerMentor.query(api.assignments.submissions, { id: hipsterTask, paginationOpts: page })).rejects.toThrow("penilai tugas ini");
    await expect(hackerMentor.query(api.assignments.missing, { id: hipsterTask })).rejects.toThrow("penilai tugas ini");
    await expect(hackerMentor.mutation(api.assignments.review, { submissionId: hipsterSubmission._id, submissionRevision: 1, score: 10, feedback: "" })).rejects.toThrow("penilai tugas ini");
    await expect(hackerMentor.mutation(api.assignments.requestRevision, { submissionId: hipsterSubmission._id, submissionRevision: 1, note: "Ulang." })).rejects.toThrow("penilai tugas ini");
    expect((await hipsterMentor.query(api.assignments.submissions, { id: hipsterTask, paginationOpts: page })).page).toHaveLength(1);
  });

  it("lets staff add and remove a role's mentors by account, with the access log, and lists them on the roster", async () => {
    const { t, owner, hacker, outsider, hackerMentor, cohort } = await world();
    const set = (ownerId: string, role: string, on = true) => owner.mutation(api.cohorts.setMentor, { cohortId: cohort, ownerId, role, mentor: on });
    await set(outsider.id, "hustler");
    await set(outsider.id, "hustler"); // again: nothing changes
    expect((await owner.query(api.cohorts.roster, { slug: "catalyst-2026" }))!.mentors.map((row) => [row.name, row.role]).sort()).toEqual([["Nama member", "hustler"], ["Nama mentor-hacker", "hacker"]]);
    expect((await outsider.query(api.assignments.reviewing, {})).map((item) => item.title)).toEqual(["Tugas semua peran"]);

    await expect(set(outsider.id, "designer")).rejects.toThrow("tidak ada di");
    await expect(set(hacker.id, "hustler")).rejects.toThrow("tidak bisa menjadi mentornya");
    await expect(set(owner.id, "hacker")).rejects.toThrow("sudah bisa menilai");
    await expect(set("nobody", "hacker")).rejects.toThrow("tidak ditemukan");
    await owner.mutation(api.dashboard.setActive, { ownerId: hackerMentor.id, active: false });
    await expect(set(hackerMentor.id, "hipster")).rejects.toThrow("Aktifkan kembali");

    await set(outsider.id, "hustler", false);
    expect((await outsider.query(api.assignments.reviewing, {}))).toEqual([]);
    const log = await t.run((ctx) => ctx.db.query("accessLog").collect());
    expect(log.filter((row) => row.change === "cohortMentor").map((row) => [row.targetId, row.from, row.to, row.cohortId])).toEqual([[outsider.id, "off", "hustler", cohort], [outsider.id, "hustler", "off", cohort]]);
  });

  it("shows a mentor their roles' active participants by name only", async () => {
    const { t, hacker, outsider, hackerMentor, cohort } = await world();
    await enrol(t, cohort, "belum@example.com", "hacker");
    await enrol(t, cohort, "keluar@example.com", "hacker", { status: "withdrawn" });
    expect(await hackerMentor.query(api.cohorts.mentoring, {})).toEqual([
      { _id: cohort, name: "GDGoC Catalyst 2026/27", roles: [{ key: "hacker", name: "Hacker", participants: ["belum", "Nama hacker"] }] },
    ]);
    expect(await outsider.query(api.cohorts.mentoring, {})).toEqual([]);
    expect(await hacker.query(api.cohorts.mentoring, {})).toEqual([]);
  });
});

describe("teams (#107)", () => {
  async function teams() {
    const w = await world();
    const { t, owner, cohort } = w;
    const hipster = await account(t, "hipster@example.com");
    await enrol(t, cohort, "hipster@example.com", "hipster");
    await hipster.mutation(api.cohorts.claimMine, {});
    const unclaimed = await enrol(t, cohort, "belum@example.com", "hustler");
    const rows = await t.run((ctx) => ctx.db.query("enrolments").collect());
    const idOf = (email: string) => rows.find((row) => row.email === email)!._id;
    const create = (name: string) => owner.mutation(api.cohorts.createTeam, { cohortId: cohort, name });
    return { ...w, hipster, unclaimed, idOf, create };
  }

  it("creates and renames teams with names unique in the cohort, ignoring case", async () => {
    const { owner, create } = await teams();
    const one = await create("  Tim   Satu ");
    await create("Tim Dua");
    await expect(create("tim satu")).rejects.toThrow("sudah dipakai");
    await expect(create(" ")).rejects.toThrow("Isi nama tim");
    await owner.mutation(api.cohorts.renameTeam, { id: one, name: "TIM SATU" }); // its own name in other case is fine
    await expect(owner.mutation(api.cohorts.renameTeam, { id: one, name: "Tim Dua" })).rejects.toThrow("sudah dipakai");
    // Another cohort may reuse a name.
    const intake = await owner.mutation(api.cohorts.create, { values: { slug: "intake", name: "Intake", roles: [{ key: "member", name: "Member" }] } });
    await owner.mutation(api.cohorts.createTeam, { cohortId: intake, name: "Tim Dua" });
    expect((await owner.query(api.cohorts.roster, { slug: "catalyst-2026" }))!.teams.map((team) => team.name)).toEqual(["Tim Dua", "TIM SATU"]);
  });

  it("keeps each participant in one team, refuses other cohorts and withdrawn participants, and shows the team on the roster", async () => {
    const { t, owner, idOf, unclaimed, create } = await teams();
    const one = await create("Tim 1");
    const two = await create("Tim 2");
    const set = (email: string, teamId: Id<"teams"> | null) => owner.mutation(api.cohorts.setTeam, { id: idOf(email), teamId });
    await set("hacker@example.com", one);
    await set("hacker@example.com", two); // moves, never in both
    await owner.mutation(api.cohorts.setTeam, { id: unclaimed, teamId: one }); // not signed in yet is fine
    const roster = (await owner.query(api.cohorts.roster, { slug: "catalyst-2026" }))!;
    expect(Object.fromEntries(roster.rows.map((row) => [row.email, row.teamId]))).toMatchObject({ "hacker@example.com": two, "belum@example.com": one, "hipster@example.com": null });
    await set("hacker@example.com", null);
    expect(await t.run(async (ctx) => (await ctx.db.get(idOf("hacker@example.com")))!.teamId ?? null)).toBeNull();

    const intake = await owner.mutation(api.cohorts.create, { values: { slug: "intake", name: "Intake", roles: [{ key: "member", name: "Member" }] } });
    const elsewhere = await owner.mutation(api.cohorts.createTeam, { cohortId: intake, name: "Tim Lain" });
    await expect(set("hacker@example.com", elsewhere)).rejects.toThrow("bukan tim GDGoC Catalyst");
    await owner.mutation(api.cohorts.setStatus, { id: idOf("hipster@example.com"), status: "withdrawn" });
    await expect(set("hipster@example.com", one)).rejects.toThrow("Aktifkan kembali");
  });

  it("deletes a team by clearing its participants' team", async () => {
    const { t, owner, idOf, create } = await teams();
    const one = await create("Tim 1");
    await owner.mutation(api.cohorts.setTeam, { id: idOf("hacker@example.com"), teamId: one });
    await owner.mutation(api.cohorts.setTeam, { id: idOf("hustler@example.com"), teamId: one });
    await owner.mutation(api.cohorts.deleteTeam, { id: one });
    const left = await t.run(async (ctx) => ({ teams: await ctx.db.query("teams").collect(), members: await ctx.db.query("enrolments").withIndex("by_team", (q) => q.eq("teamId", one)).collect() }));
    expect(left).toEqual({ teams: [], members: [] });
    await expect(owner.mutation(api.cohorts.setTeam, { id: idOf("hacker@example.com"), teamId: one })).rejects.toThrow("Tim tidak ditemukan");
  });

  it("shows a participant their team and active teammates by name and role only", async () => {
    const { owner, hacker, hustler, hipster, outsider, idOf, unclaimed, create } = await teams();
    const one = await create("Tim Kopi");
    for (const id of [idOf("hacker@example.com"), idOf("hustler@example.com"), idOf("hipster@example.com"), unclaimed]) await owner.mutation(api.cohorts.setTeam, { id, teamId: one });
    expect(await hacker.query(api.cohorts.myTeams, {})).toEqual([{ _id: one, name: "Tim Kopi", cohort: "GDGoC Catalyst 2026/27", teammates: [
      { name: "belum", role: "Hustler" }, { name: "Nama hipster", role: "Hipster" }, { name: "Nama hustler", role: "Hustler" },
    ] }]);
    expect(JSON.stringify(await hacker.query(api.cohorts.myTeams, {}))).not.toContain("@");
    // A withdrawn teammate drops out; a withdrawn participant sees no team.
    await owner.mutation(api.cohorts.setStatus, { id: idOf("hustler@example.com"), status: "withdrawn" });
    expect((await hacker.query(api.cohorts.myTeams, {}))[0].teammates.map((row) => row.name)).toEqual(["belum", "Nama hipster"]);
    expect(await hustler.query(api.cohorts.myTeams, {})).toEqual([]);
    expect(await outsider.query(api.cohorts.myTeams, {})).toEqual([]);
    expect((await hipster.query(api.cohorts.myTeams, {}))[0].name).toBe("Tim Kopi");
  });
});

describe("participant overview (#106)", () => {
  it("shows a participant their cohort, role and open tasks for that role, without a team until staff assign one", async () => {
    const { t, owner, hacker, hustler, cohort, hackerTask } = await world();
    const hipsterTask = await cohortTask(owner, cohort, "Tugas Hipster", ["hipster"]);
    await owner.mutation(api.assignments.create, { values: { title: "Draft Hacker", description: "Nanti.", dueAt: dueAt(), cohortId: cohort, cohortRoles: ["hacker"] }, publish: false });
    const closed = await cohortTask(owner, cohort, "Tugas lama", ["hacker"]);
    await t.run((ctx) => ctx.db.patch(closed, { status: "closed" }));
    await t.run((ctx) => ctx.db.patch(hackerTask, { dueAt: Date.now() + 24 * hour })); // due first
    await hacker.mutation(api.assignments.submit, { assignmentId: hackerTask, revision: 0, answer: "Selesai", fileIds: [] });

    const [mine] = await hacker.query(api.cohorts.mine, {});
    expect(mine).toMatchObject({ cohort: { name: "GDGoC Catalyst 2026/27", slug: "catalyst-2026" }, role: { key: "hacker", name: "Hacker" }, team: null });
    expect(mine.tasks.map((task) => [task.title, task.submittedAt !== null])).toEqual([["Tugas Hacker", true], ["Tugas semua peran", false]]);
    expect(mine.tasks[0]).toMatchObject({ _id: hackerTask, slug: "tugas-hacker", late: false, revisionRequestedAt: null });
    // Another role's tasks, drafts and closed tasks stay out.
    expect((await hustler.query(api.cohorts.mine, {}))[0].tasks.map((task) => task.title)).toEqual(["Tugas semua peran"]);
    expect(JSON.stringify(await hacker.query(api.cohorts.mine, {}))).not.toContain(hipsterTask);
  });

  it("adds the team and teammates' names once assigned, with no emails or other participants' rows", async () => {
    const { t, owner, hacker, cohort } = await world();
    const team = await owner.mutation(api.cohorts.createTeam, { cohortId: cohort, name: "Tim Kopi" });
    await enrol(t, cohort, "hipster@example.com", "hipster");
    const rows = await t.run((ctx) => ctx.db.query("enrolments").collect());
    for (const email of ["hacker@example.com", "hustler@example.com", "hipster@example.com"]) {
      await owner.mutation(api.cohorts.setTeam, { id: rows.find((row) => row.email === email)!._id, teamId: team });
    }
    const mine = await hacker.query(api.cohorts.mine, {});
    expect(mine).toHaveLength(1);
    expect(mine[0].team).toEqual({ name: "Tim Kopi", teammates: [{ name: "hipster", role: "Hipster" }, { name: "Nama hustler", role: "Hustler" }] });
    expect(JSON.stringify(mine)).not.toContain("@");
    expect(Object.keys(mine[0]).sort()).toEqual(["_id", "cohort", "role", "tasks", "team"]);
  });

  it("is empty for a member who is not enrolled, a withdrawn participant, and a cohort that ended", async () => {
    const { owner, hacker, hustler, outsider, cohort } = await world();
    expect(await outsider.query(api.cohorts.mine, {})).toEqual([]);
    const rows = (await owner.query(api.cohorts.roster, { slug: "catalyst-2026" }))!.rows;
    await owner.mutation(api.cohorts.setStatus, { id: rows.find((row) => row.email === "hustler@example.com")!._id, status: "withdrawn" });
    expect(await hustler.query(api.cohorts.mine, {})).toEqual([]);
    await owner.mutation(api.cohorts.update, { id: cohort, values: catalystCohort, status: "ended" });
    expect(await hacker.query(api.cohorts.mine, {})).toEqual([]);
  });

  it("requires a signed-in member", async () => {
    const t = setup();
    await expect(t.query(api.cohorts.mine, {})).rejects.toThrow();
  });
});
