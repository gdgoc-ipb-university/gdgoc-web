import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authComponent, isOwner } from "./auth";
import { requireMember, requireStaff } from "./access";
import { logAccess } from "./accessLog";
import { parseRichDoc, richLength, richText } from "../src/lib/rich-text";
import { assignmentLimits, assignmentMaxScore, cleanFileName, fileProblem, fromJakartaInput, isLate, isStaleReview, maxSlugLength, maxSubmissionFiles, normalizeAssignment, parseRubric, pendingFileLifetime, reservedSlugs, slugify, validateAssignment, type RubricScore } from "../src/lib/assignment";

// `slug`, `maxScore` and `rubric` are optional so a tab loaded before they existed can still save; they are then derived (title), defaulted (100) or empty.
const assignmentInput = v.object({
  title: v.string(), slug: v.optional(v.string()), description: v.string(), dueAt: v.string(), maxScore: v.optional(v.string()),
  rubric: v.optional(v.array(v.object({ name: v.string(), max: v.string() }))),
});

function notFound(): never { throw new ConvexError({ code: "NOT_FOUND", message: "Tugas tidak ditemukan." }); }
function closed(): never { throw new ConvexError({ code: "CLOSED", message: "Pengumpulan tugas ini sudah ditutup." }); }
function conflict(): never {
  throw new ConvexError({ code: "CONFLICT", message: "Data ini berubah di tab atau perangkat lain. Muat ulang untuk memakai versi terbaru." });
}

function cleanAssignment(values: { title: string; slug?: string; description: string; dueAt: string; maxScore?: string; rubric?: { name: string; max: string }[] }) {
  const input = { ...values, slug: values.slug ?? "", maxScore: values.maxScore ?? "", rubric: values.rubric ?? [] };
  const errors = validateAssignment(input);
  if (Object.keys(errors).length) throw new ConvexError({ code: "VALIDATION", message: "Lengkapi isian yang ditandai.", fields: errors });
  const clean = normalizeAssignment(input);
  const rubric = clean.rubric!.length ? parseRubric(clean.rubric!) : undefined;
  return { title: clean.title, slug: clean.slug, description: clean.description, dueAt: fromJakartaInput(clean.dueAt), maxScore: Number(clean.maxScore), rubric };
}

/** Display name for an account: the onboarding name, else the Google name. */
async function nameOf(ctx: QueryCtx | MutationCtx, ownerId: string) {
  const [profile, user] = await Promise.all([
    ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique(),
    authComponent.getAnyUserById(ctx, ownerId),
  ]);
  return { name: profile?.fullName || user?.name || "Member", email: user?.email ?? "", campus: profile?.campus ?? "" };
}

/** The review fields a member or reviewer sees on a submission. */
async function reviewView(ctx: QueryCtx | MutationCtx, submission: Doc<"assignmentSubmissions">) {
  return {
    score: submission.score ?? null, breakdown: submission.breakdown ?? null, feedback: submission.feedback ?? null, reviewedAt: submission.reviewedAt ?? null,
    reviewerName: submission.reviewedBy ? (await nameOf(ctx, submission.reviewedBy)).name : null,
    stale: isStaleReview(submission), revisionRequestedAt: submission.revisionRequestedAt ?? null,
  };
}

export const maxReviewers = 10;

/** Staff, or an active, onboarded member staff added as a reviewer of this assignment. `staff` decides what reviewers do not get (emails, managing the assignment). */
async function requireReviewer(ctx: QueryCtx | MutationCtx, id: Id<"assignments">) {
  const access = await requireMember(ctx);
  const assignment = await ctx.db.get(id);
  if (!assignment) notFound();
  const staff = access.role !== "member";
  if (!staff && !(assignment.reviewers ?? []).includes(access.user._id)) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Akses ini hanya untuk admin GDGoC IPB dan penilai tugas ini." });
  }
  return { ...access, assignment, staff };
}

async function submissionFor(ctx: QueryCtx | MutationCtx, id: Id<"assignmentSubmissions">) {
  const submission = await ctx.db.get(id);
  if (!submission) throw new ConvexError({ code: "NOT_FOUND", message: "Kiriman tidak ditemukan." });
  return submission;
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
        return {
          ...assignment, submissionCount: submissions.length, lateCount: submissions.filter((item) => isLate(item.submittedAt, assignment.dueAt)).length,
          reviewedCount: submissions.filter((item) => item.reviewedAt !== undefined && !isStaleReview(item) && !item.revisionRequestedAt).length,
        };
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
      if (doc.title === values.title && doc.slug === values.slug && doc.description === values.description && doc.dueAt === values.dueAt && assignmentMaxScore(doc) === values.maxScore && JSON.stringify(doc.rubric ?? null) === JSON.stringify(values.rubric ?? null)) return doc.slug;
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
    const { assignment, staff } = await requireReviewer(ctx, id);
    const result = await ctx.db.query("assignmentSubmissions").withIndex("by_assignment_submitted", (q) => q.eq("assignmentId", id)).order("desc").paginate(paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map(async (submission) => {
        const [who, files, review] = await Promise.all([nameOf(ctx, submission.ownerId), attachedFiles(ctx, submission._id), reviewView(ctx, submission)]);
        return {
          _id: submission._id, revision: submission.revision, answer: submission.answer, answerDoc: submission.answerDoc ?? null, submittedAt: submission.submittedAt, late: isLate(submission.submittedAt, assignment.dueAt),
          ...who, email: staff ? who.email : "", ...review,
          files: await Promise.all(files.map((file) => fileView(ctx, file))),
        };
      })),
    };
  },
});

/** One page of the CSV export: what the staff list shows, without answers or file URLs. Emails are included for owners only, since the file leaves the dashboard. */
export const exportPage = query({
  args: { id: v.id("assignments"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { id, paginationOpts }) => {
    const { role, assignment } = await requireReviewer(ctx, id);
    const includesEmail = role === "owner";
    const result = await ctx.db.query("assignmentSubmissions").withIndex("by_assignment_submitted", (q) => q.eq("assignmentId", id)).paginate(paginationOpts);
    return {
      ...result, includesEmail,
      page: await Promise.all(result.page.map(async (submission) => {
        const [who, files, review] = await Promise.all([nameOf(ctx, submission.ownerId), attachedFiles(ctx, submission._id), reviewView(ctx, submission)]);
        return {
          name: who.name, email: includesEmail ? who.email : "", campus: who.campus,
          submittedAt: submission.submittedAt, late: isLate(submission.submittedAt, assignment.dueAt), ...review, fileNames: files.map((file) => file.name),
        };
      })),
    };
  },
});

/** Active, onboarded members without a submission. Staff and this assignment's reviewers are not expected to submit, so they are left out of both counts. */
export const missing = query({
  args: { id: v.id("assignments") },
  handler: async (ctx, { id }) => {
    const { staff, assignment } = await requireReviewer(ctx, id);
    // This assignment's reviewers judge it rather than submit to it.
    const reviewers = new Set(assignment.reviewers ?? []);
    const submitted = new Set((await submissionsOf(ctx, id)).map((item) => item.ownerId));
    const profiles = await ctx.db.query("memberProfiles").withIndex("by_completed", (q) => q.gt("completedAt", 0)).collect();
    const missing: { ownerId: string; name: string; email: string; campus: string }[] = [];
    let active = 0;
    for (const profile of profiles) {
      if (profile.deactivatedAt || profile.role === "admin" || reviewers.has(profile.ownerId)) continue;
      const user = await authComponent.getAnyUserById(ctx, profile.ownerId);
      if (isOwner(user?.email ?? "", Boolean(user?.emailVerified))) continue;
      active++;
      if (!submitted.has(profile.ownerId)) missing.push({ ownerId: profile.ownerId, name: profile.fullName, email: staff ? user?.email ?? "" : "", campus: profile.campus });
    }
    missing.sort((a, b) => a.name.localeCompare(b.name, "id"));
    return { active, submitted: active - missing.length, missing };
  },
});

/** Score and/or feedback for one submission. The latest review is kept on the submission; every review is kept in submissionReviews. */
export const review = mutation({
  // With a rubric, `points` (one per criterion, in order) is the way to score: they are stored with their criteria as `breakdown` and `score` becomes their sum. Without one, `score` is given directly.
  args: { submissionId: v.id("assignmentSubmissions"), submissionRevision: v.number(), score: v.optional(v.number()), points: v.optional(v.array(v.number())), feedback: v.string() },
  handler: async (ctx, args) => {
    const submission = await submissionFor(ctx, args.submissionId);
    const { user, assignment } = await requireReviewer(ctx, submission.assignmentId);
    // The reviewer graded what they saw; a resubmission since then needs a fresh look, not a silent overwrite.
    if (submission.revision !== args.submissionRevision) throw new ConvexError({ code: "CONFLICT", message: "Member memperbarui kirimannya setelah halaman ini dimuat. Muat ulang untuk menilai versi terbaru." });
    const feedback = args.feedback.trim();
    const maxScore = assignmentMaxScore(assignment);
    if (feedback.length > assignmentLimits.feedback) throw new ConvexError(`Umpan balik maksimal ${assignmentLimits.feedback} karakter.`);
    let score = args.score;
    let breakdown: RubricScore[] | undefined;
    const rubric = assignment.rubric ?? [];
    if (rubric.length) {
      if (args.points !== undefined) {
        if (args.points.length !== rubric.length) throw new ConvexError({ code: "CONFLICT", message: `Rubrik tugas ini punya ${rubric.length} kriteria. Muat ulang halaman untuk memakai rubrik terbaru.` });
        breakdown = args.points.map((points, index) => {
          const criterion = rubric[index];
          if (!Number.isInteger(points) || points < 0 || points > criterion.max) throw new ConvexError(`Poin "${criterion.name}" harus bilangan bulat 0 sampai ${criterion.max}.`);
          return { ...criterion, points };
        });
        score = breakdown.reduce((sum, entry) => sum + entry.points, 0);
      } else if (args.score !== undefined) {
        throw new ConvexError({ code: "VALIDATION", message: "Tugas ini memakai rubrik. Isi poin tiap kriteria, bukan satu nilai total." });
      }
    } else if (args.points !== undefined) {
      // The rubric was removed after the reviewer loaded the page.
      throw new ConvexError({ code: "CONFLICT", message: "Tugas ini tidak lagi memakai rubrik. Muat ulang halaman untuk memakai versi terbaru." });
    }
    if (score !== undefined && (!Number.isInteger(score) || score < 0 || score > maxScore)) throw new ConvexError(`Nilai harus bilangan bulat 0 sampai ${maxScore}.`);
    if (score === undefined && !feedback) throw new ConvexError({ code: "VALIDATION", message: "Isi nilai, umpan balik, atau keduanya." });
    const now = Date.now();
    await ctx.db.patch(submission._id, { score, breakdown, feedback: feedback || undefined, reviewedAt: now, reviewedBy: user._id });
    await ctx.db.insert("submissionReviews", { submissionId: submission._id, assignmentId: assignment._id, reviewerId: user._id, score, breakdown, feedback, createdAt: now });
  },
});

/** Asks one member to revise their submission, with a note. Their form reopens, even after the assignment is closed, until they resubmit. */
export const requestRevision = mutation({
  args: { submissionId: v.id("assignmentSubmissions"), submissionRevision: v.number(), note: v.string() },
  handler: async (ctx, args) => {
    const submission = await submissionFor(ctx, args.submissionId);
    const { user } = await requireReviewer(ctx, submission.assignmentId);
    if (submission.revision !== args.submissionRevision) throw new ConvexError({ code: "CONFLICT", message: "Member memperbarui kirimannya setelah halaman ini dimuat. Muat ulang untuk melihat versi terbaru." });
    const note = args.note.trim();
    if (!note) throw new ConvexError({ code: "VALIDATION", message: "Tulis apa yang perlu direvisi di kolom umpan balik." });
    if (note.length > assignmentLimits.feedback) throw new ConvexError(`Umpan balik maksimal ${assignmentLimits.feedback} karakter.`);
    const now = Date.now();
    // The score, if any, stays until the revision is reviewed.
    await ctx.db.patch(submission._id, { feedback: note, reviewedAt: now, reviewedBy: user._id, revisionRequestedAt: now });
    await ctx.db.insert("submissionReviews", { submissionId: submission._id, assignmentId: submission.assignmentId, reviewerId: user._id, score: submission.score, breakdown: submission.breakdown, feedback: note, revisionRequested: true, createdAt: now });
  },
});

/** Withdraws a revision request that the member has not answered yet. */
export const cancelRevision = mutation({
  args: { submissionId: v.id("assignmentSubmissions") },
  handler: async (ctx, { submissionId }) => {
    const submission = await submissionFor(ctx, submissionId);
    await requireReviewer(ctx, submission.assignmentId);
    if (submission.revisionRequestedAt) await ctx.db.patch(submission._id, { revisionRequestedAt: undefined });
  },
});

/** Staff add or remove a reviewer of one assignment: an active, onboarded member. Staff already review every assignment. */
export const setReviewer = mutation({
  args: { id: v.id("assignments"), ownerId: v.string(), reviewer: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireStaff(ctx);
    const assignment = await ctx.db.get(args.id);
    if (!assignment) notFound();
    const current = assignment.reviewers ?? [];
    const log = (from: string, to: string) => logAccess(ctx, { actorId: actor.user._id, targetId: args.ownerId, change: "assignmentReviewer", from, to, assignmentId: assignment._id });
    if (!args.reviewer) {
      if (!current.includes(args.ownerId)) return;
      await ctx.db.patch(assignment._id, { reviewers: current.filter((id) => id !== args.ownerId), updatedAt: Date.now() });
      await log("on", "off");
      return;
    }
    if (current.includes(args.ownerId)) return;
    const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId)).unique();
    if (!profile?.completedAt) throw new ConvexError({ code: "NOT_FOUND", message: "Member tidak ditemukan." });
    if (profile.deactivatedAt) throw new ConvexError("Aktifkan kembali akun ini sebelum menjadikannya penilai.");
    const account = await authComponent.getAnyUserById(ctx, args.ownerId);
    if (profile.role === "admin" || isOwner(account?.email ?? "", Boolean(account?.emailVerified))) throw new ConvexError("Admin dan pemilik sudah bisa menilai semua tugas.");
    if (current.length >= maxReviewers) throw new ConvexError(`Maksimal ${maxReviewers} penilai per tugas.`);
    await ctx.db.patch(assignment._id, { reviewers: [...current, args.ownerId], updatedAt: Date.now() });
    await log("off", "on");
  },
});

/** Assignments the signed-in member reviews, newest first, with how many submissions wait for a review. */
export const reviewing = query({
  args: {},
  handler: async (ctx) => {
    const { user, role } = await requireMember(ctx);
    if (role !== "member") return [];
    const recent = await ctx.db.query("assignments").withIndex("by_updated").order("desc").take(200);
    const mine = recent.filter((assignment) => assignment.reviewers?.includes(user._id));
    return Promise.all(mine.map(async (assignment) => {
      const submissions = await submissionsOf(ctx, assignment._id);
      const waiting = submissions.filter((item) => item.reviewedAt === undefined || isStaleReview(item)).length;
      return { _id: assignment._id, slug: assignment.slug, title: assignment.title, status: assignment.status, dueAt: assignment.dueAt, submissionCount: submissions.length, waiting };
    }));
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
        maxScore: assignmentMaxScore(assignment), score: mine?.score ?? null, reviewedAt: mine?.reviewedAt ?? null, stale: mine ? isStaleReview(mine) : false,
        revisionRequestedAt: mine?.revisionRequestedAt ?? null,
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
    const canManage = role !== "member";
    const canReview = canManage || Boolean(assignment?.reviewers?.includes(user._id));
    if (!assignment || (!canReview && assignment.status === "draft")) return null;
    const submission = await ctx.db.query("assignmentSubmissions").withIndex("by_assignment_owner", (q) => q.eq("assignmentId", assignment._id).eq("ownerId", user._id)).unique();
    const files = await ctx.db.query("submissionFiles").withIndex("by_owner_assignment", (q) => q.eq("ownerId", user._id).eq("assignmentId", assignment._id)).collect();
    return {
      assignment, canManage, canReview,
      // Staff see who reviews this assignment; reviewers do not need the list.
      reviewers: canManage ? await Promise.all((assignment.reviewers ?? []).map(async (ownerId) => ({ ownerId, name: (await nameOf(ctx, ownerId)).name }))) : [],
      submission: submission && { _id: submission._id, answer: submission.answer, answerDoc: submission.answerDoc ?? null, revision: submission.revision, submittedAt: submission.submittedAt, late: isLate(submission.submittedAt, assignment.dueAt), ...(await reviewView(ctx, submission)) },
      files: await Promise.all(files.map((file) => fileView(ctx, file))),
    };
  },
});

/** Whether this member may still submit: the assignment is open, or a reviewer asked them for a revision. */
async function acceptsFrom(ctx: MutationCtx, assignment: Doc<"assignments">, ownerId: string) {
  if (assignment.status === "published") return true;
  if (assignment.status !== "closed") return false;
  const mine = await ctx.db.query("assignmentSubmissions").withIndex("by_assignment_owner", (q) => q.eq("assignmentId", assignment._id).eq("ownerId", ownerId)).unique();
  return Boolean(mine?.revisionRequestedAt);
}

async function openAssignment(ctx: MutationCtx, id: Id<"assignments">, ownerId: string) {
  const assignment = await ctx.db.get(id);
  if (!assignment || assignment.status === "draft") notFound();
  if (!(await acceptsFrom(ctx, assignment, ownerId))) closed();
  return assignment;
}

export const generateUploadUrl = mutation({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, { assignmentId }) => {
    const { user } = await requireMember(ctx);
    await openAssignment(ctx, assignmentId, user._id);
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
    if (!(await acceptsFrom(ctx, assignment, user._id))) return reject("Pengumpulan tugas ini sudah ditutup.");
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
  // `answerDoc` is the rich-text JSON; older clients send only the plain `answer`.
  args: { assignmentId: v.id("assignments"), revision: v.number(), answer: v.string(), answerDoc: v.optional(v.string()), fileIds: v.array(v.id("submissionFiles")) },
  handler: async (ctx, args) => {
    const { user } = await requireMember(ctx);
    const assignment = await openAssignment(ctx, args.assignmentId, user._id);
    let answer = args.answer.trim();
    let answerDoc: string | undefined;
    if (args.answerDoc !== undefined) {
      const doc = parseRichDoc(args.answerDoc);
      if (!doc) throw new ConvexError({ code: "VALIDATION", message: "Format jawaban tidak dikenali. Muat ulang halaman, lalu coba lagi." });
      if (richLength(doc) > assignmentLimits.answer) throw new ConvexError(`Jawaban maksimal ${assignmentLimits.answer} karakter.`);
      answer = richText(doc);
      answerDoc = answer ? JSON.stringify(doc) : undefined;
    }
    const fileIds = [...new Set(args.fileIds)];
    if (answerDoc === undefined && answer.length > assignmentLimits.answer) throw new ConvexError(`Jawaban maksimal ${assignmentLimits.answer} karakter.`);
    if (fileIds.length > maxSubmissionFiles) throw new ConvexError(`Lampirkan maksimal ${maxSubmissionFiles} file.`);
    if (!answer && !fileIds.length) throw new ConvexError({ code: "VALIDATION", message: "Tulis jawaban atau lampirkan setidaknya satu file." });
    const existing = await ctx.db.query("assignmentSubmissions").withIndex("by_assignment_owner", (q) => q.eq("assignmentId", assignment._id).eq("ownerId", user._id)).unique();
    const previous = existing ? await attachedFiles(ctx, existing._id) : [];
    if ((existing?.revision ?? 0) !== args.revision) {
      const same = existing?.answer === answer && existing.answerDoc === answerDoc && previous.length === fileIds.length && previous.every((file) => fileIds.includes(file._id));
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
    const submissionId = existing?._id ?? await ctx.db.insert("assignmentSubmissions", { assignmentId: assignment._id, ownerId: user._id, answer, answerDoc, revision: 1, submittedAt });
    // Resubmitting answers a revision request; the review then shows as stale until it is looked at again.
    if (existing) await ctx.db.patch(existing._id, { answer, answerDoc, revision: existing.revision + 1, submittedAt, revisionRequestedAt: undefined });
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
