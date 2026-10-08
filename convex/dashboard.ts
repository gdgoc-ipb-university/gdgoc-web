import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { components } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { authComponent, isReviewer } from "./auth";
import { dashboardAccess, isActive, requireMember, requireStaff, roleOf } from "./access";
import { memberType } from "./schema";
import { syncBoardVisibility } from "./bogorRun";
import { validateStaffRole } from "../src/lib/onboarding";
import { assignmentMaxScore, isLate, isStaleReview } from "../src/lib/assignment";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const access = await dashboardAccess(ctx);
    if (!access) return null;
    return {
      id: access.user._id, name: access.profile?.fullName || access.user.name, email: access.user.email,
      role: access.role, active: access.active, onboarded: Boolean(access.profile?.completedAt),
      reviewer: isReviewer(access.user.email, access.user.emailVerified, access.profile),
      memberType: access.profile?.memberType ?? null, division: access.profile?.division ?? null,
      campus: access.profile?.campus ?? "", studyProgram: access.profile?.studyProgram ?? "",
    };
  },
});

async function memberRow(ctx: QueryCtx | MutationCtx, profile: Doc<"memberProfiles">) {
  const user = await authComponent.getAnyUserById(ctx, profile.ownerId);
  const role = roleOf(user?.email ?? "", Boolean(user?.emailVerified), profile);
  return {
    ownerId: profile.ownerId, fullName: profile.fullName, campus: profile.campus, studyProgram: profile.studyProgram,
    email: user?.email ?? "", role, active: isActive(role, profile), joinedAt: profile.completedAt ?? profile._creationTime,
    memberType: profile.memberType ?? null, division: profile.division ?? null,
    // The granted permission only; owners and admins review by role and are not flagged here.
    reviewer: Boolean(profile.appreciationReviewer),
  };
}

export const members = query({
  args: {
    search: v.string(),
    filter: v.union(v.literal("all"), v.literal("admin"), v.literal("reviewer"), v.literal("core"), v.literal("bod"), v.literal("deactivated")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { search, filter, paginationOpts }) => {
    await requireStaff(ctx);
    const term = search.trim().slice(0, 80);
    const source = term
      ? ctx.db.query("memberProfiles").withSearchIndex("search_name", (q) => q.search("fullName", term))
      : ctx.db.query("memberProfiles").withIndex("by_completed", (q) => q.gt("completedAt", 0)).order("desc");
    const result = await source.filter((q) => {
      const onboarded = q.neq(q.field("completedAt"), undefined);
      if (filter === "admin") return q.and(onboarded, q.eq(q.field("role"), "admin"));
      if (filter === "reviewer") return q.and(onboarded, q.eq(q.field("appreciationReviewer"), true));
      if (filter === "core" || filter === "bod") return q.and(onboarded, q.eq(q.field("memberType"), filter));
      if (filter === "deactivated") return q.and(onboarded, q.neq(q.field("deactivatedAt"), undefined));
      return onboarded;
    }).paginate(paginationOpts);
    return { ...result, page: await Promise.all(result.page.map((profile) => memberRow(ctx, profile))) };
  },
});

/** One page of the members CSV. Owners only: it carries every member's email and leaves the dashboard. */
export const exportMembers = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const actor = await requireMember(ctx);
    if (actor.role !== "owner") throw new ConvexError({ code: "FORBIDDEN", message: "Hanya pemilik yang bisa mengunduh data anggota." });
    const result = await ctx.db.query("memberProfiles").withIndex("by_completed", (q) => q.gt("completedAt", 0)).paginate(paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map(async (profile) => {
        const row = await memberRow(ctx, profile);
        // Owners and admins review Apresiasi by role; others only with the grant.
        return { ...row, reviewer: row.role !== "member" || row.reviewer };
      })),
    };
  },
});

/** Everything staff need about one member: the profile, their assignment submissions and Apresiasi submissions (not drafts), the assignments they review, and who last changed their access. */
export const member = query({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    await requireStaff(ctx);
    const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
    if (!profile?.completedAt) return null;
    const [row, submissions, appreciations, recent] = await Promise.all([
      memberRow(ctx, profile),
      ctx.db.query("assignmentSubmissions").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("appreciations").withIndex("by_owner_updated", (q) => q.eq("ownerId", ownerId)).order("desc").collect(),
      ctx.db.query("assignments").withIndex("by_updated").order("desc").take(200),
    ]);
    const tasks = await Promise.all(submissions.map(async (submission) => {
      const assignment = await ctx.db.get(submission.assignmentId);
      if (!assignment) return null;
      return {
        _id: submission._id, assignmentId: assignment._id, slug: assignment.slug, title: assignment.title, status: assignment.status,
        submittedAt: submission.submittedAt, late: isLate(submission.submittedAt, assignment.dueAt),
        score: submission.score ?? null, maxScore: assignmentMaxScore(assignment), reviewedAt: submission.reviewedAt ?? null,
        stale: isStaleReview(submission), revisionRequestedAt: submission.revisionRequestedAt ?? null,
      };
    }));
    const updater = profile.accessUpdatedBy ? await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", profile.accessUpdatedBy!)).unique() : null;
    const updaterAccount = profile.accessUpdatedBy && !updater ? await authComponent.getAnyUserById(ctx, profile.accessUpdatedBy) : null;
    return {
      ...row,
      accessUpdatedBy: profile.accessUpdatedBy ? updater?.fullName || updaterAccount?.name || "Pengurus" : null,
      submissions: tasks.filter((task) => task !== null).sort((a, b) => b.submittedAt - a.submittedAt),
      appreciations: appreciations.filter((doc) => doc.status !== "draft").map((doc) => ({
        _id: doc._id, achievement: doc.values.achievement, level: doc.values.level, status: doc.status, submittedAt: doc.submittedAt ?? doc.updatedAt, postUrl: doc.postUrl ?? null,
      })),
      drafts: appreciations.filter((doc) => doc.status === "draft").length,
      reviewing: recent.filter((assignment) => assignment.reviewers?.includes(ownerId)).map((assignment) => ({ _id: assignment._id, slug: assignment.slug, title: assignment.title, status: assignment.status })),
    };
  },
});

/** Deletes every auth-component row of one model that belongs to a user, page by page. */
async function deleteAuthRows(ctx: MutationCtx, model: "session" | "account", userId: string) {
  let count = 0;
  let cursor: string | null = null;
  for (;;) {
    const result: { count?: number; isDone: boolean; continueCursor: string } = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model, where: [{ field: "userId", operator: "eq", value: userId }] },
      paginationOpts: { numItems: 200, cursor },
    });
    count += result.count ?? 0;
    if (result.isDone) return count;
    cursor = result.continueCursor;
  }
}

/**
 * Owners delete a member's account on request (`/privasi`): profile, Apresiasi, assignment submissions with their files
 * and review rows, pending uploads, Bogor Run rows, reviewer grants, and the sign-in account and sessions. Other people's
 * records keep the bare account ID they referenced (who reviewed, who changed access), which then resolves to no name.
 * `confirmName` must match the profile name, so a stray call cannot delete anyone. One accountDeletions row records the counts.
 */
export const deleteAccount = mutation({
  args: { ownerId: v.string(), confirmName: v.string() },
  handler: async (ctx, { ownerId, confirmName }) => {
    const actor = await requireMember(ctx);
    if (actor.role !== "owner") throw new ConvexError({ code: "FORBIDDEN", message: "Hanya pemilik yang bisa menghapus akun." });
    if (ownerId === actor.user._id) throw new ConvexError("Kamu tidak bisa menghapus akunmu sendiri dari sini.");
    const { profile, row } = await target(ctx, ownerId);
    if (row.role === "owner") throw new ConvexError("Akun pemilik diatur lewat konfigurasi server dan tidak bisa dihapus dari sini.");
    if (confirmName.trim() !== profile.fullName.trim()) throw new ConvexError({ code: "VALIDATION", message: "Ketik nama anggota persis seperti tertulis untuk konfirmasi." });

    const counts = { appreciations: 0, appreciationReviews: 0, submissions: 0, submissionReviews: 0, files: 0, gameRuns: 0, gameBests: 0, reviewerGrants: 0, sessions: 0, accounts: 0 };
    for (const doc of await ctx.db.query("appreciations").withIndex("by_owner_updated", (q) => q.eq("ownerId", ownerId)).collect()) {
      for (const review of await ctx.db.query("appreciationReviews").withIndex("by_appreciation", (q) => q.eq("appreciationId", doc._id)).collect()) { await ctx.db.delete(review._id); counts.appreciationReviews++; }
      await ctx.db.delete(doc._id); counts.appreciations++;
    }
    for (const submission of await ctx.db.query("assignmentSubmissions").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect()) {
      for (const review of await ctx.db.query("submissionReviews").withIndex("by_submission", (q) => q.eq("submissionId", submission._id)).collect()) { await ctx.db.delete(review._id); counts.submissionReviews++; }
      await ctx.db.delete(submission._id); counts.submissions++;
    }
    // Attached and pending uploads alike are indexed by owner.
    for (const file of await ctx.db.query("submissionFiles").withIndex("by_owner_assignment", (q) => q.eq("ownerId", ownerId)).collect()) {
      await ctx.storage.delete(file.storageId); await ctx.db.delete(file._id); counts.files++;
    }
    for (const run of await ctx.db.query("gameRuns").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect()) { await ctx.db.delete(run._id); counts.gameRuns++; }
    for (const best of await ctx.db.query("gameBests").withIndex("by_owner_period", (q) => q.eq("ownerId", ownerId)).collect()) { await ctx.db.delete(best._id); counts.gameBests++; }
    for (const player of await ctx.db.query("gamePlayers").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect()) await ctx.db.delete(player._id);
    for (const assignment of await ctx.db.query("assignments").collect()) {
      if (!assignment.reviewers?.includes(ownerId)) continue;
      await ctx.db.patch(assignment._id, { reviewers: assignment.reviewers.filter((id) => id !== ownerId) }); counts.reviewerGrants++;
    }
    await ctx.db.delete(profile._id);
    counts.sessions = await deleteAuthRows(ctx, "session", ownerId);
    counts.accounts = await deleteAuthRows(ctx, "account", ownerId);
    await ctx.runMutation(components.betterAuth.adapter.deleteOne, { input: { model: "user", where: [{ field: "_id", operator: "eq", value: ownerId }] } });
    await ctx.db.insert("accountDeletions", { deletedAt: Date.now(), deletedBy: actor.user._id, counts });
    return counts;
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const profiles = await ctx.db.query("memberProfiles").withIndex("by_completed", (q) => q.gt("completedAt", 0)).collect();
    return {
      members: profiles.length,
      admins: profiles.filter((profile) => profile.role === "admin").length,
      reviewers: profiles.filter((profile) => profile.appreciationReviewer).length,
      core: profiles.filter((profile) => profile.memberType === "core").length,
      bod: profiles.filter((profile) => profile.memberType === "bod").length,
      deactivated: profiles.filter((profile) => profile.deactivatedAt).length,
    };
  },
});

async function target(ctx: MutationCtx, ownerId: string) {
  const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
  if (!profile?.completedAt) throw new ConvexError({ code: "NOT_FOUND", message: "Member tidak ditemukan." });
  return { profile, row: await memberRow(ctx, profile) };
}

export const setRole = mutation({
  args: { ownerId: v.string(), role: v.union(v.literal("admin"), v.literal("member")) },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    if (actor.role !== "owner") throw new ConvexError({ code: "FORBIDDEN", message: "Hanya pemilik yang bisa mengubah peran admin." });
    const { profile, row } = await target(ctx, args.ownerId);
    if (row.role === "owner") throw new ConvexError("Peran pemilik diatur lewat konfigurasi server.");
    if (row.role === args.role) return;
    if (args.role === "admin" && !row.active) throw new ConvexError("Aktifkan kembali akun ini sebelum menjadikannya admin.");
    await ctx.db.patch(profile._id, { role: args.role === "admin" ? "admin" : undefined, accessUpdatedBy: actor.user._id });
  },
});

/** Owners grant or revoke Apresiasi review for an active member. Owners and admins review by role. */
export const setReviewer = mutation({
  args: { ownerId: v.string(), reviewer: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    if (actor.role !== "owner") throw new ConvexError({ code: "FORBIDDEN", message: "Hanya pemilik yang bisa mengatur peninjau apresiasi." });
    const { profile, row } = await target(ctx, args.ownerId);
    if (row.role === "owner") throw new ConvexError("Pemilik sudah menjadi peninjau lewat konfigurasi server.");
    if (args.reviewer && row.role === "admin") throw new ConvexError("Admin sudah bisa meninjau apresiasi.");
    if (row.reviewer === args.reviewer) return;
    if (args.reviewer && !row.active) throw new ConvexError("Aktifkan kembali akun ini sebelum menjadikannya peninjau.");
    await ctx.db.patch(profile._id, { appreciationReviewer: args.reviewer ? true : undefined, accessUpdatedBy: actor.user._id });
  },
});

export const setActive = mutation({
  args: { ownerId: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireStaff(ctx);
    if (args.ownerId === actor.user._id) throw new ConvexError("Kamu tidak bisa mengubah status akunmu sendiri.");
    const { profile, row } = await target(ctx, args.ownerId);
    if (row.role === "owner") throw new ConvexError("Akun pemilik tidak bisa dinonaktifkan dari dashboard.");
    if (row.role === "admin") throw new ConvexError(actor.role === "owner" ? "Turunkan peran admin terlebih dahulu." : "Hanya pemilik yang bisa mengelola akun admin.");
    if (row.active === args.active) return;
    await ctx.db.patch(profile._id, { deactivatedAt: args.active ? undefined : Date.now(), accessUpdatedBy: actor.user._id });
    // Deactivation also takes the member off the Bogor Run boards; reactivation brings them back unless staff hid them.
    await syncBoardVisibility(ctx, args.ownerId, !args.active);
  },
});

/** Staff set a member's community tag: correct a self-declared Member/Core Team, or assign BoD. */
export const setMemberType = mutation({
  args: { ownerId: v.string(), memberType, division: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const { profile } = await target(ctx, args.ownerId);
    const division = args.memberType === "member" ? "" : args.division.trim();
    const errors = validateStaffRole({ memberType: args.memberType, division });
    if (Object.keys(errors).length) throw new ConvexError(Object.values(errors)[0]!);
    await ctx.db.patch(profile._id, { memberType: args.memberType, division: division || undefined });
  },
});
