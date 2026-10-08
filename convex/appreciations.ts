import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authComponent, isReviewer } from "./auth";
import { appreciationValues } from "./schema";
import { emptyAppreciation, fieldLimits, isInstagramPostUrl, matchesQueueFilter, normalizeAppreciation, queueSearchLimits, validateAppreciation } from "../src/lib/appreciation";
import { memberTypeLabels } from "../src/lib/onboarding";

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user || !user.emailVerified) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Masuk kembali dengan akun Google untuk melanjutkan." });
  return user;
}

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await requireUser(ctx);
  const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
  if (!isReviewer(user.email, user.emailVerified, profile)) throw new ConvexError({ code: "FORBIDDEN", message: "Akses ini hanya untuk tim peninjau." });
  return user;
}

async function owned(ctx: QueryCtx | MutationCtx, id: Id<"appreciations">, ownerId: string) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.ownerId !== ownerId) throw new ConvexError({ code: "NOT_FOUND", message: "Kiriman tidak ditemukan." });
  return doc;
}

/** A reviewer's display name: the onboarding name, else the Google name. */
async function reviewerName(ctx: QueryCtx, ownerId: string) {
  const [profile, account] = await Promise.all([
    ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique(),
    authComponent.getAnyUserById(ctx, ownerId),
  ]);
  return profile?.fullName || account?.name || "Peninjau";
}

/** A queue row: the record plus who is handling it (the reviewer who last moved it to "Sedang ditinjau"). */
async function queueRow(ctx: QueryCtx, doc: Doc<"appreciations">) {
  return { ...doc, handlerName: doc.status === "reviewing" && doc.reviewedBy ? await reviewerName(ctx, doc.reviewedBy) : null };
}

const queueStatus = v.union(v.literal("submitted"), v.literal("reviewing"), v.literal("revision"), v.literal("published"));

function conflict(): never {
  throw new ConvexError({ code: "CONFLICT", message: "Draft ini berubah di tab atau perangkat lain. Muat versi terbaru sebelum melanjutkan." });
}

export const mine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return ctx.db.query("appreciations").withIndex("by_owner_updated", (q) => q.eq("ownerId", user._id)).order("desc").paginate(args.paginationOpts);
  },
});

export const get = query({
  args: { id: v.id("appreciations") },
  handler: async (ctx, { id }) => owned(ctx, id, (await requireUser(ctx))._id),
});

export const create = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    const user = await requireUser(ctx);
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(clientId)) throw new ConvexError("ID draft tidak valid.");
    const existing = await ctx.db.query("appreciations").withIndex("by_owner_client", (q) => q.eq("ownerId", user._id).eq("clientId", clientId)).unique();
    if (existing) return existing._id;
    const drafts = await ctx.db.query("appreciations").withIndex("by_owner_updated", (q) => q.eq("ownerId", user._id)).filter((q) => q.eq(q.field("status"), "draft")).take(10);
    if (drafts.length >= 10) throw new ConvexError("Kamu sudah punya 10 draft. Lanjutkan atau hapus salah satunya terlebih dahulu.");
    const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
    return ctx.db.insert("appreciations", {
      ownerId: user._id, ownerName: user.name, ownerEmail: user.email, clientId,
      values: {
        ...emptyAppreciation, fullName: profile?.fullName || user.name, campus: profile?.campus ?? "", studyProgram: profile?.studyProgram ?? "",
        memberType: profile?.memberType ? memberTypeLabels[profile.memberType] : "",
      },
      status: "draft", revision: 0, updatedAt: Date.now(),
    });
  },
});

export const save = mutation({
  args: { id: v.id("appreciations"), revision: v.number(), values: appreciationValues },
  handler: async (ctx, args) => {
    const doc = await owned(ctx, args.id, (await requireUser(ctx))._id);
    if (!["draft", "revision"].includes(doc.status)) throw new ConvexError({ code: "LOCKED", message: "Kiriman ini sudah terkirim dan sedang diproses." });
    if (doc.revision !== args.revision) {
      // A transport retry after an acknowledged write must not create a false conflict.
      if ((Object.keys(emptyAppreciation) as (keyof typeof emptyAppreciation)[]).every((key) => doc.values[key] === args.values[key])) return { revision: doc.revision, updatedAt: doc.updatedAt };
      return conflict();
    }
    for (const [field, limit] of Object.entries(fieldLimits)) {
      if (args.values[field as keyof typeof fieldLimits].length > limit) throw new ConvexError(`Isian ${field} terlalu panjang.`);
    }
    const updatedAt = Date.now();
    const revision = doc.revision + 1;
    await ctx.db.patch(args.id, { values: args.values, updatedAt, revision });
    return { revision, updatedAt };
  },
});

export const submit = mutation({
  args: { id: v.id("appreciations"), revision: v.number() },
  handler: async (ctx, args) => {
    const doc = await owned(ctx, args.id, (await requireUser(ctx))._id);
    if (!["draft", "revision"].includes(doc.status)) return doc._id;
    if (doc.revision !== args.revision) return conflict();
    const values = normalizeAppreciation(doc.values);
    const errors = validateAppreciation(values);
    if (values.memberType === "BoD" && !errors.memberType) {
      const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", doc.ownerId)).unique();
      if (profile?.memberType !== "bod") errors.memberType = "Peran BoD hanya untuk pengurus yang ditetapkan admin.";
    }
    if (Object.keys(errors).length) throw new ConvexError({ code: "VALIDATION", message: "Lengkapi isian yang ditandai sebelum mengirim.", fields: errors });
    const now = Date.now();
    await ctx.db.patch(doc._id, { values, status: "submitted", submittedAt: now, updatedAt: now, revision: doc.revision + 1 });
    return doc._id;
  },
});

export const removeDraft = mutation({
  args: { id: v.id("appreciations"), revision: v.number() },
  handler: async (ctx, args) => {
    const doc = await owned(ctx, args.id, (await requireUser(ctx))._id);
    if (doc.status !== "draft") throw new ConvexError("Hanya draft yang belum dikirim yang bisa dihapus.");
    if (doc.revision !== args.revision) return conflict();
    await ctx.db.delete(doc._id);
  },
});

export const queue = query({
  args: { status: queueStatus, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result = await ctx.db.query("appreciations").withIndex("by_status_updated", (q) => q.eq("status", args.status)).order("desc").paginate(args.paginationOpts);
    return { ...result, page: await Promise.all(result.page.map((doc) => queueRow(ctx, doc))) };
  },
});

/** The queue filtered by search, level and campus. Scans the latest submissions of one status, so `truncated` says when older ones were not checked. */
export const search = query({
  args: { status: queueStatus, search: v.string(), level: v.string(), campus: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const filter = { search: args.search.slice(0, 160), level: args.level, campus: args.campus.slice(0, 150) };
    const scanned = await ctx.db.query("appreciations").withIndex("by_status_updated", (q) => q.eq("status", args.status)).order("desc").take(queueSearchLimits.scanned);
    const matches = scanned.filter((doc) => matchesQueueFilter(doc, filter));
    return {
      results: await Promise.all(matches.slice(0, queueSearchLimits.results).map((doc) => queueRow(ctx, doc))),
      truncated: scanned.length === queueSearchLimits.scanned || matches.length > queueSearchLimits.results,
    };
  },
});

/** Every review action on one submission, oldest first, with the reviewer's name. */
export const history = query({
  args: { id: v.id("appreciations") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("appreciationReviews").withIndex("by_appreciation", (q) => q.eq("appreciationId", id)).collect();
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return Promise.all(rows.map(async (row) => ({ _id: row._id, status: row.status, note: row.note, postUrl: row.postUrl, createdAt: row.createdAt, reviewerName: await reviewerName(ctx, row.reviewerId) })));
  },
});

export const review = mutation({
  args: {
    id: v.id("appreciations"), revision: v.number(),
    status: v.union(v.literal("reviewing"), v.literal("revision"), v.literal("published")),
    note: v.string(), postUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.status === "draft") throw new ConvexError("Kiriman tidak ditemukan.");
    if (doc.revision !== args.revision) return conflict();
    if (doc.status === "published" || doc.status === "revision") throw new ConvexError("Kiriman ini sudah selesai ditinjau. Tunggu pengirim mengirim ulang jika perlu revisi.");
    const note = args.note.trim();
    const postUrl = args.postUrl.trim();
    if (note.length > 1500) throw new ConvexError("Catatan maksimal 1.500 karakter.");
    if (args.status === "revision" && !note) throw new ConvexError("Jelaskan apa yang perlu dilengkapi pengirim.");
    if (args.status === "published" && !isInstagramPostUrl(postUrl)) throw new ConvexError("Cantumkan link postingan Instagram yang sudah terbit.");
    const now = Date.now();
    await ctx.db.patch(doc._id, {
      status: args.status, reviewNote: note, postUrl: args.status === "published" ? postUrl : undefined,
      reviewedAt: now, reviewedBy: user._id, updatedAt: now, revision: doc.revision + 1,
    });
    await ctx.db.insert("appreciationReviews", {
      appreciationId: doc._id, reviewerId: user._id, status: args.status,
      note, postUrl: args.status === "published" ? postUrl : "", createdAt: now,
    });
  },
});
