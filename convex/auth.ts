import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

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

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth({
  appName: "GDGoC IPB",
  baseURL: process.env.SITE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.SITE_URL ? [process.env.SITE_URL] : [],
  database: authComponent.adapter(ctx),
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    },
  } : {},
  account: { encryptOAuthTokens: true },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
  plugins: [convex({ authConfig })],
});

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
