import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { components } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { requireStaff } from "./access";
import { logAccess } from "./accessLog";
import { cohortRole, cohortStatus } from "./schema";
import { catalystCohort, inCohortRoles, normalizeCohort, normalizeEmail, validateCohort, type CohortValues } from "../src/lib/cohort";
import { importBatch, importLimits, isEmail } from "../src/lib/enrolment-import";

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

// ——— Roster (#104) ———

function invalid(message: string): never { throw new ConvexError({ code: "VALIDATION", message }); }

async function enrolmentFor(ctx: MutationCtx, id: Id<"enrolments">) {
  const enrolment = await ctx.db.get(id);
  if (!enrolment) throw new ConvexError({ code: "NOT_FOUND", message: "Peserta tidak ditemukan." });
  const cohort = await ctx.db.get(enrolment.cohortId);
  if (!cohort) notFound();
  return { enrolment, cohort };
}

/** The account that signed in with this verified email, if any, so an imported or corrected row links at once. */
async function accountFor(ctx: MutationCtx, email: string) {
  const user = await ctx.runQuery(components.betterAuth.adapter.findOne, { model: "user", where: [{ field: "email", operator: "eq", value: email }] });
  return user?.emailVerified ? String(user._id) : undefined;
}

/** Every cohort, newest first, with how many participants are active, signed in, and withdrawn. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const cohorts = await ctx.db.query("cohorts").order("desc").collect();
    return Promise.all(cohorts.map(async (cohort) => {
      const rows = await ctx.db.query("enrolments").withIndex("by_cohort_email", (q) => q.eq("cohortId", cohort._id)).collect();
      const active = rows.filter((row) => row.status === "active");
      return { _id: cohort._id, slug: cohort.slug, name: cohort.name, status: cohort.status, roles: cohort.roles, active: active.length, claimed: active.filter((row) => row.ownerId).length, withdrawn: rows.length - active.length };
    }));
  },
});

/** One cohort and all its participants for staff, with each signed-in participant's profile name and campus. */
export const roster = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireStaff(ctx);
    const cohort = await ctx.db.query("cohorts").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!cohort) return null;
    const rows = await ctx.db.query("enrolments").withIndex("by_cohort_email", (q) => q.eq("cohortId", cohort._id)).collect();
    return {
      cohort: { _id: cohort._id, slug: cohort.slug, name: cohort.name, status: cohort.status, roles: cohort.roles },
      rows: await Promise.all(rows.map(async (row) => {
        const profile = row.ownerId ? await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", row.ownerId!)).unique() : null;
        return {
          _id: row._id, email: row.email, name: row.name, role: row.role, status: row.status, ownerId: row.ownerId ?? null, claimedAt: row.claimedAt ?? null,
          importedAt: row.importedAt, fullName: profile?.fullName ?? null, campus: profile?.campus ?? null,
        };
      })),
    };
  },
});

/**
 * Adds or updates participants from the oprec results, matched by email: a new email is added (and linked at once if
 * that account already exists), a known one gets the name and role from the file. Status is never changed by an import,
 * so a withdrawn participant stays withdrawn. Role changes go to the access log.
 */
export const importEnrolments = mutation({
  args: { cohortId: v.id("cohorts"), rows: v.array(v.object({ email: v.string(), name: v.string(), role: v.string() })) },
  handler: async (ctx, { cohortId, rows }) => {
    const { user } = await requireStaff(ctx);
    const cohort = await ctx.db.get(cohortId);
    if (!cohort) notFound();
    if (rows.length > importBatch) invalid(`Maksimal ${importBatch} baris sekali kirim.`);
    const keys = new Set(cohort.roles.map((role) => role.key));
    const seen = new Set<string>();
    const clean = rows.map((row) => {
      const email = normalizeEmail(row.email);
      const name = row.name.replace(/\s+/g, " ").trim();
      if (!isEmail(email)) invalid(`Email “${email}” tidak valid.`);
      if (seen.has(email)) invalid(`Email ${email} muncul lebih dari sekali.`);
      if (!name || name.length > importLimits.name) invalid(`Nama untuk ${email} kosong atau terlalu panjang.`);
      if (!keys.has(row.role)) invalid(`Peran “${row.role}” tidak ada di ${cohort.name}.`);
      seen.add(email);
      return { email, name, role: row.role };
    });
    const now = Date.now();
    const result = { added: 0, updated: 0, unchanged: 0, linked: 0 };
    for (const row of clean) {
      const existing = await ctx.db.query("enrolments").withIndex("by_cohort_email", (q) => q.eq("cohortId", cohortId).eq("email", row.email)).first();
      if (existing) {
        if (existing.name === row.name && existing.role === row.role) { result.unchanged++; continue; }
        await ctx.db.patch(existing._id, { name: row.name, role: row.role });
        if (existing.role !== row.role) await logAccess(ctx, { actorId: user._id, targetId: existing.ownerId ?? "", change: "enrolmentRole", from: existing.role, to: row.role, cohortId, enrolmentId: existing._id });
        result.updated++;
        continue;
      }
      const ownerId = await accountFor(ctx, row.email);
      await ctx.db.insert("enrolments", { cohortId, ...row, status: "active", importedAt: now, importedBy: user._id, ...(ownerId ? { ownerId, claimedAt: now } : {}) });
      result.added++;
      if (ownerId) result.linked++;
    }
    return result;
  },
});

export const setRole = mutation({
  args: { id: v.id("enrolments"), role: v.string() },
  handler: async (ctx, { id, role }) => {
    const { user } = await requireStaff(ctx);
    const { enrolment, cohort } = await enrolmentFor(ctx, id);
    if (!cohort.roles.some((item) => item.key === role)) invalid(`Peran “${role}” tidak ada di ${cohort.name}.`);
    if (enrolment.role === role) return;
    await ctx.db.patch(id, { role });
    await logAccess(ctx, { actorId: user._id, targetId: enrolment.ownerId ?? "", change: "enrolmentRole", from: enrolment.role, to: role, cohortId: cohort._id, enrolmentId: id });
  },
});

/** Withdraws a participant (their row and submissions stay; cohort assignments no longer reach them) or brings them back. */
export const setStatus = mutation({
  args: { id: v.id("enrolments"), status: v.union(v.literal("active"), v.literal("withdrawn")) },
  handler: async (ctx, { id, status }) => {
    const { user } = await requireStaff(ctx);
    const { enrolment, cohort } = await enrolmentFor(ctx, id);
    if (enrolment.status === status) return;
    await ctx.db.patch(id, status === "withdrawn" ? { status, withdrawnAt: Date.now(), withdrawnBy: user._id } : { status, withdrawnAt: undefined, withdrawnBy: undefined });
    await logAccess(ctx, { actorId: user._id, targetId: enrolment.ownerId ?? "", change: "enrolmentStatus", from: enrolment.status, to: status, cohortId: cohort._id, enrolmentId: id });
  },
});

/**
 * Corrects a participant's email, e.g. when they signed in with another Gmail than the one on the form. The row is unlinked
 * from its previous account and linked to the account of the new email if it exists; otherwise it waits for that sign-in.
 */
export const setEmail = mutation({
  args: { id: v.id("enrolments"), email: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireStaff(ctx);
    const { enrolment, cohort } = await enrolmentFor(ctx, args.id);
    const email = normalizeEmail(args.email);
    if (!isEmail(email)) invalid("Isi email yang valid.");
    if (email === enrolment.email) return { linked: Boolean(enrolment.ownerId) };
    const taken = await ctx.db.query("enrolments").withIndex("by_cohort_email", (q) => q.eq("cohortId", cohort._id).eq("email", email)).first();
    if (taken) invalid(`Email ${email} sudah terdaftar di ${cohort.name}.`);
    const ownerId = await accountFor(ctx, email);
    await ctx.db.patch(args.id, { email, ownerId, claimedAt: ownerId ? Date.now() : undefined });
    await logAccess(ctx, { actorId: user._id, targetId: ownerId ?? enrolment.ownerId ?? "", change: "enrolmentEmail", from: "email", to: "email", cohortId: cohort._id, enrolmentId: args.id });
    return { linked: Boolean(ownerId) };
  },
});

/** The caller's own active enrolment, by verified email, so onboarding can greet a participant before they finish it. */
export const myInvitation = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user?.emailVerified) return null;
    const rows = await ctx.db.query("enrolments").withIndex("by_email", (q) => q.eq("email", normalizeEmail(user.email))).collect();
    const row = rows.find((item) => item.status === "active" && (item.ownerId === undefined || item.ownerId === user._id));
    const cohort = row && await ctx.db.get(row.cohortId);
    if (!row || !cohort) return null;
    return { cohort: cohort.name, role: cohort.roles.find((role) => role.key === row.role)?.name ?? row.role };
  },
});
