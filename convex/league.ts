import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { dashboardAccess, requireMember, requireStaff } from "./access";
import { authComponent } from "./auth";
import { newNonce } from "./bogorRunToken";
import { leagueTrack } from "./schema";
import {
  inviteTokenPattern, leagueSeason, leagueTeamSize, newTeamCode, normalizeTeamName, teamNameProblem, teamStanding, trackName,
} from "../src/lib/league-team";
import { normalizeEmail } from "../src/lib/cohort";
import { registrationBatch } from "../src/lib/league-import";

// Tech League teams (#183). Every function checks that the caller is an active, onboarded member (requireMember), so
// every teammate is a GDGoC IPB member, not only the captain. Each mutation is one Convex transaction: a join reads the
// team's member rows and writes the team, so two joins racing for the last place conflict and the retry sees it full.

function fail(code: string, message: string): never { throw new ConvexError({ code, message }); }

async function membershipOf(ctx: QueryCtx | MutationCtx, ownerId: string) {
  return ctx.db.query("leagueTeamMembers").withIndex("by_owner", (q) => q.eq("ownerId", ownerId).eq("season", leagueSeason)).first();
}

async function membersOf(ctx: QueryCtx | MutationCtx, teamId: Id<"leagueTeams">) {
  return ctx.db.query("leagueTeamMembers").withIndex("by_team", (q) => q.eq("teamId", teamId)).collect();
}

/** A clean team name that no other team of the season uses, ignoring case. */
async function teamName(ctx: MutationCtx, raw: string, id?: Id<"leagueTeams">) {
  const name = normalizeTeamName(raw);
  const problem = teamNameProblem(name);
  if (problem) fail("VALIDATION", problem);
  const teams = await ctx.db.query("leagueTeams").withIndex("by_season", (q) => q.eq("season", leagueSeason)).collect();
  if (teams.some((team) => team._id !== id && team.name.toLowerCase() === name.toLowerCase())) fail("VALIDATION", `Nama tim “${name}” sudah dipakai tim lain.`);
  return name;
}

async function uniqueCode(ctx: MutationCtx) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = newTeamCode();
    if (!(await ctx.db.query("leagueTeams").withIndex("by_code", (q) => q.eq("code", code)).first())) return code;
  }
  fail("RETRY", "Belum bisa membuat kode tim. Coba lagi.");
}

/** The caller's team this season and their row in it. */
async function myTeam(ctx: MutationCtx) {
  const access = await requireMember(ctx);
  const row = await membershipOf(ctx, access.user._id);
  const team = row && await ctx.db.get(row.teamId);
  if (!row || !team) fail("NOT_IN_TEAM", "Kamu belum punya tim Tech League.");
  return { ...access, row, team };
}

async function captainTeam(ctx: MutationCtx) {
  const mine = await myTeam(ctx);
  if (mine.team.captainId !== mine.user._id) fail("FORBIDDEN", "Hanya kapten tim yang bisa melakukan ini.");
  return mine;
}

/** Another member of the caller's team, by their row. */
async function teammate(ctx: MutationCtx, team: Doc<"leagueTeams">, self: Doc<"leagueTeamMembers">, id: Id<"leagueTeamMembers">) {
  const row = await ctx.db.get(id);
  if (!row || row.teamId !== team._id) fail("NOT_FOUND", "Anggota ini tidak ada di timmu.");
  if (row._id === self._id) fail("VALIDATION", "Pilih anggota lain.");
  return row;
}

async function profileName(ctx: QueryCtx, ownerId: string) {
  const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
  return profile?.fullName || "Member";
}

/**
 * The caller's place in Tech League: whether they can take part (signed in, onboarded, active) and their team this
 * season with its members by name. Only the captain gets the invite token. No emails or campuses.
 */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const access = await dashboardAccess(ctx);
    if (!access) return { eligible: false as const, reason: "signedOut" as const };
    if (!access.profile?.completedAt) return { eligible: false as const, reason: "onboarding" as const };
    if (!access.active) return { eligible: false as const, reason: "deactivated" as const };
    const row = await membershipOf(ctx, access.user._id);
    const team = row && await ctx.db.get(row.teamId);
    if (!row || !team) return { eligible: true as const, team: null };
    const rows = await membersOf(ctx, team._id);
    const captain = team.captainId === access.user._id;
    return {
      eligible: true as const,
      team: {
        _id: team._id, name: team.name, track: team.track, trackName: trackName(team.track), code: team.code,
        captain, inviteToken: captain ? team.inviteToken : null, trackLocked: Boolean(team.submittedAt),
        standing: teamStanding(team, rows.length), size: leagueTeamSize,
        members: await Promise.all(rows.map(async (item) => ({
          _id: item._id, name: await profileName(ctx, item.ownerId), captain: item.ownerId === team.captainId, you: item._id === row._id, joinedAt: item.joinedAt,
        }))),
      },
    };
  },
});

/** What an invite link opens, for a member deciding to join: the team's name, track, captain and room. Null when the link is wrong or old. */
export const invite = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const { user } = await requireMember(ctx);
    if (!inviteTokenPattern.test(token)) return null;
    const team = await ctx.db.query("leagueTeams").withIndex("by_invite", (q) => q.eq("inviteToken", token)).first();
    if (!team || team.season !== leagueSeason) return null;
    const [rows, mine] = await Promise.all([membersOf(ctx, team._id), membershipOf(ctx, user._id)]);
    return {
      name: team.name, trackName: trackName(team.track), captain: team.captainId ? await profileName(ctx, team.captainId) : null,
      members: rows.length, max: leagueTeamSize.max, full: rows.length >= leagueTeamSize.max,
      joined: mine?.teamId === team._id, inOtherTeam: Boolean(mine && mine.teamId !== team._id),
    };
  },
});

/** Creates a team for a track; the caller becomes its captain and first member. */
export const create = mutation({
  args: { name: v.string(), track: leagueTrack },
  handler: async (ctx, args) => {
    const { user } = await requireMember(ctx);
    if (await membershipOf(ctx, user._id)) fail("IN_TEAM", "Kamu sudah punya tim Tech League musim ini.");
    const now = Date.now();
    const teamId = await ctx.db.insert("leagueTeams", {
      season: leagueSeason, name: await teamName(ctx, args.name), track: args.track, code: await uniqueCode(ctx), inviteToken: newNonce(),
      captainId: user._id, createdBy: user._id, createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("leagueTeamMembers", { teamId, season: leagueSeason, ownerId: user._id, joinedAt: now });
    return teamId;
  },
});

/** Joins the team of an invite link, if it has room and the caller has no team this season. Joining again changes nothing. */
export const join = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const { user } = await requireMember(ctx);
    const team = inviteTokenPattern.test(token) ? await ctx.db.query("leagueTeams").withIndex("by_invite", (q) => q.eq("inviteToken", token)).first() : null;
    if (!team || team.season !== leagueSeason) fail("NOT_FOUND", "Tautan undangan ini tidak berlaku. Minta tautan baru ke kapten timmu.");
    const mine = await membershipOf(ctx, user._id);
    if (mine?.teamId === team._id) return team._id;
    if (mine) fail("IN_TEAM", "Kamu sudah punya tim Tech League musim ini. Keluar dulu dari tim itu untuk bergabung.");
    const rows = await membersOf(ctx, team._id);
    if (rows.length >= leagueTeamSize.max) fail("FULL", `Tim ini sudah penuh (${leagueTeamSize.max} orang).`);
    const now = Date.now();
    await ctx.db.insert("leagueTeamMembers", { teamId: team._id, season: leagueSeason, ownerId: user._id, joinedAt: now });
    // A team flagged without a captain (removeRow) gets the first member back as captain.
    await ctx.db.patch(team._id, { updatedAt: now, ...(team.captainId ? {} : { captainId: user._id }) });
    return team._id;
  },
});

/**
 * Leaves the caller's team. A leaving captain passes captaincy to the member who joined earliest. When the last member
 * leaves, the team is deleted, or kept without a captain for staff if it is already registered.
 */
export const leave = mutation({
  args: {},
  handler: async (ctx) => {
    const { row, team } = await myTeam(ctx);
    await removeRow(ctx, team, row);
  },
});

/**
 * Takes one member row out of its team and keeps the team valid: the earliest other member becomes captain when the
 * captain went. With no one left, an unregistered team is deleted; a registered one stays, flagged without a captain,
 * so staff see that a registered team lost its members. Leaving, removal and account deletion all come here.
 */
export async function removeRow(ctx: MutationCtx, team: Doc<"leagueTeams">, row: Doc<"leagueTeamMembers">) {
  await ctx.db.delete(row._id);
  const rest = await membersOf(ctx, team._id);
  if (!rest.length) {
    if (team.registration) return ctx.db.patch(team._id, { captainId: undefined, updatedAt: Date.now() });
    return ctx.db.delete(team._id);
  }
  const captainId = team.captainId === row.ownerId ? rest[0].ownerId : team.captainId;
  await ctx.db.patch(team._id, { captainId, updatedAt: Date.now() });
}

/** The captain makes another member captain and stays in the team. */
export const handOver = mutation({
  args: { memberId: v.id("leagueTeamMembers") },
  handler: async (ctx, { memberId }) => {
    const { row, team } = await captainTeam(ctx);
    const next = await teammate(ctx, team, row, memberId);
    await ctx.db.patch(team._id, { captainId: next.ownerId, updatedAt: Date.now() });
  },
});

export const removeMember = mutation({
  args: { memberId: v.id("leagueTeamMembers") },
  handler: async (ctx, { memberId }) => {
    const { row, team } = await captainTeam(ctx);
    await removeRow(ctx, team, await teammate(ctx, team, row, memberId));
  },
});

/** A new invite link; the old one stops working at once. */
export const rotateInvite = mutation({
  args: {},
  handler: async (ctx) => {
    const { team } = await captainTeam(ctx);
    const inviteToken = newNonce();
    await ctx.db.patch(team._id, { inviteToken, updatedAt: Date.now() });
    return inviteToken;
  },
});

export const rename = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const { team } = await captainTeam(ctx);
    await ctx.db.patch(team._id, { name: await teamName(ctx, args.name, team._id), updatedAt: Date.now() });
  },
});

/** Moves the team to another track while nothing is submitted; the team code stays. */
export const changeTrack = mutation({
  args: { track: leagueTrack },
  handler: async (ctx, { track }) => {
    const { team } = await captainTeam(ctx);
    if (team.submittedAt) fail("LOCKED", "Kategori tidak bisa diganti setelah timmu mengumpulkan karya.");
    if (team.track !== track) await ctx.db.patch(team._id, { track, updatedAt: Date.now() });
  },
});

// ——— Staff (#183) ———

/**
 * Every team of the season for owners and admins: track, standing, registration and payment, members by name, and the
 * captain's email as the team's one contact. Teammates' emails are not shown.
 */
export const staffTeams = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const teams = await ctx.db.query("leagueTeams").withIndex("by_season", (q) => q.eq("season", leagueSeason)).collect();
    return Promise.all(teams.map(async (team) => {
      const rows = await membersOf(ctx, team._id);
      const captain = team.captainId ? await authComponent.getAnyUserById(ctx, team.captainId) : null;
      return {
        _id: team._id, name: team.name, code: team.code, track: team.track, trackName: trackName(team.track),
        standing: teamStanding(team, rows.length), createdAt: team.createdAt, submittedAt: team.submittedAt ?? null,
        registration: team.registration ? { paid: team.registration.paid, importedAt: team.registration.importedAt } : null,
        captain: team.captainId ? { name: await profileName(ctx, team.captainId), email: captain?.email ?? null } : null,
        members: await Promise.all(rows.map(async (row) => ({ ownerId: row.ownerId, name: await profileName(ctx, row.ownerId), captain: row.ownerId === team.captainId }))),
      };
    }));
  },
});

/**
 * Marks teams registered from Program & Development's registration results (#183), matched by the captain's email on
 * the server again, so the preview cannot point a row at another team. `paid` absent keeps the payment status. Emails
 * that match no captain are returned, never dropped silently.
 */
export const importRegistrations = mutation({
  args: { rows: v.array(v.object({ email: v.string(), paid: v.optional(v.boolean()) })) },
  handler: async (ctx, { rows }) => {
    const { user } = await requireStaff(ctx);
    if (rows.length > registrationBatch) fail("VALIDATION", `Maksimal ${registrationBatch} baris sekali kirim.`);
    const teams = await ctx.db.query("leagueTeams").withIndex("by_season", (q) => q.eq("season", leagueSeason)).collect();
    const byEmail = new Map<string, Doc<"leagueTeams">>();
    for (const team of teams) {
      const captain = team.captainId ? await authComponent.getAnyUserById(ctx, team.captainId) : null;
      if (captain?.email) byEmail.set(normalizeEmail(captain.email), team);
    }
    const result = { registered: 0, updated: 0, unchanged: 0, unmatched: [] as string[] };
    const now = Date.now();
    for (const row of rows) {
      const team = byEmail.get(normalizeEmail(row.email));
      if (!team) { result.unmatched.push(row.email); continue; }
      const paid = row.paid ?? Boolean(team.registration?.paid);
      if (team.registration?.paid === paid) { result.unchanged++; continue; }
      result[team.registration ? "updated" : "registered"]++;
      const registration = { paid, importedAt: now, importedBy: user._id };
      await ctx.db.patch(team._id, { registration, updatedAt: now });
      byEmail.set(normalizeEmail(row.email), { ...team, registration });
    }
    return result;
  },
});
