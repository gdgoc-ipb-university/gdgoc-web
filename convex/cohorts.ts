import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { requireStaff } from "./access";
import { cohortRole, cohortStatus } from "./schema";
import { catalystCohort, inCohortRoles, normalizeCohort, normalizeEmail, validateCohort, type CohortValues } from "../src/lib/cohort";

const cohortInput = v.object({ slug: v.string(), name: v.string(), roles: v.array(cohortRole), attendanceTarget: v.optional(v.number()) });

function notFound(): never { throw new ConvexError({ code: "NOT_FOUND", message: "Cohort tidak ditemukan." }); }

function cleanCohort(values: CohortValues) {
  const clean = normalizeCohort(values);
  const errors = validateCohort(clean);
  if (Object.keys(errors).length) throw new ConvexError({ code: "VALIDATION", message: "Lengkapi isian yang ditandai.", fields: errors });
  return clean;
}

async function slugTaken(ctx: QueryCtx | MutationCtx, slug: string, id?: Id<"cohorts">) {
  const existing = await ctx.db.query("cohorts").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
  return Boolean(existing && existing._id !== id);
}

/** The active enrolments an account has claimed, as cohort → role, so a list of assignments is checked without a query each. */
export async function enrolledRoles(ctx: QueryCtx | MutationCtx, ownerId: string) {
  const rows = await ctx.db.query("enrolments").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect();
  return new Map(rows.filter((row) => row.status === "active").map((row) => [row.cohortId, row.role]));
}

/** The roles an account mentors, per cohort. */
export async function mentoredRoles(ctx: QueryCtx | MutationCtx, ownerId: string) {
  const rows = await ctx.db.query("cohortMentors").withIndex("by_owner_cohort", (q) => q.eq("ownerId", ownerId)).collect();
  const roles = new Map<Id<"cohorts">, Set<string>>();
  for (const row of rows) roles.set(row.cohortId, (roles.get(row.cohortId) ?? new Set()).add(row.role));
  return roles;
}

/** Whether a mentor of these roles reviews the assignment: it belongs to that cohort and is for at least one of them. */
export function mentors(assignment: Pick<Doc<"assignments">, "cohortId" | "cohortRoles">, mentored: Map<Id<"cohorts">, Set<string>>) {
  const roles = assignment.cohortId && mentored.get(assignment.cohortId);
  return Boolean(roles && [...roles].some((role) => inCohortRoles(assignment, role)));
}

export const create = mutation({
  args: { values: cohortInput },
  handler: async (ctx, { values }) => {
    const { user } = await requireStaff(ctx);
    const clean = cleanCohort(values);
    if (await slugTaken(ctx, clean.slug)) throw new ConvexError({ code: "VALIDATION", message: "Slug ini sudah dipakai cohort lain.", fields: { slug: "Slug ini sudah dipakai cohort lain." } });
    const now = Date.now();
    return ctx.db.insert("cohorts", { ...clean, status: "setup", createdBy: user._id, createdAt: now, updatedAt: now });
  },
});

/** Edits a cohort. A role that enrolments, mentors, or assignments still use cannot be removed; its name can change. */
export const update = mutation({
  args: { id: v.id("cohorts"), values: cohortInput, status: cohortStatus },
  handler: async (ctx, { id, values, status }) => {
    await requireStaff(ctx);
    const cohort = await ctx.db.get(id);
    if (!cohort) notFound();
    const clean = cleanCohort(values);
    if (await slugTaken(ctx, clean.slug, id)) throw new ConvexError({ code: "VALIDATION", message: "Slug ini sudah dipakai cohort lain.", fields: { slug: "Slug ini sudah dipakai cohort lain." } });
    const kept = new Set(clean.roles.map((role) => role.key));
    const assignments = await ctx.db.query("assignments").withIndex("by_cohort", (q) => q.eq("cohortId", id)).collect();
    for (const { key, name } of cohort.roles.filter((role) => !kept.has(role.key))) {
      const enrolled = await ctx.db.query("enrolments").withIndex("by_cohort_role", (q) => q.eq("cohortId", id).eq("role", key)).first();
      const mentor = await ctx.db.query("cohortMentors").withIndex("by_cohort_role", (q) => q.eq("cohortId", id).eq("role", key)).first();
      if (enrolled || mentor || assignments.some((assignment) => assignment.cohortRoles?.includes(key))) {
        throw new ConvexError({ code: "VALIDATION", message: `Peran ${name} masih dipakai peserta, mentor, atau tugas.`, fields: { roles: `Peran ${name} masih dipakai.` } });
      }
    }
    await ctx.db.patch(id, { ...clean, attendanceTarget: clean.attendanceTarget, status, updatedAt: Date.now() });
  },
});

/**
 * Links every unclaimed enrolment for the caller's verified email to their account. The dashboard calls it on each load;
 * once claimed, a row keeps its account even if another account later signs in with the same address.
 */
export const claimMine = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user?.emailVerified) return 0;
    const rows = await ctx.db.query("enrolments").withIndex("by_email", (q) => q.eq("email", normalizeEmail(user.email))).collect();
    const unclaimed = rows.filter((row) => row.ownerId === undefined);
    const now = Date.now();
    for (const row of unclaimed) await ctx.db.patch(row._id, { ownerId: user._id, claimedAt: now });
    return unclaimed.length;
  },
});

/** Creates GDGoC Catalyst 2026/27 once (`npx convex run cohorts:seedCatalyst`); running it again changes nothing. */
export const seedCatalyst = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("cohorts").withIndex("by_slug", (q) => q.eq("slug", catalystCohort.slug)).first();
    if (existing) return existing._id;
    const now = Date.now();
    return ctx.db.insert("cohorts", { ...catalystCohort, status: "setup", createdBy: "seed", createdAt: now, updatedAt: now });
  },
});
