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

/** The fields as an access log sentence names them (#235). */
export const profileFieldLabels: Record<ProfileField, string> = {
  fullName: "nama", institutionKind: "jenjang (mahasiswa atau siswa)", campus: "sekolah/kampus", studyProgram: "jurusan/program studi", instagram: "username Instagram",
};

/** A correction's logged fields ("fullName,instagram") in words: "nama dan username Instagram". Unknown keys are skipped. */
export function profileFieldsLabel(fields: string) {
  const names = profileFields.filter((field) => fields.split(",").includes(field)).map((field) => profileFieldLabels[field]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")}${names.length > 2 ? "," : ""} dan ${names.at(-1)}` : names[0] ?? "profil";
}

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
export function profileDraft(profile: Partial<Record<Exclude<ProfileField, "institutionKind">, string>> & { institutionKind?: InstitutionKind | null }): ProfileDraft {
  return {
    fullName: profile.fullName ?? "", campus: profile.campus ?? "", studyProgram: profile.studyProgram ?? "", instagram: profile.instagram ?? "",
    institutionKind: profile.institutionKind ?? (profile.campus ? "campus" : undefined),
  };
}

const dayInWib = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
const dayAndYearInWib = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const yearInWib = new Intl.DateTimeFormat("id-ID", { year: "numeric", timeZone: "Asia/Jakarta" });

/** "Instagram diubah 12 Nov" for staff, the day in WIB, with the year once it is not this year's. */
export function instagramChangedLabel(at: number, now = Date.now()) {
  return `Instagram diubah ${(yearInWib.format(at) === yearInWib.format(now) ? dayInWib : dayAndYearInWib).format(at)}`;
}
