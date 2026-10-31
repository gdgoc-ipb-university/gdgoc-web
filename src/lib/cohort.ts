import { slugify } from "./assignment";

export type CohortRole = { key: string; name: string };
export type CohortValues = { slug: string; name: string; roles: CohortRole[]; attendanceTarget?: number };
export type CohortErrors = Partial<Record<"slug" | "name" | "roles" | "attendanceTarget", string>>;

export const cohortLimits = { name: 120, roles: 8, roleName: 40, roleKey: 32 } as const;
const roleKeyPattern = /^[a-z][a-z0-9-]*$/;

/** GDGoC Catalyst 2026/27 (#32): one track, three roles, a 70% attendance commitment. `cohorts.seedCatalyst` creates it. */
export const catalystCohort: CohortValues = {
  slug: "catalyst-2026",
  name: "GDGoC Catalyst 2026/27",
  roles: [{ key: "hacker", name: "Hacker" }, { key: "hipster", name: "Hipster" }, { key: "hustler", name: "Hustler" }],
  attendanceTarget: 0.7,
};

/** Enrolments match accounts by email, so both sides are compared trimmed and lowercased. */
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeCohort(values: CohortValues): CohortValues {
  const name = values.name.trim().replace(/\s+/g, " ");
  return {
    slug: slugify(values.slug) || slugify(name),
    name,
    roles: values.roles.map((role) => ({ key: role.key.trim().toLowerCase(), name: role.name.trim().replace(/\s+/g, " ") })),
    ...(values.attendanceTarget === undefined ? {} : { attendanceTarget: values.attendanceTarget }),
  };
}

export function validateCohort(values: CohortValues): CohortErrors {
  const errors: CohortErrors = {};
  if (!values.name) errors.name = "Isi nama cohort.";
  else if (values.name.length > cohortLimits.name) errors.name = `Maksimal ${cohortLimits.name} karakter.`;
  if (!values.slug) errors.slug = "Isi slug cohort.";
  if (!values.roles.length) errors.roles = "Tambahkan setidaknya satu peran.";
  else if (values.roles.length > cohortLimits.roles) errors.roles = `Maksimal ${cohortLimits.roles} peran.`;
  else if (values.roles.some((role) => !roleKeyPattern.test(role.key) || role.key.length > cohortLimits.roleKey)) errors.roles = "Kode peran hanya huruf kecil, angka, dan tanda hubung, diawali huruf.";
  else if (values.roles.some((role) => !role.name || role.name.length > cohortLimits.roleName)) errors.roles = `Nama peran wajib diisi, maksimal ${cohortLimits.roleName} karakter.`;
  else if (new Set(values.roles.map((role) => role.key)).size !== values.roles.length) errors.roles = "Kode peran tidak boleh sama.";
  const target = values.attendanceTarget;
  if (target !== undefined && !(target > 0 && target <= 1)) errors.attendanceTarget = "Target kehadiran antara 0 dan 100%.";
  return errors;
}

/** Whether an assignment for these roles (absent or empty means every role) is given to a participant with this role. */
export function inCohortRoles(assignment: { cohortRoles?: string[] }, role: string) {
  return !assignment.cohortRoles?.length || assignment.cohortRoles.includes(role);
}
