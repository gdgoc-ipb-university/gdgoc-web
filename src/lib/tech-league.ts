/**
 * Tech League 2026/27, shown at /tech-league. The categories match the landing; the dates follow the program
 * blueprint recorded in issue #33. Registration, payment and submissions run on Program & Development's forms,
 * so the links stay null until they are published: set them here and the page switches on its own.
 */
export const techLeague = {
  categories: ["Software Development", "UI/UX Design", "Business Plan"],
  registration: { opensAt: "2026-11-02", closesAt: "2027-02-08" },
  timeline: [
    { label: "Pendaftaran tim", start: "2026-11-02", end: "2027-02-08" },
    { label: "Batas pengumpulan karya", start: "2027-02-15" },
    { label: "Penilaian juri", start: "2027-02-19", end: "2027-03-16" },
    { label: "Final", start: "2027-03-25", end: "2027-03-27" },
  ],
  registrationUrl: null as string | null,
  guidebookUrl: null as string | null,
} as const;

const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "2 November 2026" for a YYYY-MM-DD date, read as a calendar day (no time zone shift). */
export function dayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${months[month - 1]} ${year}`;
}

/** "19 Februari – 16 Maret 2027", dropping the repeated year (and month) when both ends share it. */
export function rangeLabel(start: string, end?: string) {
  if (!end || end === start) return dayLabel(start);
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  if (startYear !== endYear) return `${dayLabel(start)} – ${dayLabel(end)}`;
  if (startMonth !== endMonth) return `${startDay} ${months[startMonth - 1]} – ${dayLabel(end)}`;
  return `${startDay}–${dayLabel(end)}`;
}

/** The registration state right now; the page is revalidated hourly, so this is at most an hour stale. */
export function currentRegistrationState() {
  return registrationState(Date.now());
}

/** Registration opens at 00:00 WIB on the first day and closes at the end of the last day, WIB. */
export function registrationState(now: number, registration: { opensAt: string; closesAt: string } = techLeague.registration) {
  if (now < Date.parse(`${registration.opensAt}T00:00:00+07:00`)) return "upcoming" as const;
  if (now <= Date.parse(`${registration.closesAt}T23:59:59+07:00`)) return "open" as const;
  return "closed" as const;
}
