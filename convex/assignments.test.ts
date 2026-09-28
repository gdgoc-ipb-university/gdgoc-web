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
    nextStep: 4, revision: 4, updatedAt: Date.now(), completedAt: Date.now(),
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
