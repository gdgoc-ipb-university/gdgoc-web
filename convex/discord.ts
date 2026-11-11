import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { dashboardAccess } from "./access";
import { linkOf, removeLink } from "./discordLinks";
import { discordServerUrl, discordSettings } from "../src/lib/discord";

const signInAgain = () => new ConvexError({ code: "UNAUTHENTICATED", message: "Masuk kembali dengan akun Google untuk melanjutkan." });

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
