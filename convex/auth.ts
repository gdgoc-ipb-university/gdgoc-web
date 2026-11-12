import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalAction, query } from "./_generated/server";
import authConfig from "./auth.config";
import { discordAuthOptions } from "./discordAuth";
import { recordLink, removeLink } from "./discordLinks";
import { discordSettings } from "../src/lib/discord";

const authFunctions: AuthFunctions = internal.auth;

/**
 * Better Auth's tables live in its component. A Discord account row (#242) carries the site's `discordLinks` row with
 * it: these triggers run in the same transaction as Better Auth's insert or delete.
 */
export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    account: {
      onCreate: async (ctx, doc) => { if (doc.providerId === "discord") await recordLink(ctx, doc); },
      onDelete: async (ctx, doc) => { if (doc.providerId === "discord") await removeLink(ctx, doc.userId); },
    },
  },
});
export const { onCreate, onDelete } = authComponent.triggersApi();

/** Owners are the verified emails in APPRECIATION_ADMIN_EMAILS; they are never stored in the database. */
export function isOwner(email: string, verified: boolean) {
  const allowed = (process.env.APPRECIATION_ADMIN_EMAILS ?? "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return verified && allowed.includes(email.toLowerCase());
}

type ReviewerProfile = {
  role?: string; appreciationReviewer?: boolean; deactivatedAt?: number; memberType?: string; division?: string; tagConfirmedAt?: number;
} | null | undefined;

/** The division that prepares Apresiasi posts; its Core Team and BoD review by tag. */
export const REVIEW_DIVISION = "Media & Creative";

/** A Media & Creative Core Team or BoD tag that staff set or confirmed. Self-declared tags never count. */
export function reviewsByTag(profile: ReviewerProfile) {
  return Boolean(profile?.tagConfirmedAt) && (profile?.memberType === "core" || profile?.memberType === "bod") && profile?.division === REVIEW_DIVISION;
}

/**
 * Apresiasi review: owners, active admins, active accounts an owner granted `appreciationReviewer`, and active members
 * with a confirmed Media & Creative Core Team or BoD tag. The one check every review path uses.
 */
export function isReviewer(email: string, verified: boolean, profile: ReviewerProfile) {
  if (isOwner(email, verified)) return true;
  if (!verified || !profile || profile.deactivatedAt) return false;
  return profile.role === "admin" || Boolean(profile.appreciationReviewer) || reviewsByTag(profile);
}

type HostEnv = { SITE_URL?: string; LEAGUE_URL?: string; AUTH_COOKIE_DOMAIN?: string };

/**
 * The hosts one login covers (#179). SITE_URL is where Google returns; LEAGUE_URL (Tech League's host) is trusted as an
 * origin and as a callbackURL, so sign-in started on the league lands back there. AUTH_COOKIE_DOMAIN puts every auth
 * cookie, the OAuth state cookie included, on the shared parent domain, so a session on one host is a session on both
 * and signing out of one signs out of both. With both unset, only SITE_URL is trusted and cookies stay host-only.
 */
export function hostOptions(env: HostEnv) {
  const trustedOrigins = [env.SITE_URL, env.LEAGUE_URL].map((url) => url?.trim()).filter((url): url is string => Boolean(url));
  const domain = env.AUTH_COOKIE_DOMAIN?.trim();
  return { trustedOrigins, ...(domain ? { advanced: { crossSubDomainCookies: { enabled: true, domain } } } : {}) };
}

/**
 * The endpoints every open member page calls: its session, its Convex token, and the keys Convex fetches to check that
 * token. They only read, so they skip the rate limit (#269). Counting each one cost three more Convex calls (read the
 * counter, read it again, write it), which was most of the deployment's monthly function calls. The limit also could not
 * tell members apart: their requests reach Convex through the site's /api/auth route, so they all shared the web
 * server's 60 a minute and got 429s at busy times.
 */
export const SESSION_READS = ["/get-session", "/convex/token", "/convex/jwks", "/convex/.well-known/openid-configuration"] as const;

/** Sign-in, the OAuth callbacks and linking Discord keep the database rate limit. */
export const rateLimit = {
  enabled: true, storage: "database", window: 60, max: 60,
  customRules: Object.fromEntries(SESSION_READS.map((path) => [path, false])),
} satisfies BetterAuthOptions["rateLimit"];

/**
 * Google is the only sign-in. Discord, once its four settings are on the deployment, can only be linked to a signed-in
 * account (discordAuth.ts), and its callback stays on SITE_URL like Google's.
 */
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const discord = discordAuthOptions(discordSettings(process.env), (userId) => ctx.runQuery(internal.discord.linkProblem, { userId }));
  return betterAuth({
    appName: "GDGoC IPB",
    baseURL: process.env.SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    ...hostOptions({ SITE_URL: process.env.SITE_URL, LEAGUE_URL: process.env.LEAGUE_URL, AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN }),
    database: authComponent.adapter(ctx),
    socialProviders: {
      ...process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          prompt: "select_account" as const,
        },
      } : {},
      ...discord.socialProviders,
    },
    account: { encryptOAuthTokens: true, accountLinking: discord.accountLinking },
    hooks: { before: discord.before },
    rateLimit,
    plugins: [convex({ authConfig, jwks: process.env.JWKS })],
  });
};

/**
 * The token signing key in use, as JSON for the deployment's JWKS variable (#269). With JWKS set, minting a Convex token
 * reads no table, and Convex checks tokens against the key in auth.config.ts instead of fetching /convex/jwks for each
 * new token. This returns the key already in the table, never a new one, so tokens issued before the switch stay valid:
 * `npx convex run auth:getLatestJwks | npx convex env set JWKS`.
 */
export const getLatestJwks = internalAction({ args: {}, handler: async (ctx) => await createAuth(ctx).api.getLatestJwks() });

export const configuration = query({
  args: {},
  handler: () => ({ googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) }),
});

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
    return {
      id: user._id, name: profile?.fullName || user.name, email: user.email, memberType: profile?.memberType ?? null,
      isAdmin: isReviewer(user.email, user.emailVerified, profile),
    };
  },
});
