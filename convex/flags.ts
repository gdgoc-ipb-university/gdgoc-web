import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { flagMatches, flagPointsFor, flagPointsOf, nextTryAt, triesAvailable } from "../src/lib/flag-task";

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
