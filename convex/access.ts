import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { authComponent, isReviewer } from "./auth";

export type DashboardRole = "owner" | "admin" | "member";

/** Owners are the configured reviewer allowlist; admins are promoted in the dashboard. */
export function roleOf(email: string, verified: boolean, profile: Doc<"memberProfiles"> | null): DashboardRole {
  if (isReviewer(email, verified)) return "owner";
  return profile?.role === "admin" ? "admin" : "member";
}

export function isActive(role: DashboardRole, profile: Doc<"memberProfiles"> | null) {
  return role === "owner" || !profile?.deactivatedAt;
}

export async function dashboardAccess(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user?.emailVerified) return null;
  const profile = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
  const role = roleOf(user.email, user.emailVerified, profile);
  return { user, profile, role, active: isActive(role, profile) };
}

export async function requireMember(ctx: QueryCtx | MutationCtx) {
  const access = await dashboardAccess(ctx);
  if (!access) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Masuk kembali dengan akun Google untuk melanjutkan." });
  if (!access.profile?.completedAt) throw new ConvexError({ code: "ONBOARDING", message: "Selesaikan perkenalan terlebih dahulu." });
  if (!access.active) throw new ConvexError({ code: "DEACTIVATED", message: "Akun ini sedang dinonaktifkan. Hubungi admin GDGoC IPB." });
  return { ...access, profile: access.profile };
}

export async function requireStaff(ctx: QueryCtx | MutationCtx) {
  const access = await requireMember(ctx);
  if (access.role === "member") throw new ConvexError({ code: "FORBIDDEN", message: "Akses ini hanya untuk admin GDGoC IPB." });
  return access;
}
