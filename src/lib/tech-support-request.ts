import { toJakartaInput } from "./assignment";
import { discordError, normalizeDiscord, normalizeWhatsapp, whatsappError } from "./contact";

/**
 * Tech Support requests from the dashboard (#92): what a member asks for, the statuses the queue moves a request
 * through, and the response target counted in working days (Monday to Friday, WIB; public holidays are not skipped).
 */

/** The kinds of help the program offers, listed on /program/tech-support and offered as choices on the form. */
export const techSupportHelpKinds = ["Mencari rekan tim", "Ideasi", "Konsultasi teknis", "Review UI/UX", "Umpan balik proposal", "Review pitch deck", "Mock judging", "Latihan presentasi"] as const;

/** Working days within which a request gets a reply. */
export const techSupportResponseDays = 3;

export type TechSupportStatus = "new" | "matched" | "inProgress" | "closed";
export const techSupportStatuses: TechSupportStatus[] = ["new", "matched", "inProgress", "closed"];
export const techSupportStatusLabels: Record<TechSupportStatus, string> = { new: "Baru", matched: "Mentor ditemukan", inProgress: "Berjalan", closed: "Selesai" };

/**
 * Where a request can go from each status. Matched and in progress need a mentor; a closed request can be reopened.
 * Going back to new keeps the mentor's name on record.
 */
export const techSupportTransitions: Record<TechSupportStatus, TechSupportStatus[]> = {
  new: ["matched", "closed"],
  matched: ["inProgress", "new", "closed"],
  inProgress: ["matched", "closed"],
  closed: ["new", "inProgress"],
};
export const needsMentor = (status: TechSupportStatus) => status === "matched" || status === "inProgress";

/** Requests a member can have open (not closed) at once. */
export const maxOpenRequests = 3;
export const techSupportLimits = { competition: 160, competitionUrl: 300, teamName: 80, progress: 2000, mentorName: 120, note: 500 } as const;

export type Participation = "team" | "solo";
export const participationLabels: Record<Participation, string> = { team: "Tim", solo: "Sendiri" };

/**
 * The form's values; `deadline` is a WIB date from a date input (YYYY-MM-DD). `whatsapp` and `discord` are how handlers
 * reach the member (#251), normalised by src/lib/contact.ts; `discord` may be empty.
 */
export type TechSupportValues = {
  competition: string; competitionUrl: string; deadline: string; participation: Participation | "";
  teamName: string; helpKinds: string[]; progress: string; whatsapp: string; discord: string;
};
export type TechSupportErrors = Partial<Record<keyof TechSupportValues, string>>;

const squash = (value: string) => value.trim().replace(/\s+/g, " ");

export function normalizeRequest(values: TechSupportValues): TechSupportValues {
  return {
    competition: squash(values.competition), competitionUrl: values.competitionUrl.trim(), deadline: values.deadline.trim(),
    participation: values.participation, teamName: values.participation === "team" ? squash(values.teamName) : "",
    helpKinds: techSupportHelpKinds.filter((kind) => values.helpKinds.includes(kind)), progress: values.progress.trim(),
    whatsapp: normalizeWhatsapp(values.whatsapp), discord: normalizeDiscord(values.discord),
  };
}

function isWebLink(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; }
  catch { return false; }
}

/** A real calendar date as YYYY-MM-DD. */
function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Field errors for normalized values; the deadline may be today in WIB but not earlier. */
export function validateRequest(values: TechSupportValues, now: number): TechSupportErrors {
  const errors: TechSupportErrors = {};
  if (!values.competition) errors.competition = "Tulis nama kompetisinya.";
  else if (values.competition.length > techSupportLimits.competition) errors.competition = `Maksimal ${techSupportLimits.competition} karakter.`;
  if (!values.competitionUrl) errors.competitionUrl = "Tempel tautan info atau pendaftaran kompetisinya.";
  else if (values.competitionUrl.length > techSupportLimits.competitionUrl || !isWebLink(values.competitionUrl)) errors.competitionUrl = "Tempel tautan lengkap yang diawali https://.";
  if (!isDate(values.deadline)) errors.deadline = "Pilih tanggal tenggat kompetisinya.";
  else if (values.deadline < toJakartaInput(now).slice(0, 10)) errors.deadline = "Tenggatnya sudah lewat. Pilih tenggat tahap berikutnya.";
  if (!values.participation) errors.participation = "Pilih ikut sebagai tim atau sendiri.";
  else if (values.participation === "team" && !values.teamName) errors.teamName = "Tulis nama timnya.";
  else if (values.teamName.length > techSupportLimits.teamName) errors.teamName = `Maksimal ${techSupportLimits.teamName} karakter.`;
  if (!values.helpKinds.length) errors.helpKinds = "Pilih minimal satu bentuk bantuan.";
  if (!values.progress) errors.progress = "Ceritakan progres ide atau proyekmu sejauh ini.";
  else if (values.progress.length > techSupportLimits.progress) errors.progress = `Maksimal ${techSupportLimits.progress} karakter.`;
  const whatsapp = whatsappError(values.whatsapp), discord = discordError(values.discord);
  if (whatsapp) errors.whatsapp = whatsapp;
  if (discord) errors.discord = discord;
  return errors;
}

const day = 24 * 60 * 60 * 1000;
const wib = 7 * 60 * 60 * 1000;

/** Working milliseconds from the epoch to a WIB-shifted moment. Day 0 (1 Jan 1970) was a Thursday. */
function workingSinceEpoch(shifted: number) {
  const days = Math.floor(shifted / day);
  const weekday = (index: number) => (index + 4) % 7; // 0 is Sunday
  let total = Math.floor(days / 7) * 5 * day;
  for (let index = days - (days % 7); index < days; index++) if (weekday(index) >= 1 && weekday(index) <= 5) total += day;
  if (weekday(days) >= 1 && weekday(days) <= 5) total += shifted - days * day;
  return total;
}

/** Time between two moments that falls on Monday to Friday in WIB, in milliseconds. */
export function workingTime(from: number, to: number) {
  return to <= from ? 0 : workingSinceEpoch(to + wib) - workingSinceEpoch(from + wib);
}

/** A new request past the response target. Matching (or closing) a request stops its clock. */
export function isOverdue(request: { status: TechSupportStatus; submittedAt: number }, now: number) {
  return request.status === "new" && workingTime(request.submittedAt, now) > techSupportResponseDays * day;
}

/** "kurang dari 1 hari kerja", "2 hari kerja", "3,5 hari kerja". */
export function workingDaysLabel(milliseconds: number) {
  const days = Math.floor((milliseconds / day) * 10) / 10;
  if (days < 1) return "kurang dari 1 hari kerja";
  return `${String(days).replace(".", ",")} hari kerja`;
}

/** One team, counted once however many of its members ask for the same competition. */
export function teamKey(request: { teamName?: string | null; competition: string }) {
  const key = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  return `${key(request.teamName ?? "")}|${key(request.competition)}`;
}

type KpiRow = { status: TechSupportStatus; matchedAt?: number | null; participation: Participation; teamName?: string | null; competition: string };

/**
 * The program's counts: requests facilitated (ever matched with a mentor, so closing a matched request still counts)
 * and teams supported (distinct teams among those), plus how many sit in each status.
 */
export function techSupportKpis(rows: KpiRow[]) {
  const facilitated = rows.filter((row) => row.matchedAt);
  return {
    facilitated: facilitated.length,
    teams: new Set(facilitated.filter((row) => row.participation === "team").map(teamKey)).size,
    byStatus: Object.fromEntries(techSupportStatuses.map((status) => [status, rows.filter((row) => row.status === status).length])) as Record<TechSupportStatus, number>,
  };
}
