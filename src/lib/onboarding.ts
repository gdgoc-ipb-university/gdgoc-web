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

/** Where the member studies: a campus (university, institute, polytechnic…) or a school (SMK). Both may join since the 2026/27 member intake. */
export type InstitutionKind = "campus" | "school";
export const institutionKinds: InstitutionKind[] = ["campus", "school"];
export const institutionKindLabels: Record<InstitutionKind, string> = { campus: "Mahasiswa", school: "Siswa SMK" };
/** Field labels per kind; no kind yet reads as either. */
export function educationLabels(kind: InstitutionKind | undefined) {
  return kind === "school" ? { institution: "Sekolah", program: "Jurusan" } : kind === "campus" ? { institution: "Kampus", program: "Program studi" } : { institution: "Sekolah atau kampus", program: "Jurusan atau program studi" };
}

export type OnboardingValues = { fullName: string; campus: string; studyProgram: string; institutionKind?: InstitutionKind };
export type OnboardingErrors = Partial<Record<keyof OnboardingValues, string>>;
export type RoleValues = { memberType: MemberType | ""; division: string };
export type RoleErrors = Partial<Record<keyof RoleValues, string>>;

/**
 * Onboarding screens by id: name, school or campus, the WhatsApp invitation, the GDG Community invitation, and the
 * Tech Support offer. Ids keep their numbers from earlier flows so saved progress (`memberProfiles.nextStep`) means the
 * same screen: 3 was the role screen, removed when community tags became staff-assigned (#156); 6 came after (#198).
 */
export const onboardingSteps = [1, 2, 4, 5, 6] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];
export type SavedStep = OnboardingStep | 3;
export const finalStep = 6 satisfies OnboardingStep;

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
    ...(values.institutionKind ? { institutionKind: values.institutionKind } : {}),
  };
}

/** Staff assignment from the members page, the only way to set a tag: Core Team needs a division, BoD may have one. */
export function validateStaffRole(values: RoleValues): RoleErrors {
  if (values.memberType !== "member" && values.memberType !== "core" && values.memberType !== "bod") return { memberType: "Pilih Member, Core Team, atau BoD." };
  if (values.memberType === "core" && !divisions.some((division) => division === values.division)) return { division: "Pilih divisi untuk Core Team." };
  if (values.memberType === "bod" && values.division && !divisions.some((division) => division === values.division)) return { division: "Pilih divisi yang tersedia atau kosongkan untuk BoD." };
  return {};
}

/**
 * Field errors for a screen. The server accepts a profile without a kind (saved before it was asked, or from an older
 * page during a deploy); the page itself asks for one with `requireKind`.
 */
export function validateOnboarding(values: OnboardingValues, step: OnboardingStep, { requireKind = false } = {}): OnboardingErrors {
  const clean = normalizeOnboarding(values);
  const errors: OnboardingErrors = {};
  const fields: (keyof typeof onboardingLimits)[] = step === 1 ? ["fullName"] : step === 2 ? ["campus", "studyProgram"] : ["fullName", "campus", "studyProgram"];
  const school = clean.institutionKind === "school";
  const required = { fullName: "Isi nama yang ingin kamu pakai.", campus: school ? "Isi atau pilih nama sekolahmu." : "Isi atau pilih nama kampusmu.", studyProgram: school ? "Isi atau pilih jurusanmu." : "Isi atau pilih program studimu." };
  if (requireKind && step === 2 && !clean.institutionKind) errors.institutionKind = "Pilih kamu mahasiswa atau siswa SMK.";
  for (const field of fields) {
    if (!clean[field]) errors[field] = required[field];
    else if (clean[field].length > onboardingLimits[field]) errors[field] = `Maksimal ${onboardingLimits[field]} karakter.`;
  }
  return errors;
}

/** Where "Ajukan Tech Support" on the last screen leads: the request form, opened ready to fill. */
export const techSupportRequestPath = "/dashboard/tech-support?ajukan=1";

/**
 * Where onboarding ends: a fixed page per `next` value, never the value itself. `league` returns to Tech League (#179),
 * to the team invite the member opened when `undangan` holds an invite code (#183, #192), rebuilt from the code alone.
 */
export function onboardingDestination(next: string | null, invite: string | null = null) {
  const code = inviteCodeFrom(invite);
  if (next === "league") return leagueHref(code ? invitePath(code) : "/daftar");
  return next === "review" ? "/dashboard/apresiasi/tinjau" : "/dashboard";
}
