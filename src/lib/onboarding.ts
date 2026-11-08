import { leagueHref } from "./league";
import { inviteCodeFrom, invitePath } from "./league-team";
export const divisions = ["Program & Development", "Media & Creative", "Technical", "Community & External", "Secretary Treasurer"] as const;
/** Community tags. Members register as Member; staff assign Core Team and BoD (Board of Directors, a tag, not dashboard access). */
export type MemberType = "member" | "core" | "bod";
export const memberTypeLabels: Record<MemberType, string> = { member: "Member", core: "Core Team", bod: "BoD" };

/** "Core Team · Technical", "BoD · Technical", "BoD", or "Member". */
export function memberTagLabel(type: MemberType, division?: string | null) {
  return type !== "member" && division ? `${memberTypeLabels[type]} · ${division}` : memberTypeLabels[type];
}

export type OnboardingValues = { fullName: string; campus: string; studyProgram: string };
export type OnboardingErrors = Partial<Record<keyof OnboardingValues, string>>;
export type RoleValues = { memberType: MemberType | ""; division: string };
export type RoleErrors = Partial<Record<keyof RoleValues, string>>;

/**
 * Onboarding screens by id: name, campus, the WhatsApp invitation, the GDG Community invitation. Ids keep their
 * numbers from the five-screen flow so saved progress (`memberProfiles.nextStep`) means the same screen: 3 was the
 * role screen, removed when community tags became staff-assigned (#156).
 */
export const onboardingSteps = [1, 2, 4, 5] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];
export type SavedStep = OnboardingStep | 3;
export const finalStep = 5 satisfies OnboardingStep;

export const onboardingLimits = { fullName: 120, campus: 150, studyProgram: 150 } as const;

/** The screen to resume on; a profile saved on the removed role screen continues at the WhatsApp invitation. */
export function resumeStep(saved: SavedStep | undefined): OnboardingStep {
  return saved === 3 ? 4 : saved ?? 1;
}
export function stepAfter(step: OnboardingStep): OnboardingStep {
  return onboardingSteps[Math.min(onboardingSteps.indexOf(step) + 1, onboardingSteps.length - 1)];
}
export function stepBefore(step: OnboardingStep): OnboardingStep {
  return onboardingSteps[Math.max(onboardingSteps.indexOf(step) - 1, 0)];
}

export function normalizeOnboarding(values: OnboardingValues): OnboardingValues {
  return {
    fullName: values.fullName.trim().replace(/\s+/g, " "),
    campus: values.campus.trim().replace(/\s+/g, " "),
    studyProgram: values.studyProgram.trim().replace(/\s+/g, " "),
  };
}

/** Staff assignment from the members page, the only way to set a tag: Core Team needs a division, BoD may have one. */
export function validateStaffRole(values: RoleValues): RoleErrors {
  if (values.memberType !== "member" && values.memberType !== "core" && values.memberType !== "bod") return { memberType: "Pilih Member, Core Team, atau BoD." };
  if (values.memberType === "core" && !divisions.some((division) => division === values.division)) return { division: "Pilih divisi untuk Core Team." };
  if (values.memberType === "bod" && values.division && !divisions.some((division) => division === values.division)) return { division: "Pilih divisi yang tersedia atau kosongkan untuk BoD." };
  return {};
}

export function validateOnboarding(values: OnboardingValues, step: OnboardingStep): OnboardingErrors {
  const clean = normalizeOnboarding(values);
  const errors: OnboardingErrors = {};
  const fields: (keyof typeof onboardingLimits)[] = step === 1 ? ["fullName"] : step === 2 ? ["campus", "studyProgram"] : ["fullName", "campus", "studyProgram"];
  const required = { fullName: "Isi nama yang ingin kamu pakai.", campus: "Isi atau pilih nama kampusmu.", studyProgram: "Isi atau pilih program studimu." };
  for (const field of fields) {
    if (!clean[field]) errors[field] = required[field];
    else if (clean[field].length > onboardingLimits[field]) errors[field] = `Maksimal ${onboardingLimits[field]} karakter.`;
  }
  return errors;
}

/**
 * Where onboarding ends: a fixed page per `next` value, never the value itself. `league` returns to Tech League (#179),
 * to the team invite the member opened when `undangan` holds an invite code (#183, #192), rebuilt from the code alone.
 */
export function onboardingDestination(next: string | null, invite: string | null = null) {
  const code = inviteCodeFrom(invite);
  if (next === "league") return leagueHref(code ? invitePath(code) : "/daftar");
  return next === "review" ? "/dashboard/apresiasi/tinjau" : "/dashboard";
}
