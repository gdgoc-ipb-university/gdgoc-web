import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";
import { mutation, query } from "./_generated/server";
import { finalStep, normalizeOnboarding, resumeStep, stepAfter, validateOnboarding, type OnboardingStep } from "../src/lib/onboarding";

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
    // No community tag here: members register as Member, and only staff set Core Team, BoD or a division.
    step: v.union(v.literal(1), v.literal(2), v.literal(4), v.literal(5)),
    revision: v.number(),
    values: v.object({ fullName: v.string(), campus: v.string(), studyProgram: v.string() }),
  },
  handler: async (ctx, { step, revision, values }) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user?.emailVerified) throw new ConvexError("Masuk kembali dengan akun Google untuk melanjutkan.");
    const existing = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
    if (existing?.completedAt) return existing;
    const resume = resumeStep(existing?.nextStep);
    if (step > resume) throw new ConvexError("Lengkapi langkah sebelumnya terlebih dahulu.");
    const clean = normalizeOnboarding(values);
    const data = {
      fullName: step === 1 ? clean.fullName : existing?.fullName ?? "",
      campus: step === 2 ? clean.campus : existing?.campus ?? "",
      studyProgram: step === 2 ? clean.studyProgram : existing?.studyProgram ?? "",
    };
    const errors = validateOnboarding(data, step);
    if (Object.keys(errors).length) throw new ConvexError({ code: "VALIDATION", message: "Lengkapi isian yang ditandai sebelum melanjutkan.", fields: errors });
    const nextStep = Math.max(resume, stepAfter(step)) as OnboardingStep;
    if (revision !== (existing?.revision ?? 0)) {
      // Accept a repeated acknowledged request, but never overwrite another tab's edits.
      const same = existing && (["fullName", "campus", "studyProgram"] as const).every((field) => data[field] === existing[field]);
      if (existing && resume >= nextStep && same) return existing;
      throw new ConvexError("Profil berubah di tab atau perangkat lain. Muat ulang halaman untuk memakai versi terbaru.");
    }
    // Finishing registers the account as Member, unless staff already gave it a tag.
    const completion = step === finalStep ? { completedAt: Date.now(), ...(existing?.memberType ? {} : { memberType: "member" as const }) } : {};
    const changes = { ...data, nextStep, revision: revision + 1, updatedAt: Date.now(), ...completion };
    const id = existing ? existing._id : await ctx.db.insert("memberProfiles", { ownerId: user._id, ...changes });
    if (existing) await ctx.db.patch(id, changes);
    return (await ctx.db.get(id))!;
  },
});

/**
 * Gives an account onboarded before community tags existed the Member tag. It never sets another tag: Core Team, BoD
 * and divisions come from staff only (dashboard.setMemberType), and a tag already set is left as it is.
 */
export const registerAsMember = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user?.emailVerified) throw new ConvexError("Masuk kembali dengan akun Google untuk melanjutkan.");
    const existing = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
    if (!existing?.completedAt) throw new ConvexError("Selesaikan perkenalan terlebih dahulu.");
    if (!existing.memberType) await ctx.db.patch(existing._id, { memberType: "member", updatedAt: Date.now() });
  },
});
