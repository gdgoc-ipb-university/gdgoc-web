import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { components } from "./_generated/api";
import { authComponent } from "./auth";
import { dashboardAccess, isActive, roleOf } from "./access";
import { linkOf, removeLink } from "./discordLinks";
import { discordServerUrl, discordSettings } from "../src/lib/discord";

const signInAgain = () => new ConvexError({ code: "UNAUTHENTICATED", message: "Masuk kembali dengan akun Google untuk melanjutkan." });
const notSetUp = "Discord belum disiapkan pengurus.";
const deactivated = "Akun ini sedang dinonaktifkan. Hubungi admin GDGoC IPB.";

/** Whether an account may be in the server: signed in through Google, and not deactivated. */
async function accountState(ctx: QueryCtx, userId: string) {
  const user = await authComponent.getAnyUserById(ctx, userId);
  if (!user?.emailVerified) return "missing" as const;
  const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", userId)).unique();
  return isActive(roleOf(user.email, user.emailVerified, profile), profile) ? "active" as const : "deactivated" as const;
}

/** The Discord section on Profil and in onboarding: whether Discord is set up, and the member's link. Onboarding counts. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const access = await dashboardAccess(ctx);
    if (!access) return null;
    const settings = discordSettings(process.env);
    const link = await linkOf(ctx, access.user._id);
    return {
      configured: Boolean(settings), serverUrl: settings ? discordServerUrl(settings.guildId) : null,
      link: link ? {
        username: link.username ?? null, linkedAt: link.linkedAt, joinStatus: link.joinStatus,
        lastSyncedAt: link.lastSyncedAt ?? null, lastError: link.lastError ?? null,
      } : null,
    };
  },
});

/** Asked by `/link-social` before a member links Discord (discordAuth.ts); the answer is shown to them. */
export const linkProblem = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<string | null> => {
    if (!discordSettings(process.env)) return notSetUp;
    const state = await accountState(ctx, userId);
    if (state !== "active") return state === "missing" ? "Masuk kembali dengan akun Google untuk melanjutkan." : deactivated;
    if (await linkOf(ctx, userId)) return "Akunmu sudah terhubung ke Discord. Putuskan dulu sebelum menghubungkan akun lain.";
    return null;
  },
});

/**
 * "Putuskan": removes the member's link and Better Auth's Discord account in one transaction, so no fresh sign-in is
 * needed as Better Auth's own unlink asks. The member stays in the server (discordLinks.removeLink).
 */
export const unlink = mutation({
  args: {},
  handler: async (ctx) => {
    const access = await dashboardAccess(ctx);
    if (!access) throw signInAgain();
    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model: "account", where: [{ field: "userId", operator: "eq", value: access.user._id }, { field: "providerId", operator: "eq", value: "discord" }] },
      paginationOpts: { numItems: 10, cursor: null },
    });
    await removeLink(ctx, access.user._id);
  },
});
