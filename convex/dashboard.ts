import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { authComponent, isReviewer } from "./auth";
import { dashboardAccess, isActive, requireMember, requireStaff, roleOf } from "./access";
import { memberType } from "./schema";
import { syncBoardVisibility } from "./bogorRun";
import { validateStaffRole } from "../src/lib/onboarding";

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
    // The granted permission only; owners review by role and are not flagged here.
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

/** Owners grant or revoke Apresiasi review for an active admin or member. Owners themselves review by role. */
export const setReviewer = mutation({
  args: { ownerId: v.string(), reviewer: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    if (actor.role !== "owner") throw new ConvexError({ code: "FORBIDDEN", message: "Hanya pemilik yang bisa mengatur peninjau apresiasi." });
    const { profile, row } = await target(ctx, args.ownerId);
    if (row.role === "owner") throw new ConvexError("Pemilik sudah menjadi peninjau lewat konfigurasi server.");
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
