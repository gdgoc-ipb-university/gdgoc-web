import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { requireMember, requireStaff } from "./access";
import { assignmentLimits, cleanFileName, fileProblem, fromJakartaInput, isLate, maxSlugLength, maxSubmissionFiles, normalizeAssignment, pendingFileLifetime, reservedSlugs, slugify, validateAssignment } from "../src/lib/assignment";

// `slug` is optional so a tab loaded before slugs existed can still save; it is then derived from the title.
const assignmentInput = v.object({ title: v.string(), slug: v.optional(v.string()), description: v.string(), dueAt: v.string() });

function notFound(): never { throw new ConvexError({ code: "NOT_FOUND", message: "Tugas tidak ditemukan." }); }
function closed(): never { throw new ConvexError({ code: "CLOSED", message: "Pengumpulan tugas ini sudah ditutup." }); }
function conflict(): never {
  throw new ConvexError({ code: "CONFLICT", message: "Data ini berubah di tab atau perangkat lain. Muat ulang untuk memakai versi terbaru." });
}

function cleanAssignment(values: { title: string; slug?: string; description: string; dueAt: string }) {
  const input = { ...values, slug: values.slug ?? "" };
  const errors = validateAssignment(input);
  if (Object.keys(errors).length) throw new ConvexError({ code: "VALIDATION", message: "Lengkapi isian yang ditandai.", fields: errors });
  const clean = normalizeAssignment(input);
  return { title: clean.title, slug: clean.slug, description: clean.description, dueAt: fromJakartaInput(clean.dueAt) };
}

async function slugOwner(ctx: QueryCtx | MutationCtx, slug: string) {
  return ctx.db.query("assignmentSlugs").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
}

/** The requested slug, or the first free `-2`, `-3`… variant. A slug this assignment used before stays its own. */
async function availableSlug(ctx: QueryCtx | MutationCtx, requested: string, id?: Id<"assignments">) {
  const base = slugify(requested) || "tugas";
  for (let n = 1; n <= 500; n++) {
    const suffix = n === 1 ? "" : `-${n}`;
    const candidate = base.slice(0, maxSlugLength - suffix.length).replace(/-+$/, "") + suffix;
    if (reservedSlugs.includes(candidate)) continue;
    const owner = await slugOwner(ctx, candidate);
    if (!owner || owner.assignmentId === id) return candidate;
  }
  throw new ConvexError("Slug ini sudah terlalu sering dipakai. Pilih slug lain.");
}

async function claimSlug(ctx: MutationCtx, id: Id<"assignments">, slug: string) {
  if (!(await slugOwner(ctx, slug))) await ctx.db.insert("assignmentSlugs", { slug, assignmentId: id });
}

async function findAssignment(ctx: QueryCtx, slugOrId: string) {
  const bySlug = await slugOwner(ctx, slugOrId);
  const id = bySlug?.assignmentId ?? ctx.db.normalizeId("assignments", slugOrId);
  return id ? ctx.db.get(id) : null;
}

async function submissionsOf(ctx: QueryCtx | MutationCtx, id: Id<"assignments">) {
  return ctx.db.query("assignmentSubmissions").withIndex("by_assignment_submitted", (q) => q.eq("assignmentId", id)).collect();
}

async function fileView(ctx: QueryCtx, file: Doc<"submissionFiles">) {
  return { _id: file._id, name: file.name, size: file.size, contentType: file.contentType, attached: Boolean(file.submissionId), url: await ctx.storage.getUrl(file.storageId) };
}

async function attachedFiles(ctx: QueryCtx | MutationCtx, submissionId: Id<"assignmentSubmissions">) {
  return ctx.db.query("submissionFiles").withIndex("by_submission", (q) => q.eq("submissionId", submissionId)).collect();
}

async function removeFiles(ctx: MutationCtx, files: Doc<"submissionFiles">[]) {
  for (const file of files) {
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(file._id);
  }
}

// ——— Administrators ———

export const adminList = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireStaff(ctx);
    const result = await ctx.db.query("assignments").withIndex("by_updated").order("desc").paginate(paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map(async (assignment) => {
        const submissions = await submissionsOf(ctx, assignment._id);
        return { ...assignment, submissionCount: submissions.length, lateCount: submissions.filter((item) => isLate(item.submittedAt, assignment.dueAt)).length };
      })),
    };
  },
});

/** The slug a create or update would receive, for live feedback in the form. */
export const slugPreview = query({
  args: { slug: v.string(), id: v.optional(v.id("assignments")) },
  handler: async (ctx, { slug, id }) => {
    await requireStaff(ctx);
    return availableSlug(ctx, slug.slice(0, 200), id);
  },
});

export const create = mutation({
  args: { values: assignmentInput, publish: v.boolean() },
  handler: async (ctx, { values, publish }) => {
    const { user } = await requireStaff(ctx);
    const now = Date.now();
    const clean = cleanAssignment(values);
    const slug = await availableSlug(ctx, clean.slug);
    const id = await ctx.db.insert("assignments", {
      ...clean, slug, status: publish ? "published" : "draft", revision: 0,
      createdBy: user._id, createdAt: now, updatedAt: now, ...(publish ? { publishedAt: now } : {}),
    });
    await claimSlug(ctx, id, slug);
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("assignments"), revision: v.number(), values: assignmentInput },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc) notFound();
    const clean = cleanAssignment(args.values);
    // Keep the current slug unless a different one was requested.
    const slug = args.values.slug === undefined && doc.slug ? doc.slug : await availableSlug(ctx, clean.slug, doc._id);
    const values = { ...clean, slug };
    if (doc.revision !== args.revision) {
      // A retried request after an acknowledged write is not a conflict.
      if (doc.title === values.title && doc.slug === values.slug && doc.description === values.description && doc.dueAt === values.dueAt) return doc.slug;
      conflict();
    }
    await ctx.db.patch(doc._id, { ...values, revision: doc.revision + 1, updatedAt: Date.now() });
    await claimSlug(ctx, doc._id, slug);
    return slug;
  },
});

export const setStatus = mutation({
  args: { id: v.id("assignments"), revision: v.number(), status: v.union(v.literal("draft"), v.literal("published"), v.literal("closed")) },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc) notFound();
    if (doc.status === args.status) return;
    if (doc.revision !== args.revision) conflict();
    if (args.status === "draft" && (await submissionsOf(ctx, doc._id)).length) {
      throw new ConvexError("Tugas yang sudah menerima kiriman tidak bisa dikembalikan ke draft. Tutup tugas untuk menghentikan pengumpulan.");
    }
    const now = Date.now();
    await ctx.db.patch(doc._id, { status: args.status, revision: doc.revision + 1, updatedAt: now, publishedAt: doc.publishedAt ?? (args.status === "published" ? now : undefined) });
  },
});

export const remove = mutation({
  args: { id: v.id("assignments"), revision: v.number() },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc) return;
    if (doc.revision !== args.revision) conflict();
    if ((await submissionsOf(ctx, doc._id)).length) throw new ConvexError("Tugas yang sudah menerima kiriman tidak bisa dihapus. Tutup tugas sebagai gantinya.");
    await removeFiles(ctx, await ctx.db.query("submissionFiles").withIndex("by_assignment", (q) => q.eq("assignmentId", doc._id)).collect());
    for (const slug of await ctx.db.query("assignmentSlugs").withIndex("by_assignment", (q) => q.eq("assignmentId", doc._id)).collect()) await ctx.db.delete(slug._id);
    await ctx.db.delete(doc._id);
  },
});

export const submissions = query({
  args: { id: v.id("assignments"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { id, paginationOpts }) => {
    await requireStaff(ctx);
    const assignment = await ctx.db.get(id);
    if (!assignment) notFound();
    const result = await ctx.db.query("assignmentSubmissions").withIndex("by_assignment_submitted", (q) => q.eq("assignmentId", id)).order("desc").paginate(paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map(async (submission) => {
        const [profile, user, files] = await Promise.all([
          ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", submission.ownerId)).unique(),
          authComponent.getAnyUserById(ctx, submission.ownerId),
          attachedFiles(ctx, submission._id),
        ]);
        return {
          _id: submission._id, answer: submission.answer, submittedAt: submission.submittedAt, late: isLate(submission.submittedAt, assignment.dueAt),
          name: profile?.fullName || user?.name || "Member", email: user?.email ?? "", campus: profile?.campus ?? "",
          files: await Promise.all(files.map((file) => fileView(ctx, file))),
        };
      })),
    };
  },
});

// ——— Members ———

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireMember(ctx);
    const [open, ended] = await Promise.all([
      ctx.db.query("assignments").withIndex("by_status_due", (q) => q.eq("status", "published")).order("asc").take(100),
      ctx.db.query("assignments").withIndex("by_status_due", (q) => q.eq("status", "closed")).order("desc").take(50),
    ]);
    return Promise.all([...open, ...ended].map(async (assignment) => {
      const mine = await ctx.db.query("assignmentSubmissions").withIndex("by_assignment_owner", (q) => q.eq("assignmentId", assignment._id).eq("ownerId", user._id)).unique();
      return {
        _id: assignment._id, slug: assignment.slug, title: assignment.title, summary: assignment.description.slice(0, 220), dueAt: assignment.dueAt, status: assignment.status,
        submittedAt: mine?.submittedAt ?? null, late: mine ? isLate(mine.submittedAt, assignment.dueAt) : false,
      };
    }));
  },
});

export const get = query({
  // A slug (current or previous) or, for older links, the assignment ID.
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const { user, role } = await requireMember(ctx);
    const assignment = await findAssignment(ctx, args.id);
    if (!assignment || (role === "member" && assignment.status === "draft")) return null;
    const submission = await ctx.db.query("assignmentSubmissions").withIndex("by_assignment_owner", (q) => q.eq("assignmentId", assignment._id).eq("ownerId", user._id)).unique();
    const files = await ctx.db.query("submissionFiles").withIndex("by_owner_assignment", (q) => q.eq("ownerId", user._id).eq("assignmentId", assignment._id)).collect();
    return {
      assignment, canManage: role !== "member",
      submission: submission && { _id: submission._id, answer: submission.answer, revision: submission.revision, submittedAt: submission.submittedAt, late: isLate(submission.submittedAt, assignment.dueAt) },
      files: await Promise.all(files.map((file) => fileView(ctx, file))),
    };
  },
});

async function openAssignment(ctx: MutationCtx, id: Id<"assignments">) {
  const assignment = await ctx.db.get(id);
  if (!assignment || assignment.status === "draft") notFound();
  if (assignment.status === "closed") closed();
  return assignment;
}

export const generateUploadUrl = mutation({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, { assignmentId }) => {
    await requireMember(ctx);
    await openAssignment(ctx, assignmentId);
    return ctx.storage.generateUploadUrl();
  },
});

/** Registers an uploaded file as pending. Rejections delete the upload and return a message instead of throwing, so the deletion commits. */
export const attachFile = mutation({
  args: { assignmentId: v.id("assignments"), storageId: v.id("_storage"), name: v.string() },
  handler: async (ctx, args): Promise<{ fileId: Id<"submissionFiles"> } | { error: string }> => {
    const { user } = await requireMember(ctx);
    const claimed = await ctx.db.query("submissionFiles").withIndex("by_storage", (q) => q.eq("storageId", args.storageId)).unique();
    if (claimed) {
      if (claimed.ownerId === user._id && claimed.assignmentId === args.assignmentId) return { fileId: claimed._id };
      throw new ConvexError("File tidak ditemukan. Unggah ulang file tersebut.");
    }
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (!metadata) throw new ConvexError("File tidak ditemukan. Unggah ulang file tersebut.");
    const reject = async (error: string) => { await ctx.storage.delete(args.storageId); return { error }; };
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment || assignment.status === "draft") return reject("Tugas tidak ditemukan.");
    if (assignment.status === "closed") return reject("Pengumpulan tugas ini sudah ditutup.");
    const name = cleanFileName(args.name);
    const problem = fileProblem(name, metadata.contentType, metadata.size);
    if (problem) return reject(problem);
    const existing = await ctx.db.query("submissionFiles").withIndex("by_owner_assignment", (q) => q.eq("ownerId", user._id).eq("assignmentId", assignment._id)).collect();
    if (existing.length >= maxSubmissionFiles * 2) return reject("Terlalu banyak file tersimpan untuk tugas ini. Hapus file yang tidak dipakai terlebih dahulu.");
    const fileId = await ctx.db.insert("submissionFiles", {
      assignmentId: assignment._id, ownerId: user._id, storageId: args.storageId, name,
      contentType: metadata.contentType ?? "application/octet-stream", size: metadata.size, createdAt: Date.now(),
    });
    return { fileId };
  },
});

export const removeFile = mutation({
  args: { fileId: v.id("submissionFiles") },
  handler: async (ctx, { fileId }) => {
    const { user } = await requireMember(ctx);
    const file = await ctx.db.get(fileId);
    if (!file || file.ownerId !== user._id) return;
    if (file.submissionId) throw new ConvexError("File ini bagian dari kiriman. Hapus dari daftar, lalu kirim ulang tugasmu.");
    await removeFiles(ctx, [file]);
  },
});

export const submit = mutation({
  args: { assignmentId: v.id("assignments"), revision: v.number(), answer: v.string(), fileIds: v.array(v.id("submissionFiles")) },
  handler: async (ctx, args) => {
    const { user } = await requireMember(ctx);
    const assignment = await openAssignment(ctx, args.assignmentId);
    const answer = args.answer.trim();
    const fileIds = [...new Set(args.fileIds)];
    if (answer.length > assignmentLimits.answer) throw new ConvexError(`Jawaban maksimal ${assignmentLimits.answer} karakter.`);
    if (fileIds.length > maxSubmissionFiles) throw new ConvexError(`Lampirkan maksimal ${maxSubmissionFiles} file.`);
    if (!answer && !fileIds.length) throw new ConvexError({ code: "VALIDATION", message: "Tulis jawaban atau lampirkan setidaknya satu file." });
    const existing = await ctx.db.query("assignmentSubmissions").withIndex("by_assignment_owner", (q) => q.eq("assignmentId", assignment._id).eq("ownerId", user._id)).unique();
    const previous = existing ? await attachedFiles(ctx, existing._id) : [];
    if ((existing?.revision ?? 0) !== args.revision) {
      const same = existing?.answer === answer && previous.length === fileIds.length && previous.every((file) => fileIds.includes(file._id));
      if (existing && same) return existing._id;
      conflict();
    }
    const files = await Promise.all(fileIds.map((id) => ctx.db.get(id)));
    for (const file of files) {
      if (!file || file.ownerId !== user._id || file.assignmentId !== assignment._id || (file.submissionId && file.submissionId !== existing?._id)) {
        throw new ConvexError("Salah satu file tidak ditemukan. Unggah ulang file tersebut.");
      }
    }
    const submittedAt = Date.now();
    const submissionId = existing?._id ?? await ctx.db.insert("assignmentSubmissions", { assignmentId: assignment._id, ownerId: user._id, answer, revision: 1, submittedAt });
    if (existing) await ctx.db.patch(existing._id, { answer, revision: existing.revision + 1, submittedAt });
    for (const file of files) if (!file!.submissionId) await ctx.db.patch(file!._id, { submissionId });
    await removeFiles(ctx, previous.filter((file) => !fileIds.includes(file._id)));
    return submissionId;
  },
});

// ——— Maintenance ———

export const cleanupUploads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - pendingFileLifetime;
    await removeFiles(ctx, await ctx.db.query("submissionFiles").withIndex("by_submission", (q) => q.eq("submissionId", undefined).lt("createdAt", cutoff)).take(200));
    // Uploads that were never registered (closed tab, failed request). Assignment
    // submissions are the only feature that stores files; extend this check if that changes.
    const uploads = await ctx.db.system.query("_storage").withIndex("by_creation_time", (q) => q.gt("_creationTime", cutoff - 2 * pendingFileLifetime).lt("_creationTime", cutoff)).take(500);
    for (const upload of uploads) {
      if (!(await ctx.db.query("submissionFiles").withIndex("by_storage", (q) => q.eq("storageId", upload._id)).unique())) await ctx.storage.delete(upload._id);
    }
  },
});
