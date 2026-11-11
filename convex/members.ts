import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { institutionKind } from "./schema";
import { requireMember } from "./access";
import { finalStep, instagramStep, normalizeOnboarding, resumeStep, stepAfter, validateOnboarding, type OnboardingStep } from "../src/lib/onboarding";
import { changedProfileFields, normalizeProfile, validateProfile, type ProfileValues } from "../src/lib/profile-edit";

/** Why a save from an older tab is refused, in onboarding and in profile edits alike. */
const staleProfile = "Profil berubah di tab atau perangkat lain. Muat ulang halaman untuk memakai versi terbaru.";

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
    step: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5), v.literal(6)),
    revision: v.number(),
    // The kind is optional so a page from before it was asked keeps saving during a backend-first deploy.
    values: v.object({ fullName: v.string(), campus: v.string(), studyProgram: v.string(), institutionKind: v.optional(institutionKind), instagram: v.optional(v.string()) }),
  },
  handler: async (ctx, { step, revision, values }) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user?.emailVerified) throw new ConvexError("Masuk kembali dengan akun Google untuk melanjutkan.");
    const existing = await ctx.db.query("memberProfiles").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
    if (existing?.completedAt) return existing;
    const resume = resumeStep(existing?.nextStep, existing?.instagram);
    if (step > resume) throw new ConvexError("Lengkapi langkah sebelumnya terlebih dahulu.");
    const clean = normalizeOnboarding(values);
    // The education screen sets the kind; later screens keep the saved one. No kind stays no kind.
    const kind = step === 2 && clean.institutionKind ? clean.institutionKind : existing?.institutionKind;
    // Screen 3 sets the username; later screens keep the saved one.
    const instagram = step === instagramStep ? clean.instagram : existing?.instagram;
    const data = {
      fullName: step === 1 ? clean.fullName : existing?.fullName ?? "",
      campus: step === 2 ? clean.campus : existing?.campus ?? "",
      studyProgram: step === 2 ? clean.studyProgram : existing?.studyProgram ?? "",
      ...(kind ? { institutionKind: kind } : {}),
      ...(instagram ? { instagram } : {}),
    };
    const errors = validateOnboarding(data, step);
    if (Object.keys(errors).length) throw new ConvexError({ code: "VALIDATION", message: "Lengkapi isian yang ditandai sebelum melanjutkan.", fields: errors });
    const nextStep = Math.max(resume, stepAfter(step)) as OnboardingStep;
    if (revision !== (existing?.revision ?? 0)) {
      // Accept a repeated acknowledged request, but never overwrite another tab's edits.
      const same = existing && (["fullName", "campus", "studyProgram"] as const).every((field) => data[field] === existing[field]) && kind === existing.institutionKind && instagram === existing.instagram;
      if (existing && resume >= nextStep && same) return existing;
      throw new ConvexError(staleProfile);
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

/** The answers a completed profile can change (#235); the kind is required here, as the education screen asks for it. */
export const profileValues = v.object({ fullName: v.string(), institutionKind, campus: v.string(), studyProgram: v.string(), instagram: v.string() });

/**
 * Changes a completed profile's answers, for the member (`updateProfile`) or for staff correcting it: onboarding's
 * normalisation and rules, and its revision check, so two tabs never overwrite each other. `instagramChangedAt` is set
 * only when the normalised username differs. Returns the profile and the fields that changed; no change writes nothing,
 * and a retried save that already went through is accepted.
 */
export async function editProfile(ctx: MutationCtx, profile: Doc<"memberProfiles">, revision: number, values: ProfileValues) {
  const clean = normalizeProfile(values);
  const errors = validateProfile(clean);
  if (Object.keys(errors).length) throw new ConvexError({ code: "VALIDATION", message: "Periksa isian yang ditandai, lalu simpan lagi.", fields: errors });
  const changed = changedProfileFields(profile, clean);
  if (!changed.length) return { profile, changed };
  if (revision !== profile.revision) throw new ConvexError(staleProfile);
  const now = Date.now();
  await ctx.db.patch(profile._id, { ...clean, revision: revision + 1, updatedAt: now, ...(changed.includes("instagram") ? { instagramChangedAt: now } : {}) });
  return { profile: (await ctx.db.get(profile._id))!, changed };
}

/**
 * A member edits their own completed profile from /dashboard/profil (#235): name, school or campus, study program and
 * Instagram. Onboarding stays with `saveStep`, which never changes a completed profile. Not logged beyond the Instagram time.
 */
export const updateProfile = mutation({
  args: { revision: v.number(), values: profileValues },
  handler: async (ctx, { revision, values }) => {
    const { profile } = await requireMember(ctx);
    return (await editProfile(ctx, profile, revision, values)).profile;
  },
});
