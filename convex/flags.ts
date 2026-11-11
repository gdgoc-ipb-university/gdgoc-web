import { v } from "convex/values";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireMember, requireStaff } from "./access";
import { flagMatches, flagPointsFor, flagPointsOf, nextTryAt, triesAvailable } from "../src/lib/flag-task";
import { BOARD_SIZE, shortName } from "../src/lib/bogor-run/leaderboard";

/** What a member's flag got: a solve with its locked points, or a refusal that still had to be written (#240). */
export type FlagResult =
  | { ok: true; points: number; place: number; solvedAt: number }
  | { ok: false; code: "WRONG"; message: string; triesLeft: number }
  | { ok: false; code: "LIMITED"; message: string; retryAt: number };

/** The flag row of a task. Staff functions and `checkFlag` only: it must never reach a member. */
export async function flagOf(ctx: QueryCtx | MutationCtx, id: Id<"assignments">) {
  return ctx.db.query("assignmentFlags").withIndex("by_assignment", (q) => q.eq("assignmentId", id)).unique();
}

/** A task's solves, earliest first. */
export async function solvesOf(ctx: QueryCtx | MutationCtx, id: Id<"assignments">) {
  return ctx.db.query("flagSolves").withIndex("by_assignment", (q) => q.eq("assignmentId", id)).collect();
}

export async function solveOf(ctx: QueryCtx | MutationCtx, id: Id<"assignments">, ownerId: string) {
  return ctx.db.query("flagSolves").withIndex("by_assignment_owner", (q) => q.eq("assignmentId", id).eq("ownerId", ownerId)).unique();
}

/**
 * The name other members see for a solver: the short name Papan skor uses ("Aldio L."), or null for an account that is
 * deactivated or gone, which other members don't see.
 */
export async function solverName(ctx: QueryCtx | MutationCtx, ownerId: string) {
  const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
  return profile && !profile.deactivatedAt ? shortName(profile.fullName) : null;
}

/**
 * What a member sees of a flag task (#240): the points the next solver gets, how many solved it, first blood (the earliest
 * solver still shown), their own solve with its order by time, and when their next try opens if they ran out. Never the flag.
 */
export async function flagSummary(ctx: QueryCtx, assignment: Doc<"assignments">, ownerId: string) {
  const solves = await solvesOf(ctx, assignment._id);
  let firstBlood: { name: string; you: boolean } | null = null;
  for (const solve of solves) {
    const name = await solverName(ctx, solve.ownerId);
    if (name) { firstBlood = { name, you: solve.ownerId === ownerId }; break; }
  }
  const index = solves.findIndex((solve) => solve.ownerId === ownerId);
  const attempts = index < 0 ? await ctx.db.query("flagAttempts").withIndex("by_assignment_owner", (q) => q.eq("assignmentId", assignment._id).eq("ownerId", ownerId)).unique() : null;
  const points = flagPointsOf(assignment);
  return {
    ...points, pointsNow: flagPointsFor(points, solves.length + 1), solves: solves.length, firstBlood,
    mine: index < 0 ? null : { points: solves[index].points, solvedAt: solves[index].solvedAt, order: index + 1 },
    // From the stored bucket alone, so the query stays the same as time passes; the page compares it with its clock.
    nextTryAt: attempts && attempts.tokens < 1 ? nextTryAt(attempts.tokens, attempts.tokensAt) : null,
  };
}

/** Sets a task's flag. Earlier solves stay: a new flag applies to later tries only. */
export async function setFlag(ctx: MutationCtx, id: Id<"assignments">, flag: string, by: string) {
  const row = await flagOf(ctx, id);
  if (!row) await ctx.db.insert("assignmentFlags", { assignmentId: id, flag, updatedAt: Date.now(), updatedBy: by });
  else if (row.flag !== flag) await ctx.db.patch(row._id, { flag, updatedAt: Date.now(), updatedBy: by });
}

/** A deleted task's flag and wrong-try counts. A task with solves cannot be deleted. */
export async function removeFlagRows(ctx: MutationCtx, id: Id<"assignments">) {
  const flag = await flagOf(ctx, id);
  if (flag) await ctx.db.delete(flag._id);
  for (const row of await ctx.db.query("flagAttempts").withIndex("by_assignment_owner", (q) => q.eq("assignmentId", id)).collect()) await ctx.db.delete(row._id);
}

/**
 * Checks one flag from a member who has not solved the task. With no try left the flag is not checked at all; a wrong one
 * uses a try and is counted. A right one locks the points of the next place, the solves before it plus one, read and
 * written in this one transaction, so two members solving at once never share a place.
 */
export async function checkFlag(ctx: MutationCtx, assignment: Doc<"assignments">, ownerId: string, input: string): Promise<FlagResult> {
  const now = Date.now();
  const attempts = await ctx.db.query("flagAttempts").withIndex("by_assignment_owner", (q) => q.eq("assignmentId", assignment._id).eq("ownerId", ownerId)).unique();
  const available = triesAvailable(attempts, now);
  if (available < 1) return { ok: false, code: "LIMITED", message: "Terlalu banyak flag yang belum tepat. Tunggu sebentar, lalu coba lagi.", retryAt: nextTryAt(available, now) };
  const answer = await flagOf(ctx, assignment._id);
  if (!answer || !flagMatches(input, answer.flag)) {
    const bucket = { tokens: available - 1, tokensAt: now };
    if (attempts) await ctx.db.patch(attempts._id, { wrong: attempts.wrong + 1, lastWrongAt: now, ...bucket });
    else await ctx.db.insert("flagAttempts", { assignmentId: assignment._id, ownerId, wrong: 1, lastWrongAt: now, ...bucket });
    return { ok: false, code: "WRONG", message: "Flag belum tepat.", triesLeft: Math.floor(bucket.tokens) };
  }
  const place = (await solvesOf(ctx, assignment._id)).length + 1;
  const points = flagPointsFor(flagPointsOf(assignment), place);
  await ctx.db.insert("flagSolves", { assignmentId: assignment._id, ownerId, points, place, solvedAt: now });
  return { ok: true, points, place, solvedAt: now };
}

/**
 * The Challenge board on Papan skor (#240): members ranked by their total locked points from flag tasks. A tie goes to whoever
 * reached the total first, the time of their last solve that added points. Deactivated accounts are left off, as on the
 * Bogor Run boards. Short names only, never account IDs.
 */
export const board = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireMember(ctx);
    const solves = (await ctx.db.query("flagSolves").collect()).sort((a, b) => a.solvedAt - b.solvedAt);
    const names = new Map<string, string | null>();
    for (const solve of solves) if (!names.has(solve.ownerId)) names.set(solve.ownerId, await solverName(ctx, solve.ownerId));
    const totals = new Map<string, { points: number; tasks: number; firstBloods: number; reachedAt: number }>();
    const blooded = new Set<string>();
    for (const solve of solves) {
      if (!names.get(solve.ownerId)) continue;
      const row = totals.get(solve.ownerId) ?? { points: 0, tasks: 0, firstBloods: 0, reachedAt: solve.solvedAt };
      row.points += solve.points; row.tasks++;
      if (solve.points > 0) row.reachedAt = solve.solvedAt;
      if (!blooded.has(solve.assignmentId)) { blooded.add(solve.assignmentId); row.firstBloods++; }
      totals.set(solve.ownerId, row);
    }
    const ranked = [...totals].sort(([, a], [, b]) => b.points - a.points || a.reachedAt - b.reachedAt)
      .map(([ownerId, row], index) => ({ ownerId, rank: index + 1, name: names.get(ownerId)!, ...row }));
    const you = ranked.find((row) => row.ownerId === user._id);
    return {
      entries: ranked.slice(0, BOARD_SIZE).map(({ ownerId, ...row }) => ({ ...row, you: ownerId === user._id })),
      you: you ? { rank: you.rank, points: you.points, tasks: you.tasks } : null,
      stats: { players: ranked.length, solves: ranked.reduce((sum, row) => sum + row.tasks, 0) },
    };
  },
});

/** Staff: one flag task's solves (who, when, points, in order) with each solver's wrong tries, and the task's wrong tries. */
export const solves = query({
  args: { id: v.id("assignments") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const assignment = await ctx.db.get(id);
    if (!assignment || assignment.kind !== "flag") return null;
    const attempts = await ctx.db.query("flagAttempts").withIndex("by_assignment_owner", (q) => q.eq("assignmentId", id)).collect();
    const wrong = new Map(attempts.map((row) => [row.ownerId, row.wrong]));
    return {
      solves: await Promise.all((await solvesOf(ctx, id)).map(async (solve, index) => {
        const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", solve.ownerId)).unique();
        return { order: index + 1, name: profile?.fullName ?? "Member", inactive: Boolean(profile?.deactivatedAt), solvedAt: solve.solvedAt, points: solve.points, wrong: wrong.get(solve.ownerId) ?? 0 };
      })),
      wrong: attempts.reduce((sum, row) => sum + row.wrong, 0), wrongMembers: attempts.length,
    };
  },
});

/** Account deletion: the member's solves and wrong-try counts. Others keep their points; first blood passes to the next solver. */
export async function deleteFlagRows(ctx: MutationCtx, ownerId: string) {
  const counts = { flagSolves: 0, flagAttempts: 0 };
  for (const row of await ctx.db.query("flagSolves").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect()) { await ctx.db.delete(row._id); counts.flagSolves++; }
  for (const row of await ctx.db.query("flagAttempts").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect()) { await ctx.db.delete(row._id); counts.flagAttempts++; }
  return counts;
}
