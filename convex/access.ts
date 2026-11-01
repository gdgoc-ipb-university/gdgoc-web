import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { authComponent, isOwner } from "./auth";

export type DashboardRole = "owner" | "admin" | "member";

/** Owners are the configured allowlist; admins are promoted in the dashboard. Apresiasi review is a separate permission (auth.isReviewer). */
export function roleOf(email: string, verified: boolean, profile: Doc<"memberProfiles"> | null): DashboardRole {
  if (isOwner(email, verified)) return "owner";
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

/**
 * The Tech Support queue (#92): owners, active admins, and active members an owner granted `techSupportHandler`
 * (Community & External staff). The one check the queue, the viewer and the sidebar use.
 */
export function handlesTechSupport(role: DashboardRole, profile: Doc<"memberProfiles"> | null) {
  if (role === "owner") return true;
  if (!profile || profile.deactivatedAt) return false;
  return role === "admin" || Boolean(profile.techSupportHandler);
}

export async function requireTechSupportHandler(ctx: QueryCtx | MutationCtx) {
  const access = await requireMember(ctx);
  if (!handlesTechSupport(access.role, access.profile)) throw new ConvexError({ code: "FORBIDDEN", message: "Akses ini hanya untuk pengelola Tech Support." });
  return access;
}

/** Who can ask for a Tech Support mentor: any active, onboarded member, with no community tag required (#92). Narrow it here. */
export async function requireTechSupportRequester(ctx: QueryCtx | MutationCtx) {
  return requireMember(ctx);
}
