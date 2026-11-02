import { ConvexError, v } from "convex/values";
import { action, internalMutation, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { requireMember, requireStaff, roleOf } from "./access";
import { logAccess } from "./accessLog";
import { imageFacts, photoLimits, photoProblem } from "../src/lib/profile-photo";

/**
 * A member's photo wherever their image shows (#146): their own upload, else the Google photo from sign-in, else null
 * for the pixel initial. Revisits decision 3 of #113; a stranger on the scan page still gets no photo (decision 5).
 */
export async function photoUrl(ctx: QueryCtx | MutationCtx, profile: Doc<"memberProfiles"> | null, image: string | null | undefined) {
  const uploaded = profile?.photoStorageId ? await ctx.storage.getUrl(profile.photoStorageId) : null;
  return uploaded ?? image ?? null;
}

/** Whether a stored file already belongs to a profile or an assignment submission, so it is never claimed twice. */
export async function storedFileInUse(ctx: QueryCtx | MutationCtx, storageId: Id<"_storage">) {
  return Boolean(await ctx.db.query("memberProfiles").withIndex("by_photo", (q) => q.eq("photoStorageId", storageId)).first())
    || Boolean(await ctx.db.query("submissionFiles").withIndex("by_storage", (q) => q.eq("storageId", storageId)).unique());
}

/** Deletes a profile's uploaded photo and its file, so the Google photo shows again. */
export async function clearPhoto(ctx: MutationCtx, profile: Doc<"memberProfiles">) {
  if (!profile.photoStorageId) return false;
  await ctx.storage.delete(profile.photoStorageId);
  await ctx.db.patch(profile._id, { photoStorageId: undefined, photoUploadedAt: undefined });
  return true;
}

const notFound = () => new ConvexError("Foto tidak ditemukan. Unggah ulang fotomu.");

export const uploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

/**
 * Makes an upload the caller's photo. Only an action can read a stored file, so the format and pixel size come from the
 * file's own bytes, not from what the browser said; `attach` then checks the caller and commits. A refused upload is
 * deleted and its reason returned, so the deletion commits.
 */
export const set = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }): Promise<{ error?: string }> => {
    if (!(await ctx.auth.getUserIdentity())) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Masuk kembali dengan akun Google untuk melanjutkan." });
    const file = await ctx.storage.get(storageId);
    const facts = file && file.size <= photoLimits.maxBytes ? imageFacts(new Uint8Array(await file.arrayBuffer())) : null;
    return ctx.runMutation(internal.photos.attach, { storageId, facts });
  },
});

export const attach = internalMutation({
  args: { storageId: v.id("_storage"), facts: v.union(v.null(), v.object({ type: v.string(), width: v.number(), height: v.number() })) },
  handler: async (ctx, { storageId, facts }): Promise<{ error?: string }> => {
    const { profile } = await requireMember(ctx);
    if (profile.photoStorageId === storageId) return {};
    if (await storedFileInUse(ctx, storageId)) throw notFound();
    const metadata = await ctx.db.system.get("_storage", storageId);
    if (!metadata) throw notFound();
    const problem = photoProblem(metadata.size, facts, metadata.contentType);
    if (problem) { await ctx.storage.delete(storageId); return { error: problem }; }
    await clearPhoto(ctx, profile);
    await ctx.db.patch(profile._id, { photoStorageId: storageId, photoUploadedAt: Date.now() });
    return {};
  },
});

/** The caller removes their own photo; the file is deleted and the Google photo or initial shows again. */
export const remove = mutation({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireMember(ctx);
    await clearPhoto(ctx, profile);
  },
});

/**
 * Staff remove a member's photo, for example one that is not a face, under the hierarchy of blocking a card: admins
 * act only on members, owners also on admins, and no one on an owner or on themselves. Logged as a `photo` change.
 */
export const removeFor = mutation({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    const actor = await requireStaff(ctx);
    if (ownerId === actor.user._id) throw new ConvexError("Hapus fotomu sendiri dari halaman Profil.");
    const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
    if (!profile?.completedAt) throw new ConvexError({ code: "NOT_FOUND", message: "Member tidak ditemukan." });
    const user = await authComponent.getAnyUserById(ctx, ownerId);
    const role = roleOf(user?.email ?? "", Boolean(user?.emailVerified), profile);
    if (role === "owner") throw new ConvexError("Foto pemilik tidak bisa dihapus dari dashboard.");
    if (role === "admin" && actor.role !== "owner") throw new ConvexError("Hanya pemilik yang bisa mengelola akun admin.");
    if (await clearPhoto(ctx, profile)) await logAccess(ctx, { actorId: actor.user._id, targetId: ownerId, change: "photo", from: "uploaded", to: "removed" });
  },
});
