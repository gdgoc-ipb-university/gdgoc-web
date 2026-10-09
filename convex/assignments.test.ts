/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { toJakartaInput } from "../src/lib/assignment";

const modules = import.meta.glob("./**/*.ts");
const page = { numItems: 20, cursor: null };
const hour = 3600000;
const values = (dueAt = Date.now() + 48 * hour) => ({ title: "Bangun landing page", description: "Buat landing page responsif untuk komunitas.", dueAt: toJakartaInput(dueAt) });

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
async function account(t: ReturnType<typeof setup>, email: string) {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name: email.split("@")[0], email, emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: Date.now() + 7 * 24 * hour, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  await t.run((ctx) => ctx.db.insert("memberProfiles", {
    ownerId: user._id, fullName: `Nama ${email.split("@")[0]}`, campus: "IPB University", studyProgram: "Ilmu Komputer",
    nextStep: 4, revision: 4, updatedAt: Date.now(), completedAt: Date.now(), memberType: "member",
  }));
  return Object.assign(t.withIdentity({ subject: user._id, sessionId: session._id, email }), { id: user._id as string });
}
async function upload(t: ReturnType<typeof setup>, type = "application/pdf", bytes = 2048) {
  return t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)], { type })));
}
async function attach(member: Awaited<ReturnType<typeof account>>, t: ReturnType<typeof setup>, assignmentId: Id<"assignments">, name = "laporan.pdf", type = "application/pdf", bytes = 2048) {
  const result = await member.mutation(api.assignments.attachFile, { assignmentId, storageId: await upload(t, type, bytes), name });
  if ("error" in result) throw new Error(result.error);
  return result.fileId;
}
async function world() {
  const t = setup();
  const owner = await account(t, "owner@example.com");
  const member = await account(t, "member@example.com");
  const other = await account(t, "other@example.com");
  return { t, owner, member, other };
}
beforeEach(() => vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com"));
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("assignment management", () => {
  it("lets only admins create, edit, and publish; members never see drafts", async () => {
    const { owner, member } = await world();
    await expect(member.mutation(api.assignments.create, { values: values(), publish: true })).rejects.toThrow("hanya untuk admin");
    await expect(owner.mutation(api.assignments.create, { values: { ...values(), title: " " }, publish: true })).rejects.toThrow("Lengkapi");
    const id = await owner.mutation(api.assignments.create, { values: values(), publish: false });
    expect(await member.query(api.assignments.list)).toEqual([]);
    expect(await member.query(api.assignments.get, { id })).toBeNull();
    expect(await member.query(api.assignments.get, { id: "not-an-id" })).toBeNull();

    await owner.mutation(api.assignments.update, { id, revision: 0, values: { ...values(), title: "Landing page komunitas" } });
    await expect(owner.mutation(api.assignments.update, { id, revision: 0, values: { ...values(), title: "Versi lama" } })).rejects.toThrow("berubah");
    await owner.mutation(api.assignments.setStatus, { id, revision: 1, status: "published" });
    const [listed] = await member.query(api.assignments.list);
    expect(listed).toMatchObject({ title: "Landing page komunitas", status: "published", submittedAt: null });
    expect((await member.query(api.assignments.get, { id }))?.canManage).toBe(false);
    await expect(member.mutation(api.assignments.setStatus, { id, revision: 2, status: "closed" })).rejects.toThrow("hanya untuk admin");
  });

  it("keeps assignments with submissions out of draft and deletion", async () => {
    const { t, owner, member } = await world();
    const id = await owner.mutation(api.assignments.create, { values: values(), publish: true });
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Selesai", fileIds: [] });
    await expect(owner.mutation(api.assignments.setStatus, { id, revision: 0, status: "draft" })).rejects.toThrow("tidak bisa dikembalikan");
    await expect(owner.mutation(api.assignments.remove, { id, revision: 0 })).rejects.toThrow("tidak bisa dihapus");
    const empty = await owner.mutation(api.assignments.create, { values: values(), publish: true });
    const pending = await attach(member, t, empty);
    await owner.mutation(api.assignments.remove, { id: empty, revision: 0 });
    expect(await t.run((ctx) => ctx.db.get(pending))).toBeNull();
  });
});

describe("assignment audience", () => {
  async function tag(t: ReturnType<typeof setup>, account: { id: string }, memberType: "member" | "core" | "bod") {
    await t.run(async (ctx) => {
      const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", account.id)).unique();
      await ctx.db.patch(profile!._id, { memberType });
    });
  }
  async function groups() {
    const { t, owner, member, other } = await world();
    const core = await account(t, "core@example.com");
    await tag(t, core, "core");
    await tag(t, other, "bod");
    return { t, owner, member, core, bod: other };
  }

  it("gives new assignments to Members by default and refuses an empty audience", async () => {
    const { t, owner, member, core } = await groups();
    const id = await owner.mutation(api.assignments.create, { values: values(), publish: true });
    expect((await t.run((ctx) => ctx.db.get(id)))?.audience).toEqual(["member"]);
    expect(await member.query(api.assignments.list)).toHaveLength(1);
    expect(await core.query(api.assignments.list)).toEqual([]);
    await expect(owner.mutation(api.assignments.create, { values: { ...values(), audience: [] }, publish: true })).rejects.toThrow("Lengkapi");
  });

  it("shows and accepts a Core Team assignment for the core team only", async () => {
    const { t, owner, member, core, bod } = await groups();
    const id = await owner.mutation(api.assignments.create, { values: { ...values(), audience: ["core"] }, publish: true });
    for (const outsider of [member, bod]) {
      expect(await outsider.query(api.assignments.list)).toEqual([]);
      expect(await outsider.query(api.assignments.get, { id })).toBeNull();
      await expect(outsider.mutation(api.assignments.generateUploadUrl, { assignmentId: id })).rejects.toThrow("tidak ditemukan");
      await expect(outsider.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Coba", fileIds: [] })).rejects.toThrow("tidak ditemukan");
      const storageId = await upload(t);
      expect(await outsider.mutation(api.assignments.attachFile, { assignmentId: id, storageId, name: "a.pdf" })).toEqual({ error: "Tugas tidak ditemukan." });
      expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).toBeNull();
    }
    expect(await core.query(api.assignments.list)).toHaveLength(1);
    expect((await core.query(api.assignments.get, { id }))?.assignment._id).toBe(id);
    await attach(core, t, id);
    await core.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Selesai", fileIds: [] });
    // Staff see every assignment whatever its audience.
    expect((await owner.query(api.assignments.get, { id }))?.canManage).toBe(true);
    expect(await owner.query(api.assignments.missing, { id })).toMatchObject({ active: 1, submitted: 1, missing: [] });
  });

  it("treats BoD as its own group and all three groups as everyone", async () => {
    const { owner, member, core, bod } = await groups();
    const coreOnly = await owner.mutation(api.assignments.create, { values: { ...values(), audience: ["core"] }, publish: true });
    const board = await owner.mutation(api.assignments.create, { values: { ...values(), title: "Rapat BoD", audience: ["bod"] }, publish: true });
    const everyone = await owner.mutation(api.assignments.create, { values: { ...values(), title: "Semua", audience: ["bod", "member", "core"] }, publish: true });
    expect((await bod.query(api.assignments.list)).map((item) => item._id).sort()).toEqual([board, everyone].sort());
    expect((await core.query(api.assignments.list)).map((item) => item._id).sort()).toEqual([coreOnly, everyone].sort());
    expect((await member.query(api.assignments.list)).map((item) => item._id)).toEqual([everyone]);
    const all = await owner.query(api.assignments.missing, { id: everyone });
    expect(all.active).toBe(3);
    expect((await owner.query(api.assignments.get, { id: everyone }))?.assignment.audience).toEqual(["member", "core", "bod"]);
  });

  it("reads assignments from before audiences as Core Team only, and old tabs keep that on edit", async () => {
    const { t, owner, member, core } = await groups();
    const id = await owner.mutation(api.assignments.create, { values: values(), publish: true });
    await t.run((ctx) => ctx.db.patch(id, { audience: undefined }));
    expect(await member.query(api.assignments.get, { id })).toBeNull();
    expect(await core.query(api.assignments.list)).toHaveLength(1);
    expect(await owner.query(api.assignments.missing, { id })).toMatchObject({ active: 1, missing: [{ name: "Nama core" }] });
    await owner.mutation(api.assignments.update, { id, revision: 0, values: values() });
    expect((await t.run((ctx) => ctx.db.get(id)))?.audience).toEqual(["core"]);
    expect(await member.query(api.assignments.list)).toEqual([]);
  });

  it("hides an assignment from members dropped from its audience and keeps their submission for staff", async () => {
    const { owner, member, core } = await groups();
    const id = await owner.mutation(api.assignments.create, { values: { ...values(), audience: ["member", "core"] }, publish: true });
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Sudah", fileIds: [] });
    await owner.mutation(api.assignments.update, { id, revision: 0, values: { ...values(), audience: ["core"] } });
    expect(await member.query(api.assignments.list)).toEqual([]);
    expect(await member.query(api.assignments.get, { id })).toBeNull();
    await expect(member.mutation(api.assignments.submit, { assignmentId: id, revision: 1, answer: "Lagi", fileIds: [] })).rejects.toThrow("tidak ditemukan");
    expect((await owner.query(api.assignments.submissions, { id, paginationOpts: page })).page.map((row) => row.answer)).toEqual(["Sudah"]);
    expect(await owner.query(api.assignments.missing, { id })).toMatchObject({ active: 1, submitted: 0, missing: [{ name: "Nama core" }] });
    expect(await core.query(api.assignments.list)).toHaveLength(1);
  });
});

describe("assignment slugs", () => {
  it("derives unique slugs, keeps renamed links working, and never shadows static routes", async () => {
    const { owner, member } = await world();
    const first = await owner.mutation(api.assignments.create, { values: { ...values(), slug: "" }, publish: true });
    const second = await owner.mutation(api.assignments.create, { values: values(), publish: true });
    const reserved = await owner.mutation(api.assignments.create, { values: { ...values(), slug: "Baru" }, publish: false });
    const slugs = async () => (await owner.query(api.assignments.adminList, { paginationOpts: page })).page.map((item) => [item._id, item.slug]);
    expect(Object.fromEntries(await slugs())).toEqual({ [first]: "bangun-landing-page", [second]: "bangun-landing-page-2", [reserved]: "baru-2" });
    expect(await owner.query(api.assignments.slugPreview, { slug: "Bangun Landing Page" })).toBe("bangun-landing-page-3");
    expect(await owner.query(api.assignments.slugPreview, { slug: "bangun-landing-page", id: first })).toBe("bangun-landing-page");
    await expect(member.query(api.assignments.slugPreview, { slug: "x" })).rejects.toThrow("hanya untuk admin");

    expect(await owner.mutation(api.assignments.update, { id: first, revision: 0, values: { ...values(), slug: "Landing Komunitas" } })).toBe("landing-komunitas");
    expect((await member.query(api.assignments.get, { id: "landing-komunitas" }))?.assignment._id).toBe(first);
    expect((await member.query(api.assignments.get, { id: "bangun-landing-page" }))?.assignment.slug).toBe("landing-komunitas");
    expect((await member.query(api.assignments.get, { id: first }))?.assignment.slug).toBe("landing-komunitas");
    // The old slug still belongs to the first assignment, so the second keeps its own variant.
    expect(await owner.query(api.assignments.slugPreview, { slug: "bangun-landing-page", id: second })).toBe("bangun-landing-page-2");
    expect(await owner.query(api.assignments.slugPreview, { slug: "bangun-landing-page" })).toBe("bangun-landing-page-3");
    // Saving without a slug keeps the current one.
    expect(await owner.mutation(api.assignments.update, { id: first, revision: 1, values: { title: "Judul baru", description: "Instruksi.", dueAt: values().dueAt } })).toBe("landing-komunitas");

    await owner.mutation(api.assignments.remove, { id: reserved, revision: 0 });
    expect(await owner.query(api.assignments.slugPreview, { slug: "baru" })).toBe("baru-2");
  });
});

describe("assignment submission", () => {
  it("submits text with files, flags late work, and shows it only to the owner and admins", async () => {
    const { t, owner, member, other } = await world();
    const id = await owner.mutation(api.assignments.create, { values: values(Date.now() + hour), publish: true });
    const fileId = await attach(member, t, id);
    await expect(other.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "", fileIds: [fileId] })).rejects.toThrow("tidak ditemukan");
    await expect(member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: " ", fileIds: [] })).rejects.toThrow("Tulis jawaban");
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Link demo ada di laporan.", fileIds: [fileId] });

    const mine = await member.query(api.assignments.get, { id });
    expect(mine?.submission).toMatchObject({ answer: "Link demo ada di laporan.", revision: 1, late: false });
    expect(mine?.files).toEqual([expect.objectContaining({ name: "laporan.pdf", attached: true, url: expect.any(String) })]);
    expect((await other.query(api.assignments.get, { id }))?.submission).toBeNull();
    expect((await other.query(api.assignments.get, { id }))?.files).toEqual([]);
    await expect(member.query(api.assignments.submissions, { id, paginationOpts: page })).rejects.toThrow("hanya untuk admin");

    vi.useFakeTimers({ now: Date.now() + 2 * hour });
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 1, answer: "Revisi setelah tenggat.", fileIds: [fileId] });
    const [row] = (await owner.query(api.assignments.submissions, { id, paginationOpts: page })).page;
    expect(row).toMatchObject({ name: "Nama member", email: "member@example.com", answer: "Revisi setelah tenggat.", late: true });
    expect(row.files).toHaveLength(1);
    expect((await owner.query(api.assignments.adminList, { paginationOpts: page })).page[0]).toMatchObject({ submissionCount: 1, lateCount: 1 });
    expect((await member.query(api.assignments.list))[0]).toMatchObject({ late: true, submittedAt: expect.any(Number) });
  });

  it("lets staff score and comment on a submission, keeps history, and flags resubmissions", async () => {
    const { t, owner, member, other } = await world();
    const id = await owner.mutation(api.assignments.create, { values: { ...values(), maxScore: "50" }, publish: true });
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Versi 1", fileIds: [] });
    const [first] = (await owner.query(api.assignments.submissions, { id, paginationOpts: page })).page;
    expect(first).toMatchObject({ revision: 1, score: null, feedback: null, reviewedAt: null, reviewerName: null, stale: false });
    await expect(member.mutation(api.assignments.review, { submissionId: first._id, submissionRevision: 1, score: 40, feedback: "" })).rejects.toThrow("hanya untuk admin");
    await expect(owner.mutation(api.assignments.review, { submissionId: first._id, submissionRevision: 1, score: 60, feedback: "" })).rejects.toThrow("0 sampai 50");
    await expect(owner.mutation(api.assignments.review, { submissionId: first._id, submissionRevision: 1, score: 4.5, feedback: "" })).rejects.toThrow("bilangan bulat");
    await expect(owner.mutation(api.assignments.review, { submissionId: first._id, submissionRevision: 1, feedback: "  " })).rejects.toThrow("Isi nilai");
    await owner.mutation(api.assignments.review, { submissionId: first._id, submissionRevision: 1, score: 45, feedback: " Rapi. Tambahkan pengujian. " });

    const mine = await member.query(api.assignments.get, { id });
    expect(mine?.submission).toMatchObject({ score: 45, feedback: "Rapi. Tambahkan pengujian.", reviewerName: "Nama owner", stale: false, reviewedAt: expect.any(Number) });
    expect(mine?.assignment.maxScore).toBe(50);
    expect((await member.query(api.assignments.list))[0]).toMatchObject({ score: 45, maxScore: 50, stale: false });
    expect((await other.query(api.assignments.get, { id }))?.submission).toBeNull();
    expect((await owner.query(api.assignments.adminList, { paginationOpts: page })).page[0]).toMatchObject({ reviewedCount: 1 });

    // A resubmission keeps the score but is flagged, and a review of the old revision is refused.
    vi.useFakeTimers({ now: Date.now() + hour });
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 1, answer: "Versi 2", fileIds: [] });
    expect((await member.query(api.assignments.get, { id }))?.submission).toMatchObject({ score: 45, stale: true });
    expect((await owner.query(api.assignments.adminList, { paginationOpts: page })).page[0]).toMatchObject({ reviewedCount: 0 });
    await expect(owner.mutation(api.assignments.review, { submissionId: first._id, submissionRevision: 1, score: 50, feedback: "" })).rejects.toThrow("memperbarui kirimannya");
    await owner.mutation(api.assignments.review, { submissionId: first._id, submissionRevision: 2, feedback: "Versi 2 lebih jelas." });
    expect((await member.query(api.assignments.get, { id }))?.submission).toMatchObject({ score: null, feedback: "Versi 2 lebih jelas.", stale: false });
    const history = await t.run((ctx) => ctx.db.query("submissionReviews").withIndex("by_submission", (q) => q.eq("submissionId", first._id)).collect());
    expect(history.map((row) => [row.score ?? null, row.feedback])).toEqual([[45, "Rapi. Tambahkan pengujian."], [null, "Versi 2 lebih jelas."]]);
  });

  it("lists active members who have not submitted, leaving out staff and deactivated accounts", async () => {
    const { t, owner, member } = await world(); // `other` from world() is the one who never submits
    const idle = await account(t, "idle@example.com");
    const admin = await account(t, "admin@example.com");
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
    await owner.mutation(api.dashboard.setActive, { ownerId: idle.id, active: false });
    const id = await owner.mutation(api.assignments.create, { values: values(), publish: true });
    await expect(member.query(api.assignments.missing, { id })).rejects.toThrow("hanya untuk admin");
    expect(await owner.query(api.assignments.missing, { id })).toMatchObject({ active: 2, submitted: 0 });
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Selesai", fileIds: [] });
    const result = await admin.query(api.assignments.missing, { id });
    expect(result).toMatchObject({ active: 2, submitted: 1 });
    expect(result.missing.map((row) => [row.name, row.email, row.campus])).toEqual([["Nama other", "other@example.com", "IPB University"]]);
  });

  it("scores through a rubric: points per criterion, total as the score, and the rubric's sum as the maximum", async () => {
    const { t, owner, member } = await world();
    const rubric = [{ name: " Kejelasan masalah ", max: "40" }, { name: "Eksekusi", max: "60" }];
    await expect(owner.mutation(api.assignments.create, { values: { ...values(), rubric: [{ name: "", max: "10" }] }, publish: true })).rejects.toThrow("Lengkapi isian");
    await expect(owner.mutation(api.assignments.create, { values: { ...values(), rubric: [{ name: "A", max: "0" }] }, publish: true })).rejects.toThrow("Lengkapi isian");
    const id = await owner.mutation(api.assignments.create, { values: { ...values(), maxScore: "7", rubric }, publish: true });
    const detail = await member.query(api.assignments.get, { id });
    expect(detail?.assignment).toMatchObject({ maxScore: 100, rubric: [{ name: "Kejelasan masalah", max: 40 }, { name: "Eksekusi", max: 60 }] });
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Brief", fileIds: [] });
    const [row] = (await owner.query(api.assignments.submissions, { id, paginationOpts: page })).page;
    await expect(owner.mutation(api.assignments.review, { submissionId: row._id, submissionRevision: 1, score: 80, feedback: "" })).rejects.toThrow("memakai rubrik");
    await expect(owner.mutation(api.assignments.review, { submissionId: row._id, submissionRevision: 1, points: [30], feedback: "" })).rejects.toThrow("2 kriteria");
    await expect(owner.mutation(api.assignments.review, { submissionId: row._id, submissionRevision: 1, points: [30, 61], feedback: "" })).rejects.toThrow("Eksekusi");
    await owner.mutation(api.assignments.review, { submissionId: row._id, submissionRevision: 1, points: [30, 55], feedback: "Bagus." });
    const scored = [{ name: "Kejelasan masalah", max: 40, points: 30 }, { name: "Eksekusi", max: 60, points: 55 }];
    expect((await member.query(api.assignments.get, { id }))?.submission).toMatchObject({ score: 85, breakdown: scored, feedback: "Bagus." });
    expect((await owner.query(api.assignments.submissions, { id, paginationOpts: page })).page[0]).toMatchObject({ score: 85, breakdown: scored });
    // Editing the rubric later keeps the criteria the review was scored against.
    await owner.mutation(api.assignments.update, { id, revision: 0, values: { ...values(), rubric: [{ name: "Masalah", max: "50" }, { name: "Eksekusi", max: "50" }] } });
    expect((await member.query(api.assignments.get, { id }))?.submission).toMatchObject({ score: 85, breakdown: scored });
    // Feedback alone clears the points along with the score.
    await owner.mutation(api.assignments.review, { submissionId: row._id, submissionRevision: 1, feedback: "Lihat catatan." });
    expect((await member.query(api.assignments.get, { id }))?.submission).toMatchObject({ score: null, breakdown: null });
    const history = await t.run((ctx) => ctx.db.query("submissionReviews").withIndex("by_submission", (q) => q.eq("submissionId", row._id)).collect());
    expect(history.map((entry) => entry.breakdown ?? null)).toEqual([scored, null]);
    // Removing the rubric falls back to a plain maximum, and points from a tab that still shows the rubric are refused.
    await owner.mutation(api.assignments.update, { id, revision: 1, values: { ...values(), maxScore: "10", rubric: [] } });
    await expect(owner.mutation(api.assignments.review, { submissionId: row._id, submissionRevision: 1, points: [5, 5], feedback: "" })).rejects.toThrow("tidak lagi memakai rubrik");
    expect((await member.query(api.assignments.get, { id }))?.assignment).toMatchObject({ maxScore: 10 });
    expect((await member.query(api.assignments.get, { id }))?.assignment.rubric).toBeUndefined();
  });

  it("exports every submission with its review for staff, with emails for owners only", async () => {
    const { t, owner, member, other } = await world();
    const admin = await account(t, "admin@example.com");
    await t.run(async (ctx) => {
      const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", admin.id)).unique();
      await ctx.db.patch(profile!._id, { role: "admin" });
    });
    const id = await owner.mutation(api.assignments.create, { values: { ...values(), rubric: [{ name: "Ide", max: "40" }, { name: "Eksekusi", max: "60" }] }, publish: true });
    const fileId = await attach(member, t, id, "laporan.pdf");
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Brief", fileIds: [fileId] });
    await other.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Brief lain", fileIds: [] });
    const [first] = (await owner.query(api.assignments.submissions, { id, paginationOpts: page })).page.filter((row) => row.email === "member@example.com");
    await owner.mutation(api.assignments.review, { submissionId: first._id, submissionRevision: 1, points: [30, 50], feedback: "Rapi." });

    await expect(member.query(api.assignments.exportPage, { id, paginationOpts: page })).rejects.toThrow("hanya untuk admin");
    const firstPage = await owner.query(api.assignments.exportPage, { id, paginationOpts: { numItems: 1, cursor: null } });
    expect(firstPage).toMatchObject({ includesEmail: true, isDone: false });
    const rest = await owner.query(api.assignments.exportPage, { id, paginationOpts: { numItems: 1, cursor: firstPage.continueCursor } });
    const rows = [...firstPage.page, ...rest.page];
    expect(rows.find((row) => row.email === "member@example.com")).toMatchObject({
      name: "Nama member", campus: "IPB University", score: 80, feedback: "Rapi.", reviewerName: "Nama owner", fileNames: ["laporan.pdf"],
      breakdown: [{ name: "Ide", max: 40, points: 30 }, { name: "Eksekusi", max: 60, points: 50 }],
    });
    expect(rows.find((row) => row.email === "other@example.com")).toMatchObject({ score: null, breakdown: null, reviewedAt: null, fileNames: [] });
    const forAdmin = await admin.query(api.assignments.exportPage, { id, paginationOpts: page });
    expect(forAdmin.includesEmail).toBe(false);
    expect(forAdmin.page.map((row) => row.email)).toEqual(["", ""]);
  });

  it("reopens one member's submission on a revision request, even after closing, until they resubmit", async () => {
    const { t, owner, member, other } = await world();
    const id = await owner.mutation(api.assignments.create, { values: values(), publish: true });
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Versi pertama", fileIds: [] });
    await other.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Versi lain", fileIds: [] });
    const rows = (await owner.query(api.assignments.submissions, { id, paginationOpts: page })).page;
    const mine = rows.find((row) => row.email === "member@example.com")!;
    await owner.mutation(api.assignments.review, { submissionId: mine._id, submissionRevision: 1, score: 70, feedback: "" });

    await expect(member.mutation(api.assignments.requestRevision, { submissionId: mine._id, submissionRevision: 1, note: "Revisi" })).rejects.toThrow("hanya untuk admin");
    await expect(owner.mutation(api.assignments.requestRevision, { submissionId: mine._id, submissionRevision: 1, note: "  " })).rejects.toThrow("perlu direvisi");
    await expect(owner.mutation(api.assignments.requestRevision, { submissionId: mine._id, submissionRevision: 0, note: "Revisi" })).rejects.toThrow("Muat ulang");
    await owner.mutation(api.assignments.requestRevision, { submissionId: mine._id, submissionRevision: 1, note: "Tambahkan pengujian." });
    expect((await member.query(api.assignments.get, { id }))?.submission).toMatchObject({ score: 70, feedback: "Tambahkan pengujian.", revisionRequestedAt: expect.any(Number), stale: false });
    expect((await member.query(api.assignments.list))[0]).toMatchObject({ revisionRequestedAt: expect.any(Number) });
    expect((await owner.query(api.assignments.adminList, { paginationOpts: page })).page[0]).toMatchObject({ submissionCount: 2, reviewedCount: 0 });

    // Closing stops everyone except the member asked to revise.
    await owner.mutation(api.assignments.setStatus, { id, revision: 0, status: "closed" });
    await expect(other.mutation(api.assignments.submit, { assignmentId: id, revision: 1, answer: "Terlambat", fileIds: [] })).rejects.toThrow("ditutup");
    await expect(other.mutation(api.assignments.generateUploadUrl, { assignmentId: id })).rejects.toThrow("ditutup");
    await member.mutation(api.assignments.generateUploadUrl, { assignmentId: id });
    await attach(member, t, id, "revisi.pdf");
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 1, answer: "Versi kedua", fileIds: [] });
    expect((await member.query(api.assignments.get, { id }))?.submission).toMatchObject({ revision: 2, score: 70, revisionRequestedAt: null, stale: true });
    await expect(member.mutation(api.assignments.submit, { assignmentId: id, revision: 2, answer: "Versi ketiga", fileIds: [] })).rejects.toThrow("ditutup");

    // A request can be withdrawn before the member answers it.
    await owner.mutation(api.assignments.requestRevision, { submissionId: mine._id, submissionRevision: 2, note: "Satu lagi." });
    await owner.mutation(api.assignments.cancelRevision, { submissionId: mine._id });
    expect((await member.query(api.assignments.get, { id }))?.submission).toMatchObject({ revisionRequestedAt: null });
    await expect(member.mutation(api.assignments.submit, { assignmentId: id, revision: 2, answer: "Versi ketiga", fileIds: [] })).rejects.toThrow("ditutup");

    const history = await t.run((ctx) => ctx.db.query("submissionReviews").withIndex("by_submission", (q) => q.eq("submissionId", mine._id)).collect());
    expect(history.map((entry) => [entry.score ?? null, entry.feedback, entry.revisionRequested ?? false])).toEqual([[70, "", false], [70, "Tambahkan pengujian.", true], [70, "Satu lagi.", true]]);
  });

  it("lets members staff add as reviewers score one assignment, without emails and without managing it", async () => {
    const { t, owner, member, other } = await world();
    const mentor = await account(t, "mentor@example.com");
    const admin = await account(t, "admin@example.com");
    await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
    const id = await owner.mutation(api.assignments.create, { values: values(), publish: true });
    const elsewhere = await owner.mutation(api.assignments.create, { values: { ...values(), title: "Tugas lain" }, publish: true });
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Jawaban", fileIds: [] });
    await member.mutation(api.assignments.submit, { assignmentId: elsewhere, revision: 0, answer: "Jawaban lain", fileIds: [] });

    // Before the grant the mentor is an ordinary member.
    await expect(mentor.query(api.assignments.submissions, { id, paginationOpts: page })).rejects.toThrow("penilai tugas ini");
    await expect(mentor.mutation(api.assignments.setReviewer, { id, ownerId: mentor.id, reviewer: true })).rejects.toThrow("hanya untuk admin");
    await expect(owner.mutation(api.assignments.setReviewer, { id, ownerId: admin.id, reviewer: true })).rejects.toThrow("sudah bisa menilai");
    await expect(owner.mutation(api.assignments.setReviewer, { id, ownerId: "missing", reviewer: true })).rejects.toThrow("tidak ditemukan");
    await owner.mutation(api.assignments.setReviewer, { id, ownerId: mentor.id, reviewer: true });
    await owner.mutation(api.assignments.setReviewer, { id, ownerId: mentor.id, reviewer: true }); // already a reviewer: no-op
    expect((await owner.query(api.assignments.get, { id }))?.reviewers).toEqual([{ ownerId: mentor.id, name: "Nama mentor" }]);

    const detail = await mentor.query(api.assignments.get, { id });
    expect(detail).toMatchObject({ canManage: false, canReview: true, reviewers: [] });
    const [row] = (await mentor.query(api.assignments.submissions, { id, paginationOpts: page })).page;
    expect(row).toMatchObject({ name: "Nama member", email: "", answer: "Jawaban" });
    expect((await mentor.query(api.assignments.exportPage, { id, paginationOpts: page })).includesEmail).toBe(false);
    const missing = await mentor.query(api.assignments.missing, { id });
    expect(missing.missing.map((entry) => [entry.name, entry.email])).toEqual([["Nama other", ""]]);
    expect(missing.active).toBe(2); // member and other; the mentor reviews instead of submitting
    expect(await mentor.query(api.assignments.reviewing)).toMatchObject([{ _id: id, submissionCount: 1, waiting: 1 }]);

    await mentor.mutation(api.assignments.review, { submissionId: row._id, submissionRevision: 1, score: 80, feedback: "Rapi." });
    await mentor.mutation(api.assignments.requestRevision, { submissionId: row._id, submissionRevision: 1, note: "Tambahkan contoh." });
    await mentor.mutation(api.assignments.cancelRevision, { submissionId: row._id });
    expect((await member.query(api.assignments.get, { id }))?.submission).toMatchObject({ score: 80, reviewerName: "Nama mentor", revisionRequestedAt: null });

    // Nothing beyond this assignment's reviews.
    const [other_] = (await owner.query(api.assignments.submissions, { id: elsewhere, paginationOpts: page })).page;
    await expect(mentor.mutation(api.assignments.review, { submissionId: other_._id, submissionRevision: 1, score: 10, feedback: "" })).rejects.toThrow("penilai tugas ini");
    await expect(mentor.mutation(api.assignments.setStatus, { id, revision: 0, status: "closed" })).rejects.toThrow("hanya untuk admin");
    await expect(mentor.mutation(api.assignments.update, { id, revision: 0, values: values() })).rejects.toThrow("hanya untuk admin");

    // Removing the grant ends access; deactivated members cannot be added.
    await owner.mutation(api.assignments.setReviewer, { id, ownerId: mentor.id, reviewer: false });
    await expect(mentor.query(api.assignments.submissions, { id, paginationOpts: page })).rejects.toThrow("penilai tugas ini");
    expect(await mentor.query(api.assignments.reviewing)).toEqual([]);
    await owner.mutation(api.dashboard.setActive, { ownerId: other.id, active: false });
    await expect(owner.mutation(api.assignments.setReviewer, { id, ownerId: other.id, reviewer: true })).rejects.toThrow("Aktifkan kembali");
  });

  // convex-test does not record upload content types; see src/lib/assignment.test.ts for type checks.
  it("validates uploads on the server and deletes rejected files", async () => {
    const { t, owner, member, other } = await world();
    const id = await owner.mutation(api.assignments.create, { values: values(), publish: true });
    for (const [name, type, bytes, message] of [
      ["virus.exe", "application/octet-stream", 100, "Gunakan PDF"],
      ["besar.pdf", "application/pdf", 10 * 1024 * 1024 + 1, "maksimal 10 MB"],
    ] as const) {
      const storageId = await upload(t, type, bytes);
      expect(await member.mutation(api.assignments.attachFile, { assignmentId: id, storageId, name })).toEqual({ error: expect.stringContaining(message) });
      expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).toBeNull();
    }
    const storageId = await upload(t);
    const first = await member.mutation(api.assignments.attachFile, { assignmentId: id, storageId, name: "a/b\\laporan.pdf" });
    expect(await member.mutation(api.assignments.attachFile, { assignmentId: id, storageId, name: "laporan.pdf" })).toEqual(first);
    await expect(other.mutation(api.assignments.attachFile, { assignmentId: id, storageId, name: "curian.pdf" })).rejects.toThrow("tidak ditemukan");
    expect((await member.query(api.assignments.get, { id }))?.files[0]).toMatchObject({ name: "ablaporan.pdf", attached: false });
  });

  it("replaces files on resubmission, is retry-safe, and rejects closed assignments", async () => {
    const { t, owner, member } = await world();
    const id = await owner.mutation(api.assignments.create, { values: values(), publish: true });
    const first = await attach(member, t, id, "v1.pdf");
    const submissionId = await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Versi 1", fileIds: [first] });
    expect(await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Versi 1", fileIds: [first] })).toBe(submissionId);
    await expect(member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "Tab lama", fileIds: [] })).rejects.toThrow("berubah");
    await expect(member.mutation(api.assignments.removeFile, { fileId: first })).rejects.toThrow("bagian dari kiriman");

    const second = await attach(member, t, id, "v2.zip", "application/zip");
    const firstStorage = (await t.run((ctx) => ctx.db.get(first)))!.storageId;
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 1, answer: "Versi 2", fileIds: [second] });
    expect(await t.run((ctx) => ctx.db.get(first))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get("_storage", firstStorage))).toBeNull();
    expect((await member.query(api.assignments.get, { id }))?.files.map((file) => file.name)).toEqual(["v2.zip"]);

    await owner.mutation(api.assignments.setStatus, { id, revision: 0, status: "closed" });
    await expect(member.mutation(api.assignments.submit, { assignmentId: id, revision: 2, answer: "Versi 3", fileIds: [second] })).rejects.toThrow("sudah ditutup");
    await expect(member.mutation(api.assignments.generateUploadUrl, { assignmentId: id })).rejects.toThrow("sudah ditutup");
    expect((await member.query(api.assignments.list))[0]).toMatchObject({ status: "closed" });
  });

  it("stores rich answers through the allowlist and derives the plain text", async () => {
    const { owner, member } = await world();
    const id = await owner.mutation(api.assignments.create, { values: values(), publish: true });
    const doc = { type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hasil" }] },
      { type: "paragraph", content: [{ type: "text", text: "Demo", marks: [{ type: "bold" }, { type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
    ] };
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "ignored", answerDoc: JSON.stringify(doc), fileIds: [] });
    const saved = (await member.query(api.assignments.get, { id }))?.submission;
    expect(saved?.answer).toBe("Hasil\nDemo");
    expect(JSON.parse(saved!.answerDoc!).content[1].content[0]).toEqual({ type: "text", text: "Demo", marks: [{ type: "bold" }] });
    expect((await owner.query(api.assignments.submissions, { id, paginationOpts: page })).page[0].answerDoc).toBe(saved?.answerDoc);

    await expect(member.mutation(api.assignments.submit, { assignmentId: id, revision: 1, answer: "", answerDoc: JSON.stringify({ type: "doc", content: [{ type: "image", attrs: { src: "https://x" } }] }), fileIds: [] })).rejects.toThrow("Format jawaban");
    const long = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(5001) }] }] };
    await expect(member.mutation(api.assignments.submit, { assignmentId: id, revision: 1, answer: "", answerDoc: JSON.stringify(long), fileIds: [] })).rejects.toThrow("maksimal 5000");
    const empty = { type: "doc", content: [{ type: "paragraph" }] };
    await expect(member.mutation(api.assignments.submit, { assignmentId: id, revision: 1, answer: "", answerDoc: JSON.stringify(empty), fileIds: [] })).rejects.toThrow("Tulis jawaban");

    // A tab from before rich answers sends plain text, which clears the stored document.
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 1, answer: "Teks biasa", fileIds: [] });
    const plain = (await member.query(api.assignments.get, { id }))?.submission;
    expect(plain).toMatchObject({ answer: "Teks biasa", answerDoc: null, revision: 2 });
  });

  it("removes pending uploads and unregistered files after a day, keeping submitted work", async () => {
    const { t, owner, member } = await world();
    const id = await owner.mutation(api.assignments.create, { values: values(), publish: true });
    const kept = await attach(member, t, id, "kirim.pdf");
    const pending = await attach(member, t, id, "lupa.pdf");
    const stray = await upload(t);
    await member.mutation(api.assignments.submit, { assignmentId: id, revision: 0, answer: "", fileIds: [kept] });
    await t.mutation(internal.assignments.cleanupUploads);
    expect(await t.run((ctx) => ctx.db.get(pending))).not.toBeNull();

    vi.useFakeTimers({ now: Date.now() + 25 * hour });
    await t.mutation(internal.assignments.cleanupUploads);
    expect(await t.run((ctx) => ctx.db.get(pending))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get("_storage", stray))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(kept))).not.toBeNull();
  });
});
