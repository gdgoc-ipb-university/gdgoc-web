/** "BoD" is offered only to members staff tagged as BoD; the server checks it on submit. */
export const memberTypes = ["Member", "Core Team", "BoD"] as const;
export const achievementLevels = ["Kampus", "Regional", "Nasional", "Internasional"] as const;
/**
 * The current GDGoC IPB University chapter year, both ends inclusive. Only achievements announced within it can be
 * submitted for appreciation. Update it when a new chapter year starts in July.
 */
export const chapterPeriod = { start: "2026-07-01", end: "2027-07-01", label: "1 Juli 2026 – 1 Juli 2027" } as const;

/** Today's date in Bogor (WIB) as YYYY-MM-DD, the calendar the form's dates use. */
export function todayInWib(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export const participationTypes = ["Individu", "Tim"] as const;

export const emptyAppreciation = {
  fullName: "", memberType: "", campus: "", studyProgram: "", instagram: "",
  achievement: "", eventName: "", organizer: "", level: "", participation: "",
  teamName: "", teamMembers: "", eventDate: "", story: "", documentationLinks: "",
  publicationConsent: false,
};
export type AppreciationValues = typeof emptyAppreciation;
export type AppreciationField = keyof AppreciationValues;
export type FieldErrors = Partial<Record<AppreciationField, string>>;

export const fieldLimits: Record<Exclude<AppreciationField, "publicationConsent">, number> = {
  fullName: 120, memberType: 30, campus: 150, studyProgram: 150, instagram: 31,
  achievement: 160, eventName: 180, organizer: 180, level: 30, participation: 20,
  teamName: 120, teamMembers: 1200, eventDate: 10, story: 2400, documentationLinks: 6000,
};

export function normalizeAppreciation(values: AppreciationValues): AppreciationValues {
  const clean = { ...values };
  for (const key of Object.keys(fieldLimits) as (keyof typeof fieldLimits)[]) clean[key] = clean[key].trim();
  clean.instagram = clean.instagram.replace(/^@/, "");
  if (clean.participation === "Individu") { clean.teamName = ""; clean.teamMembers = ""; }
  return clean;
}

export function documentLinks(text: string) {
  return text.split(/\r?\n/).map((link) => link.trim()).filter(Boolean);
}

export function isDocumentUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.hostname.includes(".") &&
      !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) &&
      !url.hostname.endsWith(".local");
  } catch { return false; }
}

export function isInstagramPostUrl(value: string) {
  if (!isDocumentUrl(value)) return false;
  const url = new URL(value);
  return ["instagram.com", "www.instagram.com"].includes(url.hostname) && /^\/(p|reel)\/[^/]+/.test(url.pathname);
}

export function validateAppreciation(values: AppreciationValues, now = new Date()): FieldErrors {
  const v = normalizeAppreciation(values);
  const errors: FieldErrors = {};
  for (const key of Object.keys(fieldLimits) as (keyof typeof fieldLimits)[]) {
    if (v[key].length > fieldLimits[key]) errors[key] = `Maksimal ${fieldLimits[key]} karakter.`;
  }
  const required: Partial<Record<AppreciationField, string>> = {
    fullName: "Isi nama yang akan dicantumkan.", campus: "Isi nama kampusmu.",
    achievement: "Tulis prestasi yang kamu raih.", eventName: "Isi nama kompetisi atau acara.",
    organizer: "Isi nama penyelenggara.", story: "Ceritakan singkat proses dan hasilnya.",
  };
  for (const [key, message] of Object.entries(required)) if (!v[key as keyof typeof required]) errors[key as AppreciationField] = message;
  if (!memberTypes.some((option) => option === v.memberType)) errors.memberType = "Pilih peranmu di GDGoC IPB.";
  if (!achievementLevels.some((option) => option === v.level)) errors.level = "Pilih tingkat kompetisi.";
  if (!participationTypes.some((option) => option === v.participation)) errors.participation = "Pilih individu atau tim.";
  if (!/^(?!\.)(?!.*\.\.)(?!.*\.$)[a-zA-Z0-9._]{1,30}$/.test(v.instagram)) errors.instagram = "Isi username Instagram yang valid, misalnya gdgoc.ipb.";
  if (v.participation === "Tim" && !v.teamName) errors.teamName = "Isi nama tim.";
  if (v.participation === "Tim" && !v.teamMembers) errors.teamMembers = "Cantumkan nama dan Instagram anggota tim.";
  const date = new Date(`${v.eventDate}T00:00:00.000Z`);
  const realDate = /^\d{4}-\d{2}-\d{2}$/.test(v.eventDate) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v.eventDate;
  if (realDate && (v.eventDate < chapterPeriod.start || v.eventDate > chapterPeriod.end)) {
    errors.eventDate = `Apresiasi hanya untuk prestasi yang diumumkan dalam periode GDGoC IPB ${chapterPeriod.label}.`;
  } else if (!realDate || v.eventDate > todayInWib(now)) {
    errors.eventDate = "Pilih tanggal pengumuman prestasi yang sudah berlangsung.";
  }
  const links = documentLinks(v.documentationLinks);
  if (!links.length) errors.documentationLinks = "Tambahkan setidaknya satu link dokumentasi.";
  else if (links.length > 5) errors.documentationLinks = "Maksimal lima link. Folder Drive bisa memuat beberapa dokumen.";
  else if (links.some((link) => link.length > 1500 || !isDocumentUrl(link))) errors.documentationLinks = "Gunakan link https:// yang valid, satu link per baris.";
  if (!v.publicationConsent) errors.publicationConsent = "Persetujuan publikasi diperlukan sebelum mengirim.";
  return errors;
}

/** Review-queue filters. `search` matches the achievement or the sender (the submitted name or the account name); `campus` is a substring; empty fields match everything. */
export type QueueFilter = { search: string; level: string; campus: string };
export const queueSearchLimits = { scanned: 500, results: 50 } as const;

const folded = (value: string) => value.toLocaleLowerCase("id").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export function isQueueFilterActive(filter: QueueFilter) {
  return Boolean(folded(filter.search) || filter.level || folded(filter.campus));
}

export function matchesQueueFilter(record: { ownerName: string; values: { achievement: string; fullName: string; level: string; campus: string } }, filter: QueueFilter) {
  const search = folded(filter.search);
  const campus = folded(filter.campus);
  if (filter.level && record.values.level !== filter.level) return false;
  if (campus && !folded(record.values.campus).includes(campus)) return false;
  if (search && ![record.values.achievement, record.values.fullName, record.ownerName].some((value) => folded(value).includes(search))) return false;
  return true;
}

export const statusLabels = {
  draft: "Draft", submitted: "Terkirim", reviewing: "Sedang ditinjau",
  revision: "Perlu dilengkapi", published: "Sudah dipost",
} as const;
export type AppreciationStatus = keyof typeof statusLabels;
