import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { discordScopes, type DiscordSettings } from "../src/lib/discord";

/** Why a signed-in account may not link Discord now, in Indonesian, or null. */
export type DiscordLinkCheck = (userId: string) => Promise<string | null>;

/**
 * Discord in Better Auth, for linking only (#242): Google stays the only sign-in (#241). Three locks keep Discord off
 * the sign-in path, each tested in discordAuth.test.ts:
 * - `/sign-in/social` refuses it;
 * - its profile never carries an email, so a callback that isn't a link stops at `email_not_found`, before Better Auth
 *   looks for an account to sign in or creates one;
 * - sign-up is off for the provider.
 * Linking needs Discord trusted, since it is never asked for an email that could vouch for the account, and different
 * emails allowed. The member's name and photo stay Google's (`updateUserInfoOnLink` stays off). `/link-social` for
 * Discord asks `check` first and takes no extra scopes.
 */
export function discordAuthOptions(settings: Pick<DiscordSettings, "clientId" | "clientSecret"> | null, check: DiscordLinkCheck) {
  return {
    socialProviders: settings ? {
      discord: {
        clientId: settings.clientId, clientSecret: settings.clientSecret,
        disableDefaultScope: true, scope: [...discordScopes], disableSignUp: true,
        mapProfileToUser: () => ({ email: null, emailVerified: false }),
      },
    } : {},
    accountLinking: { trustedProviders: ["discord"], allowDifferentEmails: true },
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.body?.provider !== "discord") return;
      if (ctx.path === "/sign-in/social") {
        throw new APIError("FORBIDDEN", { code: "DISCORD_SIGN_IN_DISABLED", message: "Discord tidak bisa dipakai untuk masuk. Masuk dengan Google, lalu hubungkan Discord dari Profil." });
      }
      if (ctx.path !== "/link-social") return;
      if (ctx.body.scopes?.length || ctx.body.idToken) throw new APIError("BAD_REQUEST", { code: "DISCORD_LINK_SCOPES", message: "Discord dihubungkan hanya dengan izin bawaan." });
      const session = await getSessionFromCtx(ctx);
      if (!session) return; // the endpoint answers an unauthenticated call itself
      const problem = await check(session.user.id);
      if (problem) throw new APIError("FORBIDDEN", { code: "DISCORD_LINK_REFUSED", message: problem });
    }),
  };
}
