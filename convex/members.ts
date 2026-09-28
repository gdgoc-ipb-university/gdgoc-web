import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";
import { mutation, query } from "./_generated/server";
import { memberType } from "./schema";
import { finalStep, normalizeOnboarding, roleStep, validateOnboarding, validateRole, type OnboardingStep } from "../src/lib/onboarding";

export const profile = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user?.emailVerified) return null;
    return ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
  },
});

export const saveStep = mutation({
  args: {
    step: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5)),
    revision: v.number(),
    // Role fields are optional so a tab loaded before the role step can still save.
    values: v.object({ fullName: v.string(), campus: v.string(), studyProgram: v.string(), memberType: v.optional(v.union(memberType, v.literal(""))), division: v.optional(v.string()) }),
  },
  handler: async (ctx, { step, revision, values }) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user?.emailVerified) throw new ConvexError("Masuk kembali dengan akun Google untuk melanjutkan.");
    const existing = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
    if (existing?.completedAt) return existing;
    if (step > (existing?.nextStep ?? 1)) throw new ConvexError("Lengkapi langkah sebelumnya terlebih dahulu.");
    const clean = normalizeOnboarding({ ...values, memberType: values.memberType ?? "", division: values.division ?? "" });
    const data = {
      fullName: step === 1 ? clean.fullName : existing?.fullName ?? "",
      campus: step === 2 ? clean.campus : existing?.campus ?? "",
      studyProgram: step === 2 ? clean.studyProgram : existing?.studyProgram ?? "",
      memberType: step === roleStep ? clean.memberType || undefined : existing?.memberType,
      division: step === roleStep ? clean.division || undefined : existing?.division,
    };
    const errors = validateOnboarding({ ...data, memberType: data.memberType ?? "", division: data.division ?? "" }, step);
    if (Object.keys(errors).length) throw new ConvexError({ code: "VALIDATION", message: "Lengkapi isian yang ditandai sebelum melanjutkan.", fields: errors });
    const nextStep = Math.max(existing?.nextStep ?? 1, Math.min(step + 1, finalStep)) as OnboardingStep;
    if (revision !== (existing?.revision ?? 0)) {
      // Accept a repeated acknowledged request, but never overwrite another tab's edits.
      const same = existing && (["fullName", "campus", "studyProgram", "memberType", "division"] as const).every((field) => data[field] === existing[field]);
      if (existing && existing.nextStep >= nextStep && same) return existing;
      throw new ConvexError("Profil berubah di tab atau perangkat lain. Muat ulang halaman untuk memakai versi terbaru.");
    }
    const changes = { ...data, nextStep, revision: revision + 1, updatedAt: Date.now(), ...(step === finalStep ? { completedAt: Date.now() } : {}) };
    const id = existing ? existing._id : await ctx.db.insert("memberProfiles", { ownerId: user._id, ...changes });
    if (existing) await ctx.db.patch(id, changes);
    return (await ctx.db.get(id))!;
  },
});

/** Sets the member's own community role after onboarding (one-time prompt and profile page). */
export const saveRole = mutation({
  args: { memberType, division: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user?.emailVerified) throw new ConvexError("Masuk kembali dengan akun Google untuk melanjutkan.");
    const existing = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
    if (!existing?.completedAt) throw new ConvexError("Selesaikan perkenalan terlebih dahulu.");
    const division = args.memberType === "core" ? args.division.trim() : "";
    const errors = validateRole({ memberType: args.memberType, division });
    if (Object.keys(errors).length) throw new ConvexError({ code: "VALIDATION", message: "Lengkapi isian yang ditandai.", fields: errors });
    await ctx.db.patch(existing._id, { memberType: args.memberType, division: division || undefined, updatedAt: Date.now() });
  },
});
