import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

export function isReviewer(email: string, verified: boolean) {
  const allowed = (process.env.APPRECIATION_ADMIN_EMAILS ?? "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return verified && allowed.includes(email.toLowerCase());
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
    return {
      id: user._id, name: user.name, email: user.email,
      isAdmin: isReviewer(user.email, user.emailVerified),
    };
  },
});
