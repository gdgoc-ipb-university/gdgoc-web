import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { components } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { authComponent, isOwner } from "./auth";
import { requireMember, requireStaff } from "./access";
import { logAccess } from "./accessLog";
import { cohortRole, cohortStatus } from "./schema";
import { catalystCohort, inCohortRoles, normalizeCohort, normalizeEmail, normalizeTeamName, teamNameProblem, validateCohort, type CohortValues } from "../src/lib/cohort";
import { importBatch, importLimits, isEmail } from "../src/lib/enrolment-import";
import { isLate } from "../src/lib/assignment";
import { solveOf } from "./flags";

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
    const mentorRows = await ctx.db.query("cohortMentors").withIndex("by_cohort_role", (q) => q.eq("cohortId", cohort._id)).collect();
    const teams = await ctx.db.query("teams").withIndex("by_cohort", (q) => q.eq("cohortId", cohort._id)).collect();
    return {
      cohort: { _id: cohort._id, slug: cohort.slug, name: cohort.name, status: cohort.status, roles: cohort.roles },
      teams: teams.map((team) => ({ _id: team._id, name: team.name })).sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true })),
      mentors: await Promise.all(mentorRows.map(async (row) => {
        const [profile, user] = await Promise.all([
          ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", row.ownerId)).unique(),
          authComponent.getAnyUserById(ctx, row.ownerId),
        ]);
        return { _id: row._id, ownerId: row.ownerId, role: row.role, name: profile?.fullName || user?.name || "Member", active: !profile?.deactivatedAt };
      })),
      rows: await Promise.all(rows.map(async (row) => {
        const profile = row.ownerId ? await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", row.ownerId!)).unique() : null;
        return {
          _id: row._id, email: row.email, name: row.name, role: row.role, status: row.status, ownerId: row.ownerId ?? null, claimedAt: row.claimedAt ?? null, teamId: row.teamId ?? null,
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

/**
 * A cohort's active participants as name and email, for the chapter's member import on gdg.community.dev (Bevy). Owners
 * only, like the members CSV: it is personal data leaving the site. The profile name wins once a participant signed in.
 */
export const exportBevy = query({
  args: { cohortId: v.id("cohorts") },
  handler: async (ctx, { cohortId }) => {
    const actor = await requireMember(ctx);
    if (actor.role !== "owner") throw new ConvexError({ code: "FORBIDDEN", message: "Hanya pemilik yang bisa mengunduh data peserta untuk Bevy." });
    const rows = await ctx.db.query("enrolments").withIndex("by_cohort_email", (q) => q.eq("cohortId", cohortId)).collect();
    return Promise.all(rows.filter((row) => row.status === "active").map(async (row) => {
      const profile = row.ownerId ? await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", row.ownerId!)).unique() : null;
      return { email: row.email, name: profile?.fullName || row.name };
    }));
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

// ——— Mentors (#105) ———

export const maxMentors = 10;

/**
 * Staff add or remove a mentor of one role, like `assignments.setReviewer`: an active, onboarded member who is not staff
 * and not a participant of this cohort. A mentor reviews every task of the cohort that includes their role and sees that
 * role's participants by name. Both changes go to the access log.
 */
export const setMentor = mutation({
  args: { cohortId: v.id("cohorts"), ownerId: v.string(), role: v.string(), mentor: v.boolean() },
  handler: async (ctx, args) => {
    const { user } = await requireStaff(ctx);
    const cohort = await ctx.db.get(args.cohortId);
    if (!cohort) notFound();
    if (!cohort.roles.some((role) => role.key === args.role)) invalid(`Peran “${args.role}” tidak ada di ${cohort.name}.`);
    const rows = await ctx.db.query("cohortMentors").withIndex("by_cohort_role", (q) => q.eq("cohortId", cohort._id).eq("role", args.role)).collect();
    const existing = rows.find((row) => row.ownerId === args.ownerId);
    const log = (from: string, to: string) => logAccess(ctx, { actorId: user._id, targetId: args.ownerId, change: "cohortMentor", from, to, cohortId: cohort._id });
    if (!args.mentor) {
      if (!existing) return;
      await ctx.db.delete(existing._id);
      await log(args.role, "off");
      return;
    }
    if (existing) return;
    const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId)).unique();
    if (!profile?.completedAt) throw new ConvexError({ code: "NOT_FOUND", message: "Member tidak ditemukan." });
    if (profile.deactivatedAt) invalid("Aktifkan kembali akun ini sebelum menjadikannya mentor.");
    const account = await authComponent.getAnyUserById(ctx, args.ownerId);
    if (profile.role === "admin" || isOwner(account?.email ?? "", Boolean(account?.emailVerified))) invalid("Admin dan pemilik sudah bisa menilai semua tugas.");
    const enrolled = await ctx.db.query("enrolments").withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId)).collect();
    if (enrolled.some((row) => row.cohortId === cohort._id && row.status === "active")) invalid(`Peserta ${cohort.name} tidak bisa menjadi mentornya.`);
    if (rows.length >= maxMentors) invalid(`Maksimal ${maxMentors} mentor per peran.`);
    await ctx.db.insert("cohortMentors", { cohortId: cohort._id, ownerId: args.ownerId, role: args.role, addedBy: user._id, addedAt: Date.now() });
    await log("off", args.role);
  },
});

/**
 * The roles the signed-in member mentors, each with its active participants by name only (#32, decision 5): no emails, no
 * campus. Empty for anyone who mentors nothing.
 */
export const mentoring = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireMember(ctx);
    const mentored = await mentoredRoles(ctx, user._id);
    const result = await Promise.all([...mentored].map(async ([cohortId, keys]) => {
      const cohort = await ctx.db.get(cohortId);
      if (!cohort) return null;
      const roles = await Promise.all(cohort.roles.filter((role) => keys.has(role.key)).map(async (role) => {
        const rows = await ctx.db.query("enrolments").withIndex("by_cohort_role", (q) => q.eq("cohortId", cohortId).eq("role", role.key)).collect();
        const names = await Promise.all(rows.filter((row) => row.status === "active").map(async (row) => {
          const profile = row.ownerId ? await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", row.ownerId!)).unique() : null;
          return profile?.fullName || row.name;
        }));
        return { key: role.key, name: role.name, participants: names.sort((a, b) => a.localeCompare(b, "id")) };
      }));
      return { _id: cohort._id, name: cohort.name, roles };
    }));
    return result.filter((item) => item !== null);
  },
});

// ——— Teams (#107) ———

async function teamFor(ctx: MutationCtx, id: Id<"teams">) {
  const team = await ctx.db.get(id);
  if (!team) throw new ConvexError({ code: "NOT_FOUND", message: "Tim tidak ditemukan." });
  return team;
}

/** A clean team name that no other team of the cohort uses, ignoring case. */
async function teamName(ctx: MutationCtx, cohortId: Id<"cohorts">, raw: string, id?: Id<"teams">) {
  const name = normalizeTeamName(raw);
  const problem = teamNameProblem(name);
  if (problem) invalid(problem);
  const teams = await ctx.db.query("teams").withIndex("by_cohort", (q) => q.eq("cohortId", cohortId)).collect();
  if (teams.some((team) => team._id !== id && team.name.toLowerCase() === name.toLowerCase())) invalid(`Nama tim “${name}” sudah dipakai.`);
  return name;
}

export const createTeam = mutation({
  args: { cohortId: v.id("cohorts"), name: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireStaff(ctx);
    if (!(await ctx.db.get(args.cohortId))) notFound();
    const now = Date.now();
    return ctx.db.insert("teams", { cohortId: args.cohortId, name: await teamName(ctx, args.cohortId, args.name), createdBy: user._id, createdAt: now, updatedAt: now });
  },
});

export const renameTeam = mutation({
  args: { id: v.id("teams"), name: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const team = await teamFor(ctx, args.id);
    await ctx.db.patch(team._id, { name: await teamName(ctx, team.cohortId, args.name, team._id), updatedAt: Date.now() });
  },
});

/** Deletes a team; its participants stay in the cohort without a team. */
export const deleteTeam = mutation({
  args: { id: v.id("teams") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const team = await teamFor(ctx, id);
    for (const row of await ctx.db.query("enrolments").withIndex("by_team", (q) => q.eq("teamId", team._id)).collect()) await ctx.db.patch(row._id, { teamId: undefined });
    await ctx.db.delete(team._id);
  },
});

/** Puts an active participant in a team of their cohort, moving them out of any other, or takes them out with null. */
export const setTeam = mutation({
  args: { id: v.id("enrolments"), teamId: v.union(v.id("teams"), v.null()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const { enrolment, cohort } = await enrolmentFor(ctx, args.id);
    if (args.teamId === null) {
      if (enrolment.teamId) await ctx.db.patch(enrolment._id, { teamId: undefined });
      return;
    }
    const team = await teamFor(ctx, args.teamId);
    if (team.cohortId !== cohort._id) invalid(`Tim “${team.name}” bukan tim ${cohort.name}.`);
    if (enrolment.status !== "active") invalid("Aktifkan kembali peserta ini sebelum memasukkannya ke tim.");
    if (enrolment.teamId !== team._id) await ctx.db.patch(enrolment._id, { teamId: team._id });
  },
});

/**
 * The signed-in participant's teams: each cohort where their active enrolment has a team, with the team's name and the
 * other active members' names only (no emails, no campus). Withdrawn teammates are left out.
 */
export const myTeams = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireMember(ctx);
    const mine = (await ctx.db.query("enrolments").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect()).filter((row) => row.status === "active" && row.teamId);
    const result = await Promise.all(mine.map(async (row) => {
      const [team, cohort] = await Promise.all([ctx.db.get(row.teamId!), ctx.db.get(row.cohortId)]);
      if (!team || !cohort) return null;
      return { _id: team._id, name: team.name, cohort: cohort.name, teammates: await teammatesOf(ctx, row, team._id, cohort) };
    }));
    return result.filter((item) => item !== null);
  },
});

/** A participant's other active teammates by name (profile, else the form) and role name, sorted by name. */
async function teammatesOf(ctx: QueryCtx, row: Doc<"enrolments">, teamId: Id<"teams">, cohort: Doc<"cohorts">) {
  const others = (await ctx.db.query("enrolments").withIndex("by_team", (q) => q.eq("teamId", teamId)).collect()).filter((item) => item._id !== row._id && item.status === "active");
  const teammates = await Promise.all(others.map(async (item) => {
    const profile = item.ownerId ? await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", item.ownerId!)).unique() : null;
    return { name: profile?.fullName || item.name, role: roleName(cohort, item.role) };
  }));
  return teammates.sort((a, b) => a.name.localeCompare(b.name, "id"));
}

function roleName(cohort: Doc<"cohorts">, key: string) {
  return cohort.roles.find((role) => role.key === key)?.name ?? key;
}

// ——— Participant overview (#106) ———

/**
 * The signed-in participant's own program view for the dashboard overview: for each active enrolment in a cohort that has
 * not ended, the cohort, their role, their team and teammates' names once staff assign one, and the open tasks for their
 * role with whether they submitted. No emails and nothing of other roles; empty for anyone not enrolled. Sessions and
 * attendance join this once they exist (#109).
 */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireMember(ctx);
    const rows = (await ctx.db.query("enrolments").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect()).filter((row) => row.status === "active");
    const result = await Promise.all(rows.map(async (row) => {
      const cohort = await ctx.db.get(row.cohortId);
      if (!cohort || cohort.status === "ended") return null;
      const team = row.teamId ? await ctx.db.get(row.teamId) : null;
      const open = (await ctx.db.query("assignments").withIndex("by_cohort", (q) => q.eq("cohortId", cohort._id)).collect())
        .filter((assignment) => assignment.status === "published" && inCohortRoles(assignment, row.role))
        .sort((a, b) => a.dueAt - b.dueAt);
      const tasks = await Promise.all(open.map(async (assignment) => {
        const mine = await ctx.db.query("assignmentSubmissions").withIndex("by_assignment_owner", (q) => q.eq("assignmentId", assignment._id).eq("ownerId", user._id)).unique();
        const solve = assignment.kind === "flag" ? await solveOf(ctx, assignment._id, user._id) : null;
        return {
          _id: assignment._id, slug: assignment.slug, title: assignment.title, dueAt: assignment.dueAt, kind: assignment.kind ?? null, points: solve?.points ?? null,
          submittedAt: mine?.submittedAt ?? solve?.solvedAt ?? null, late: mine ? isLate(mine.submittedAt, assignment.dueAt) : false, revisionRequestedAt: mine?.revisionRequestedAt ?? null,
        };
      }));
      return {
        _id: row._id, cohort: { name: cohort.name, slug: cohort.slug }, role: { key: row.role, name: roleName(cohort, row.role) },
        team: team && { name: team.name, teammates: await teammatesOf(ctx, row, team._id, cohort) }, tasks,
      };
    }));
    return result.filter((item) => item !== null);
  },
});
