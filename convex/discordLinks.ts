import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/**
 * The site's record of a member's Discord account (#242), kept in step with Better Auth's `discord` account row: the
 * account triggers in auth.ts call `recordLink` and `removeLink` in the same transaction as Better Auth's write, and the
 * unlink and account deletion paths, which delete the row themselves, call `removeLink` too.
 */

export function linkOf(ctx: QueryCtx | MutationCtx, ownerId: string) {
  return ctx.db.query("discordLinks").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
}

/**
 * Records a new Discord account. One Discord account per member and one member per Discord account: throwing here
 * undoes Better Auth's insert.
 */
export async function recordLink(ctx: MutationCtx, account: { userId: string; accountId: string }) {
  const [mine, holder] = await Promise.all([
    linkOf(ctx, account.userId),
    ctx.db.query("discordLinks").withIndex("by_discord", (q) => q.eq("discordId", account.accountId)).unique(),
  ]);
  if (holder && holder.ownerId !== account.userId) throw new ConvexError({ code: "DISCORD_TAKEN", message: "Akun Discord ini sudah terhubung ke akun member lain." });
  if (mine) {
    if (mine.discordId === account.accountId) return mine._id;
    throw new ConvexError({ code: "DISCORD_LINKED", message: "Akunmu sudah terhubung ke akun Discord lain. Putuskan dulu, lalu hubungkan lagi." });
  }
  const linkId = await ctx.db.insert("discordLinks", { ownerId: account.userId, discordId: account.accountId, linkedAt: Date.now(), joinStatus: "pending", attempts: 0 });
  return linkId;
}

/**
 * What runs once a link is gone, on every path that removes one. Unlinking never kicks the member from the server; the
 * role sync (#243) adds the removal of the roles the site manages here, by `link.discordId`.
 */
const afterUnlink: ((ctx: MutationCtx, link: Doc<"discordLinks">) => Promise<void>)[] = [];

/** Removes a member's link, if any, and returns how many rows went. */
export async function removeLink(ctx: MutationCtx, ownerId: string) {
  const link = await linkOf(ctx, ownerId);
  if (!link) return 0;
  await ctx.db.delete(link._id);
  for (const hook of afterUnlink) await hook(ctx, link);
  return 1;
}
