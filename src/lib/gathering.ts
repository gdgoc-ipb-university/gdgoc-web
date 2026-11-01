import { audienceGroups, fromJakartaInput, slugify, toJakartaInput, type AudienceGroup } from "./assignment";
import { toCsv } from "./assignment-export";
import { memberTagLabel, type MemberType } from "./onboarding";

/** A chapter gathering that checks in with member cards (E10, #117): a Core Team meeting or a member meetup. */
export type GatheringStatus = "draft" | "open" | "closed";
export const gatheringStatusLabels: Record<GatheringStatus, string> = { draft: "Draft", open: "Check-in dibuka", closed: "Selesai" };
/** Door helpers per gathering, like assignment reviewers. */
export const maxHelpers = 10;
export const gatheringLimits = { title: 120, venue: 160 } as const;
/** Long enough for an evening that runs past midnight, short enough to catch a wrong date. */
const maxLength = 24 * 60 * 60 * 1000;

/** The form's values: times are `datetime-local` strings in WIB. */
export type GatheringValues = { title: string; startsAt: string; endsAt: string; venue: string; audience: AudienceGroup[] };
export type GatheringErrors = Partial<Record<keyof GatheringValues, string>>;

export function normalizeGathering(values: GatheringValues): GatheringValues {
  return {
    title: values.title.trim().replace(/\s+/g, " "), venue: values.venue.trim().replace(/\s+/g, " "),
    startsAt: values.startsAt.trim(), endsAt: values.endsAt.trim(),
    audience: audienceGroups.filter((group) => values.audience.includes(group)),
  };
}

export function validateGathering(values: GatheringValues): GatheringErrors {
  const errors: GatheringErrors = {};
  if (!values.title) errors.title = "Tulis nama kegiatan.";
  else if (values.title.length > gatheringLimits.title) errors.title = `Maksimal ${gatheringLimits.title} karakter.`;
  if (!values.venue) errors.venue = "Tulis tempatnya, misalnya Javano Coffee, Private Room 2.";
  else if (values.venue.length > gatheringLimits.venue) errors.venue = `Maksimal ${gatheringLimits.venue} karakter.`;
  const start = fromJakartaInput(values.startsAt), end = fromJakartaInput(values.endsAt);
  if (Number.isNaN(start)) errors.startsAt = "Pilih tanggal dan jam mulai.";
  if (Number.isNaN(end)) errors.endsAt = "Pilih tanggal dan jam selesai.";
  else if (!Number.isNaN(start) && end <= start) errors.endsAt = "Jam selesai harus setelah jam mulai.";
  else if (!Number.isNaN(start) && end - start > maxLength) errors.endsAt = "Kegiatan paling lama 24 jam.";
  if (!values.audience.length) errors.audience = "Pilih minimal satu kelompok.";
  return errors;
}

/** The WIB calendar day of a moment, as YYYY-MM-DD. */
export function wibDay(timestamp: number) {
  return toJakartaInput(timestamp).slice(0, 10);
}

/** Whether the gathering runs today in WIB, so its door appears on a scanned card. */
export function runsToday(gathering: { startsAt: number; endsAt: number }, now: number) {
  const today = wibDay(now);
  return wibDay(gathering.startsAt) <= today && today <= wibDay(gathering.endsAt);
}

const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
/** "Sab, 21 Nov 2026 · 09.00–13.00 WIB", or both dates when it ends on another day. */
export function gatheringTimeLabel(gathering: { startsAt: number; endsAt: number }) {
  const part = (timestamp: number) => {
    const [date, time] = toJakartaInput(timestamp).split("T");
    const [year, month, day] = date.split("-").map(Number);
    const weekday = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
    return { day: `${weekday}, ${day} ${months[month - 1]} ${year}`, time: time.replace(":", ".") };
  };
  const start = part(gathering.startsAt), end = part(gathering.endsAt);
  return start.day === end.day ? `${start.day} · ${start.time}–${end.time} WIB` : `${start.day} ${start.time} – ${end.day} ${end.time} WIB`;
}

/** "14.05 WIB". */
export function clockLabel(timestamp: number) {
  return `${toJakartaInput(timestamp).slice(11).replace(":", ".")} WIB`;
}

export type CheckInExportRow = {
  name: string; campus: string; studyProgram: string; memberType: MemberType | null; division: string | null;
  checkedInAt: number; method: "scan" | "manual"; by: string | null; outsideAudience: boolean;
};

/** Who came, in check-in order, with the encoding the other exports use. No emails. */
export function checkInsCsv(rows: CheckInExportRow[]) {
  return toCsv([
    ["Nama", "Kampus", "Program studi", "Peran komunitas", "Waktu hadir", "Cara", "Dicatat oleh", "Di luar sasaran"],
    ...rows.map((row) => [
      row.name, row.campus, row.studyProgram, row.memberType ? memberTagLabel(row.memberType, row.division) : "",
      `${toJakartaInput(row.checkedInAt).replace("T", " ")} WIB`, row.method === "scan" ? "Pindai kartu" : "Manual", row.by ?? "", row.outsideAudience ? "Ya" : "",
    ]),
  ]);
}

export function checkInsFileName(gathering: { title: string; startsAt: number }) {
  return `kehadiran-${slugify(gathering.title) || "kegiatan"}-${wibDay(gathering.startsAt)}.csv`;
}
