/**
 * The access matrix: every guarded public function against every kind of account. Queries are called as each role and
 * must answer only the roles listed. Mutations are called as every refused role first (each must be turned away for
 * access, not for its arguments), then once as an allowed role to prove the same arguments work.
 */
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import type { FunctionReference } from "convex/server";
import { readdirSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const page = { numItems: 10, cursor: null };
const ROLES = ["guest", "fresh", "inactive", "member", "apresiasi", "grader", "admin", "owner"] as const;
type Role = typeof ROLES[number];
/** Every message a guard throws; a refusal for any other reason would hide a broken matrix row. */
const DENIED = /Masuk kembali|Selesaikan perkenalan|dinonaktifkan|hanya untuk|Hanya pemilik/;

const OWNER: Role[] = ["owner"];
const STAFF: Role[] = ["admin", "owner"];
const GRADERS: Role[] = ["grader", "admin", "owner"];
const APRESIASI: Role[] = ["apresiasi", "admin", "owner"];
const MEMBERS: Role[] = ["member", "apresiasi", "grader", "admin", "owner"];

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
type Test = ReturnType<typeof setup>;
type Caller = Pick<Test, "query" | "mutation">;

async function account(t: Test, email: string, name: string, onboarded = true) {
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

async function fixture() {
  const t = setup();
  const owner = await account(t, "owner@example.com", "Pemilik");
  const admin = await account(t, "admin@example.com", "Admin");
  const member = await account(t, "member@example.com", "Rania Putri");
  const apresiasi = await account(t, "apresiasi@example.com", "Peninjau");
  const grader = await account(t, "grader@example.com", "Mentor");
  const inactive = await account(t, "inactive@example.com", "Nonaktif");
  const fresh = await account(t, "fresh@example.com", "Baru", false);
  await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
  await owner.mutation(api.dashboard.setReviewer, { ownerId: apresiasi.id, reviewer: true });
  await owner.mutation(api.dashboard.setActive, { ownerId: inactive.id, active: false });
  const due = new Date(Date.now() + 55 * 3600000).toISOString().slice(0, 16);
  const assignment = await owner.mutation(api.assignments.create, { values: { title: "Tugas", description: "Kerjakan.", dueAt: due }, publish: true });
  const draft = await owner.mutation(api.assignments.create, { values: { title: "Draft", description: "Belum.", dueAt: due }, publish: false });
  await owner.mutation(api.assignments.setReviewer, { id: assignment, ownerId: grader.id, reviewer: true });
  await member.mutation(api.assignments.submit, { assignmentId: assignment, revision: 0, answer: "Selesai", fileIds: [] });
  const values = {
    fullName: "Rania Putri", memberType: "member", campus: "IPB University", studyProgram: "Ilmu Komputer", instagram: "rania",
    achievement: "Juara 1", eventName: "Hackathon", organizer: "Panitia", level: "Nasional", participation: "Tim", teamName: "Tim A",
    teamMembers: "Rania", eventDate: "2026-09-01", story: "Cerita.", documentationLinks: "https://example.com", publicationConsent: true,
  };
  const ids = await t.run(async (ctx) => {
    const submission = (await ctx.db.query("assignmentSubmissions").first())!;
    const appreciation = await ctx.db.insert("appreciations", {
      ownerId: member.id, ownerName: "Rania Putri", ownerEmail: "member@example.com", clientId: "c1", values, status: "submitted", revision: 1, updatedAt: Date.now(), submittedAt: Date.now(),
    });
    const entry = await ctx.db.insert("gameBests", { ownerId: member.id, period: "all", score: 100, name: "Rania P.", achievedAt: Date.now(), hidden: false });
    return { submission, appreciation, entry, draftRevision: (await ctx.db.get(draft))!.revision };
  });
  const callers: Record<Role, Caller> = { guest: t, fresh, inactive, member, apresiasi, grader, admin, owner };
  return { t, callers, ids: { member: member.id, assignment, draft, submission: ids.submission._id as Id<"assignmentSubmissions">, submissionRevision: ids.submission.revision, appreciation: ids.appreciation, entry: ids.entry, draftRevision: ids.draftRevision } };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
type Ids = Fixture["ids"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = FunctionReference<any, "public">;
const queries: [string, Any, Role[], (ids: Ids) => object][] = [
  ["dashboard.exportMembers", api.dashboard.exportMembers, OWNER, () => ({ paginationOpts: page })],
  ["dashboard.accessLog", api.dashboard.accessLog, OWNER, () => ({ paginationOpts: page })],
  ["dashboard.members", api.dashboard.members, STAFF, () => ({ search: "", filter: "all", paginationOpts: page })],
  ["dashboard.member", api.dashboard.member, STAFF, (ids) => ({ ownerId: ids.member })],
  ["dashboard.stats", api.dashboard.stats, STAFF, () => ({})],
  ["assignments.adminList", api.assignments.adminList, STAFF, () => ({ paginationOpts: page })],
  ["assignments.slugPreview", api.assignments.slugPreview, STAFF, () => ({ slug: "tugas-baru" })],
  ["assignments.submissions", api.assignments.submissions, GRADERS, (ids) => ({ id: ids.assignment, paginationOpts: page })],
  ["assignments.exportPage", api.assignments.exportPage, GRADERS, (ids) => ({ id: ids.assignment, paginationOpts: page })],
  ["assignments.missing", api.assignments.missing, GRADERS, (ids) => ({ id: ids.assignment })],
  ["appreciations.queue", api.appreciations.queue, APRESIASI, () => ({ status: "submitted", paginationOpts: page })],
  ["appreciations.search", api.appreciations.search, APRESIASI, () => ({ status: "submitted", search: "", level: "", campus: "" })],
  ["appreciations.history", api.appreciations.history, APRESIASI, (ids) => ({ id: ids.appreciation })],
  ["assignments.list", api.assignments.list, MEMBERS, () => ({})],
  ["assignments.reviewing", api.assignments.reviewing, MEMBERS, () => ({})],
  ["assignments.get", api.assignments.get, MEMBERS, (ids) => ({ id: ids.assignment })],
  ["bogorRun.board", api.bogorRun.board, MEMBERS, () => ({ period: "all" })],
];

const mutations: [string, Any, Role[], (ids: Ids) => object][] = [
  ["dashboard.setRole", api.dashboard.setRole, OWNER, (ids) => ({ ownerId: ids.member, role: "admin" })],
  ["dashboard.setReviewer", api.dashboard.setReviewer, OWNER, (ids) => ({ ownerId: ids.member, reviewer: true })],
  ["dashboard.deleteAccount", api.dashboard.deleteAccount, OWNER, (ids) => ({ ownerId: ids.member, confirmName: "Rania Putri" })],
  ["dashboard.setActive", api.dashboard.setActive, STAFF, (ids) => ({ ownerId: ids.member, active: false })],
  ["dashboard.setMemberType", api.dashboard.setMemberType, STAFF, (ids) => ({ ownerId: ids.member, memberType: "core", division: "Technical" })],
  ["assignments.create", api.assignments.create, STAFF, () => ({ values: { title: "Baru", description: "Isi.", dueAt: new Date(Date.now() + 99 * 3600000).toISOString().slice(0, 16) }, publish: false })],
  ["assignments.update", api.assignments.update, STAFF, (ids) => ({ id: ids.draft, revision: ids.draftRevision, values: { title: "Draft baru", description: "Belum.", dueAt: new Date(Date.now() + 99 * 3600000).toISOString().slice(0, 16) } })],
  ["assignments.setStatus", api.assignments.setStatus, STAFF, (ids) => ({ id: ids.draft, revision: ids.draftRevision, status: "published" })],
  ["assignments.remove", api.assignments.remove, STAFF, (ids) => ({ id: ids.draft, revision: ids.draftRevision })],
  ["assignments.setReviewer", api.assignments.setReviewer, STAFF, (ids) => ({ id: ids.assignment, ownerId: ids.member, reviewer: true })],
  ["bogorRun.setHidden", api.bogorRun.setHidden, STAFF, (ids) => ({ entryId: ids.entry, hidden: true })],
  ["assignments.review", api.assignments.review, GRADERS, (ids) => ({ submissionId: ids.submission, submissionRevision: ids.submissionRevision, score: 80, feedback: "Bagus." })],
  ["assignments.requestRevision", api.assignments.requestRevision, GRADERS, (ids) => ({ submissionId: ids.submission, submissionRevision: ids.submissionRevision, note: "Perbaiki bagian dua." })],
  ["assignments.cancelRevision", api.assignments.cancelRevision, GRADERS, (ids) => ({ submissionId: ids.submission })],
  ["appreciations.review", api.appreciations.review, APRESIASI, (ids) => ({ id: ids.appreciation, revision: 1, status: "reviewing", note: "", postUrl: "" })],
];

/** Public functions outside the matrix: open to anyone, or acting only on the caller's own data (covered in their own tests). */
const OPEN: Record<string, string> = {
  "auth.configuration": "public: whether Google sign-in is configured",
  "auth.viewer": "the signed-in account itself, or null",
  "dashboard.viewer": "the signed-in account's own access, or null",
  "members.profile": "own profile", "members.saveStep": "own profile", "members.saveRole": "own profile",
  "appreciations.mine": "own drafts and submissions", "appreciations.get": "own", "appreciations.create": "own",
  "appreciations.save": "own", "appreciations.submit": "own", "appreciations.removeDraft": "own",
  "assignments.generateUploadUrl": "own submission, active members", "assignments.attachFile": "own submission, active members",
  "assignments.removeFile": "own submission, active members", "assignments.submit": "own submission, active members",
  "bogorRun.issueRun": "public: an unsigned-in player gets a ticket too", "bogorRun.submitRun": "own run; refusals are returned as codes",
  "bogorRun.leaderboard": "public board",
};

beforeEach(() => vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com"));
afterEach(() => vi.unstubAllEnvs());

describe("access matrix", () => {
  it("covers every public function, so a new one has to be placed in the matrix or on the open list", () => {
    const found = readdirSync(__dirname).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts")).flatMap((file) =>
      [...readFileSync(`${__dirname}/${file}`, "utf8").matchAll(/^export const (\w+) = (?:query|mutation|action)\(/gm)].map((match) => `${file.slice(0, -3)}.${match[1]}`));
    const placed = [...queries, ...mutations].map(([name]) => name).concat(Object.keys(OPEN));
    expect(found.filter((name) => !placed.includes(name)), "not in the matrix or OPEN").toEqual([]);
    expect(placed.filter((name) => !found.includes(name)), "listed but gone").toEqual([]);
  });


  it.each(queries)("%s answers only its roles", async (_name, fn, allowed, args) => {
    const { callers, ids } = await fixture();
    for (const role of ROLES) {
      const call = callers[role].query(fn, args(ids));
      if (allowed.includes(role)) await expect(call, role).resolves.not.toThrow();
      else await expect(call, role).rejects.toThrow(DENIED);
    }
  });

  it.each(mutations)("%s turns away every other role", async (_name, fn, allowed, args) => {
    const { callers, ids } = await fixture();
    for (const role of ROLES.filter((role) => !allowed.includes(role))) await expect(callers[role].mutation(fn, args(ids)), role).rejects.toThrow(DENIED);
    // The narrowest allowed role, so a guard that only admits staff fails here for graders and Apresiasi reviewers.
    await expect(callers[allowed[0]].mutation(fn, args(ids)), allowed[0]).resolves.not.toThrow();
  });
});
