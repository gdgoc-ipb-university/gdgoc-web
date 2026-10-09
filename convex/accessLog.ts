import type { Infer } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { accessChange } from "./schema";

export type AccessChange = Infer<typeof accessChange>;

/** Records one access change for the owners' log. Callers log only real changes, after their checks pass. */
export async function logAccess(ctx: MutationCtx, entry: { actorId: string; targetId: string; change: AccessChange; from: string; to: string; assignmentId?: Id<"assignments"> }) {
  await ctx.db.insert("accessLog", { at: Date.now(), ...entry });
}

/** A community tag as the log stores it: "member", "core:Technical", "bod". */
export function tagValue(memberType: string | undefined, division: string | undefined) {
  return memberType && memberType !== "member" && division ? `${memberType}:${division}` : memberType ?? "member";
}
