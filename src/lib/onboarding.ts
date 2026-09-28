export const divisions = ["Program & Development", "Media & Creative", "Technical", "Community & External", "Secretary Treasurer"] as const;
export type MemberType = "member" | "core";
export const memberTypeLabels: Record<MemberType, string> = { member: "Member", core: "Core Team" };

export type OnboardingValues = { fullName: string; campus: string; studyProgram: string; memberType: MemberType | ""; division: string };
export type OnboardingStep = 1 | 2 | 3 | 4 | 5;
export type OnboardingErrors = Partial<Record<keyof OnboardingValues, string>>;
export type RoleValues = Pick<OnboardingValues, "memberType" | "division">;

export const onboardingLimits = { fullName: 120, campus: 150, studyProgram: 150 } as const;
export const roleStep: OnboardingStep = 3;
export const finalStep: OnboardingStep = 5;

export function normalizeOnboarding(values: OnboardingValues): OnboardingValues {
  return {
    fullName: values.fullName.trim().replace(/\s+/g, " "),
    campus: values.campus.trim().replace(/\s+/g, " "),
    studyProgram: values.studyProgram.trim().replace(/\s+/g, " "),
    memberType: values.memberType,
    division: values.memberType === "core" ? values.division.trim() : "",
  };
}

export function validateRole(values: RoleValues): OnboardingErrors {
  if (values.memberType !== "member" && values.memberType !== "core") return { memberType: "Pilih Member atau Core Team." };
  if (values.memberType === "core" && !divisions.some((division) => division === values.division)) return { division: "Pilih divisimu di Core Team." };
  return {};
}

export function validateOnboarding(values: OnboardingValues, step: OnboardingStep): OnboardingErrors {
  const clean = normalizeOnboarding(values);
  if (step === roleStep) return validateRole(clean);
  const errors: OnboardingErrors = {};
  const fields: (keyof typeof onboardingLimits)[] = step === 1 ? ["fullName"] : step === 2 ? ["campus", "studyProgram"] : ["fullName", "campus", "studyProgram"];
  const required = { fullName: "Isi nama yang ingin kamu pakai.", campus: "Isi atau pilih nama kampusmu.", studyProgram: "Isi atau pilih program studimu." };
  for (const field of fields) {
    if (!clean[field]) errors[field] = required[field];
    else if (clean[field].length > onboardingLimits[field]) errors[field] = `Maksimal ${onboardingLimits[field]} karakter.`;
  }
  return errors;
}

export function onboardingDestination(next: string | null) {
  return next === "review" ? "/dashboard/apresiasi/tinjau" : "/dashboard";
}
