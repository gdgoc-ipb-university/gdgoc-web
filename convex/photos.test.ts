/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { photoLimits } from "../src/lib/profile-photo";

const modules = import.meta.glob("./**/*.ts");
const google = "https://lh3.googleusercontent.com/a/example=s96-c";
const hour = 3600000;

function setup() { const t = convexTest(schema, modules); betterAuthTest.register(t); return t; }
type Test = ReturnType<typeof setup>;
async function account(t: Test, email: string, name: string) {
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: { name, email, emailVerified: true, image: google, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), expiresAt: Date.now() + hour, createdAt: Date.now(), updatedAt: Date.now() } },
  });
  await t.run((ctx) => ctx.db.insert("memberProfiles", {
    ownerId: user._id, fullName: name, campus: "IPB University", studyProgram: "Ilmu Komputer",
    nextStep: 4, revision: 4, updatedAt: Date.now(), memberType: "member", completedAt: Date.now(),
  }));
  return Object.assign(t.withIdentity({ subject: user._id, sessionId: session._id, email }), { id: user._id as string });
}
type Caller = Awaited<ReturnType<typeof account>>;

async function world() {
  const t = setup();
  const owner = await account(t, "owner@example.com", "Pemilik");
  const admin = await account(t, "admin@example.com", "Admin");
  const other = await account(t, "other@example.com", "Admin Lain");
  const member = await account(t, "member@example.com", "Rania Putri");
  await owner.mutation(api.dashboard.setRole, { ownerId: admin.id, role: "admin" });
  await owner.mutation(api.dashboard.setRole, { ownerId: other.id, role: "admin" });
  return { t, owner, admin, other, member };
}

/** The first bytes of a PNG of the given size, which is all the size check reads. */
function png(width: number, height: number, length = 64) {
  const bytes = new Uint8Array(length);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

const store = (t: Test, bytes: Uint8Array<ArrayBufferLike>, type = "image/png") => t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)], { type })));
const stored = (t: Test, id: Id<"_storage">) => t.run((ctx) => ctx.db.system.get("_storage", id));
const profileOf = (t: Test, ownerId: string) => t.run((ctx) => ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique());
async function upload(t: Test, caller: Caller, bytes: Uint8Array<ArrayBufferLike> = png(800, 800), type = "image/png") {
  const storageId = await store(t, bytes, type);
  return { storageId, result: await caller.action(api.photos.set, { storageId }) };
}

beforeEach(() => vi.stubEnv("APPRECIATION_ADMIN_EMAILS", "owner@example.com"));
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("profile photos", () => {
  it("puts an upload ahead of the Google photo, and replacing it deletes the old file", async () => {
    const { t, member } = await world();
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ photo: google, photoUploaded: false });
    expect(typeof await member.mutation(api.photos.uploadUrl, {})).toBe("string");

    const first = await upload(t, member);
    expect(first.result).toEqual({});
    const url = await t.run((ctx) => ctx.storage.getUrl(first.storageId));
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ photo: url, photoUploaded: true });
    expect((await profileOf(t, member.id))?.photoUploadedAt).toEqual(expect.any(Number));
    // Attaching the same upload twice, as a retried request does, changes nothing.
    expect(await member.action(api.photos.set, { storageId: first.storageId })).toEqual({});

    const second = await upload(t, member, png(1200, 900));
    expect(second.result).toEqual({});
    expect(await stored(t, first.storageId)).toBeNull();
    expect((await profileOf(t, member.id))?.photoStorageId).toBe(second.storageId);
  });

  // A stored type that does not match the bytes is refused too (profile-photo.test.ts); convex-test keeps no content type.
  it("refuses small images, other formats and large files, deleting the upload", async () => {
    const { t, member } = await world();
    const kept = await upload(t, member);
    const cases: [Uint8Array<ArrayBufferLike>, string, string][] = [
      [png(399, 800), "image/png", "Foto terlalu kecil (399 × 800 piksel)"],
      [new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/svg+xml", "JPG, PNG, atau WebP"],
      [new TextEncoder().encode("bukan gambar"), "image/png", "JPG, PNG, atau WebP"],
      [png(800, 800, photoLimits.maxBytes + 1), "image/png", "maksimal 5 MB"],
    ];
    for (const [bytes, type, message] of cases) {
      const { storageId, result } = await upload(t, member, bytes, type);
      expect(result, message).toEqual({ error: expect.stringContaining(message) });
      expect(await stored(t, storageId), message).toBeNull();
    }
    // The photo they had stays.
    expect((await profileOf(t, member.id))?.photoStorageId).toBe(kept.storageId);
  });

  it("turns away guests, deactivated members, and a file another member or an assignment uses", async () => {
    const { t, owner, admin, member } = await world();
    const storageId = await store(t, png(800, 800));
    await expect(t.action(api.photos.set, { storageId })).rejects.toThrow("Masuk kembali");
    await expect(t.mutation(api.photos.uploadUrl, {})).rejects.toThrow("Masuk kembali");
    await expect(t.mutation(api.photos.remove, {})).rejects.toThrow("Masuk kembali");

    const { storageId: theirs } = await upload(t, admin);
    await expect(member.action(api.photos.set, { storageId: theirs })).rejects.toThrow("Foto tidak ditemukan");
    expect((await profileOf(t, admin.id))?.photoStorageId).toBe(theirs);
    const missing = await store(t, png(800, 800));
    await t.run((ctx) => ctx.storage.delete(missing));
    await expect(member.action(api.photos.set, { storageId: missing })).rejects.toThrow("Foto tidak ditemukan");

    await owner.mutation(api.dashboard.setActive, { ownerId: member.id, active: false });
    await expect(member.action(api.photos.set, { storageId })).rejects.toThrow("dinonaktifkan");
    await expect(member.mutation(api.photos.uploadUrl, {})).rejects.toThrow("dinonaktifkan");
    expect(await stored(t, storageId)).not.toBeNull();
  });

  it("lets the member remove their photo, deleting the file and bringing the Google photo back", async () => {
    const { t, member } = await world();
    const { storageId } = await upload(t, member);
    await member.mutation(api.photos.remove, {});
    expect(await stored(t, storageId)).toBeNull();
    expect(await member.query(api.dashboard.viewer)).toMatchObject({ photo: google, photoUploaded: false });
    expect((await profileOf(t, member.id))?.photoUploadedAt).toBeUndefined();
    // Removing again is a no-op.
    await member.mutation(api.photos.remove, {});
  });

  it("lets staff remove a member's photo under the member hierarchy, and logs it", async () => {
    const { t, owner, admin, other, member } = await world();
    const memberPhoto = await upload(t, member);
    const adminPhoto = await upload(t, admin);
    const ownerPhoto = await upload(t, owner);
    const url = await t.run((ctx) => ctx.storage.getUrl(memberPhoto.storageId));
    expect(await admin.query(api.dashboard.member, { ownerId: member.id })).toMatchObject({ photoUploaded: true, photo: url });

    await expect(member.mutation(api.photos.removeFor, { ownerId: admin.id })).rejects.toThrow("hanya untuk admin");
    await expect(other.mutation(api.photos.removeFor, { ownerId: admin.id })).rejects.toThrow("Hanya pemilik");
    await expect(admin.mutation(api.photos.removeFor, { ownerId: owner.id })).rejects.toThrow("Foto pemilik");
    await expect(owner.mutation(api.photos.removeFor, { ownerId: owner.id })).rejects.toThrow("halaman Profil");
    await expect(admin.mutation(api.photos.removeFor, { ownerId: "missing" })).rejects.toThrow("Member tidak ditemukan");

    await admin.mutation(api.photos.removeFor, { ownerId: member.id });
    expect(await stored(t, memberPhoto.storageId)).toBeNull();
    expect(await admin.query(api.dashboard.member, { ownerId: member.id })).toMatchObject({ photoUploaded: false, photo: google });
    // Nothing to remove: no second log row.
    await admin.mutation(api.photos.removeFor, { ownerId: member.id });
    await owner.mutation(api.photos.removeFor, { ownerId: admin.id });
    expect(await stored(t, adminPhoto.storageId)).toBeNull();
    expect(await stored(t, ownerPhoto.storageId)).not.toBeNull();

    const log = (await owner.query(api.dashboard.accessLog, { paginationOpts: { numItems: 20, cursor: null } })).page.filter((row) => row.change === "photo");
    expect(log.map(({ actorId, targetId, from, to }) => ({ actorId, targetId, from, to }))).toEqual([
      { actorId: owner.id, targetId: admin.id, from: "uploaded", to: "removed" },
      { actorId: admin.id, targetId: member.id, from: "uploaded", to: "removed" },
    ]);
  });

  it("shows the photo on the holder's card and to staff scanning it, never to a stranger", async () => {
    const { t, admin, member } = await world();
    const { storageId } = await upload(t, member);
    const url = await t.run((ctx) => ctx.storage.getUrl(storageId));
    await member.mutation(api.cards.ensure, {});
    const card = (await member.query(api.cards.mine, {}))!;
    expect(card.photo).toBe(url);
    const staff = await admin.query(api.cards.verify, { token: card.token });
    expect(staff.card).toMatchObject({ photo: url });
    const self = await member.query(api.cards.verify, { token: card.token });
    expect(self.card).toMatchObject({ photo: url });
    const guest = await t.query(api.cards.verify, { token: card.token });
    expect(guest).toMatchObject({ viewer: "guest", status: "valid" });
    expect(guest.card).not.toHaveProperty("photo");
    expect(JSON.stringify(guest)).not.toContain(url);
  });

  it("removes photo uploads that were never attached after a day, keeping attached photos", async () => {
    const { t, member } = await world();
    const { storageId: attached } = await upload(t, member);
    const stray = await store(t, png(800, 800));
    vi.useFakeTimers({ now: Date.now() + 25 * hour });
    await t.mutation(internal.assignments.cleanupUploads);
    expect(await stored(t, stray)).toBeNull();
    expect(await stored(t, attached)).not.toBeNull();
  });

  it("deletes the photo with the account and counts it", async () => {
    const { t, owner, member } = await world();
    const { storageId } = await upload(t, member);
    expect(await owner.mutation(api.dashboard.deleteAccount, { ownerId: member.id, confirmName: "Rania Putri" })).toMatchObject({ photos: 1 });
    expect(await stored(t, storageId)).toBeNull();
    const [deletion] = await t.run((ctx) => ctx.db.query("accountDeletions").collect());
    expect(deletion.counts.photos).toBe(1);
  });
});
