export type OnboardingValues = { fullName: string; campus: string; studyProgram: string };
export type OnboardingStep = 1 | 2 | 3 | 4;
export type OnboardingErrors = Partial<Record<keyof OnboardingValues, string>>;

export const onboardingLimits = { fullName: 120, campus: 150, studyProgram: 150 } as const;

export function normalizeOnboarding(values: OnboardingValues): OnboardingValues {
  return {
    fullName: values.fullName.trim().replace(/\s+/g, " "),
    campus: values.campus.trim().replace(/\s+/g, " "),
    studyProgram: values.studyProgram.trim().replace(/\s+/g, " "),
  };
}

export function validateOnboarding(values: OnboardingValues, step: OnboardingStep): OnboardingErrors {
  const clean = normalizeOnboarding(values);
  const errors: OnboardingErrors = {};
  const fields: (keyof OnboardingValues)[] = step === 1 ? ["fullName"] : step === 2 ? ["campus", "studyProgram"] : ["fullName", "campus", "studyProgram"];
  const required = { fullName: "Isi nama yang ingin kamu pakai.", campus: "Isi atau pilih nama kampusmu.", studyProgram: "Isi atau pilih program studimu." };
  for (const field of fields) {
    if (!clean[field]) errors[field] = required[field];
    else if (clean[field].length > onboardingLimits[field]) errors[field] = `Maksimal ${onboardingLimits[field]} karakter.`;
  }
  return errors;
}

export function onboardingDestination(next: string | null) {
  return next === "review" ? "/apresiasi/admin" : next === "dashboard" ? "/dashboard" : "/apresiasi";
}
