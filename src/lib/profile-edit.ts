import { finalStep, normalizeOnboarding, validateOnboarding, type InstitutionKind, type OnboardingErrors } from "./onboarding";

/**
 * The onboarding answers a member edits on /dashboard/profil and staff correct on the member page (#235). Email comes
 * from Google, and the community tag and dashboard access stay with staff, so none of them is here.
 */
export type ProfileValues = { fullName: string; institutionKind: InstitutionKind; campus: string; studyProgram: string; instagram: string };
/** A form's values before the kind is chosen, for profiles saved before onboarding asked for it. */
export type ProfileDraft = Omit<ProfileValues, "institutionKind"> & { institutionKind?: InstitutionKind };
/** The fields in form order, which is also the order errors are focused and changes are listed. */
export const profileFields = ["fullName", "institutionKind", "campus", "studyProgram", "instagram"] as const;
export type ProfileField = (typeof profileFields)[number];

/** Onboarding's normalisation, so an edit stores exactly what onboarding would have. */
export function normalizeProfile(values: ProfileValues): ProfileValues {
  const clean = normalizeOnboarding(values);
  return { fullName: clean.fullName, institutionKind: values.institutionKind, campus: clean.campus, studyProgram: clean.studyProgram, instagram: clean.instagram ?? "" };
}

/** Onboarding's rules for every answer at once (the education screen's, with the kind required, and the last screen's). */
export function validateProfile(values: ProfileDraft): OnboardingErrors {
  const found = { ...validateOnboarding(values, 2, { requireKind: true }), ...validateOnboarding(values, finalStep) };
  return Object.fromEntries(profileFields.flatMap((field) => found[field] ? [[field, found[field]]] : []));
}

/** The answers that differ from what the profile stores, in form order. */
export function changedProfileFields(stored: Partial<Record<ProfileField, string>>, next: ProfileValues): ProfileField[] {
  return profileFields.filter((field) => (stored[field] ?? "") !== next[field]);
}

/** A stored profile as form values; a profile from before the kind was asked had a campus, as onboarding assumes. */
export function profileDraft(profile: Partial<Record<ProfileField, string>> & { institutionKind?: InstitutionKind }): ProfileDraft {
  return {
    fullName: profile.fullName ?? "", campus: profile.campus ?? "", studyProgram: profile.studyProgram ?? "", instagram: profile.instagram ?? "",
    institutionKind: profile.institutionKind ?? (profile.campus ? "campus" : undefined),
  };
}
