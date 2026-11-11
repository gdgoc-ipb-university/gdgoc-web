import { leagueHome } from "./league";
import { windowState } from "./schedule";
import { organizationId, siteUrl } from "./site";

/**
 * Tech League 2026/27, shown at the league's own host (`leagueUrl`, #179), or at /program/tech-league where the league
 * has no host yet. Links to the competition use `href`; `path` is the old page, which then redirects to the league root.
 * The categories match the landing; the dates are Program & Development's timeline of 11 November 2026, which moved
 * everything before Ramadan (#222) and replaced the 4 November one (#166). The registration form and guidebook links
 * stay null until Program & Development publishes them: set them here and the page switches on its own.
 *
 * The schedule comes at two levels of detail, as Program & Development asked:
 * - `timeline` is the full schedule on the league page. Each item is `{ phase, label, start, end?, note? }`: `phase`
 *   groups the items on the page, `note` adds a line under the label, and items are in date order within a phase. The
 *   sheet's internal marketing row is left out, and its two February dates for the favourite vote and the final
 *   preparation were typos for January, as Program & Development confirmed.
 * - `milestones` is the landing's five steps, `{ label, start, end? }`. Its registration step ends with regular
 *   registration on 4 January, as Program & Development wrote it, while `registration` runs to the end of the
 *   extension on 6 January.
 */
export const techLeague = {
  path: "/program/tech-league",
  /** Where links to Tech League go: the league root, or the old page where the league has no host. */
  href: leagueHome ?? "/program/tech-league",
  /** The competition's canonical, absolute URL. */
  url: leagueHome ?? `${siteUrl}/program/tech-league`,
  description:
    "Tech League GDGoC IPB: kompetisi nasional untuk Software Development, UI/UX Design, dan Business Plan. Pendaftaran tim dibuka 7 Desember 2026.",
  categories: ["Software Development", "UI/UX Design", "Business Plan"],
  // Early and regular registration plus the two-day extension.
  registration: { opensAt: "2026-12-07", closesAt: "2027-01-06" },
  timeline: [
    { phase: "Registrasi", label: "Registrasi gelombang awal", start: "2026-12-07", end: "2026-12-09" },
    { phase: "Registrasi", label: "Registrasi reguler", start: "2026-12-10", end: "2027-01-04" },
    { phase: "Registrasi", label: "Perpanjangan registrasi", start: "2027-01-05", end: "2027-01-06" },
    { phase: "Karya", label: "Pengerjaan karya", start: "2026-12-07", end: "2027-01-06" },
    { phase: "Karya", label: "Batas pengumpulan karya dan poster", start: "2027-01-06" },
    { phase: "Seleksi", label: "Seleksi preliminary", start: "2027-01-07", end: "2027-01-12", note: "Tiga cabang dinilai bersamaan." },
    { phase: "Seleksi", label: "Pengumuman finalis", start: "2027-01-13", note: "Lima finalis tiap cabang." },
    { phase: "Seleksi", label: "Voting juara favorit", start: "2027-01-13", end: "2027-01-20", note: "Lewat poster lima finalis tiap cabang." },
    { phase: "Final", label: "Technical Meeting finalis", start: "2027-01-14" },
    { phase: "Final", label: "Persiapan presentasi final", start: "2027-01-14", end: "2027-01-16" },
    { phase: "Final", label: "Batas pitch deck", start: "2027-01-16" },
    { phase: "Final", label: "Final daring", start: "2027-01-17", note: "Minggu, tiga cabang bersamaan." },
    { phase: "Final", label: "Pengumuman hasil akhir", start: "2027-01-20" },
    { phase: "Final", label: "Awarding luring", start: "2027-01-30", note: "Sabtu. Tempat diumumkan kemudian." },
  ],
  milestones: [
    { label: "Registrasi", start: "2026-12-07", end: "2027-01-04" },
    { label: "Pengumpulan karya", start: "2027-01-06" },
    { label: "Seleksi karya", start: "2027-01-07", end: "2027-01-12" },
    { label: "Final (daring)", start: "2027-01-17" },
    { label: "Awarding (luring)", start: "2027-01-30" },
  ],
  registrationUrl: null as string | null,
  guidebookUrl: null as string | null,
} as const;

/** The registration state right now; the page is revalidated hourly, so this is at most an hour stale. */
export function currentRegistrationState() {
  return registrationState(Date.now());
}

/** Registration opens at 00:00 WIB on the first day and closes at the end of the last day, WIB. */
export function registrationState(now: number) {
  return windowState(now, techLeague.registration);
}

/** The competition as one `Event`, from registration opening to the awarding, the last timeline item. */
export function techLeagueJsonLd() {
  const url = techLeague.url;
  const last = techLeague.timeline[techLeague.timeline.length - 1];
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${url}#event`,
    name: "Tech League GDGoC IPB 2026/27",
    description: techLeague.description,
    url,
    image: `${siteUrl}/brand/og-image.jpg`,
    inLanguage: "id",
    startDate: techLeague.registration.opensAt,
    endDate: "end" in last ? last.end : last.start,
    eventStatus: "https://schema.org/EventScheduled",
    // Online until the awarding venue is confirmed. Then switch to MixedEventAttendanceMode and add a `Place` with the
    // venue's address next to the VirtualLocation.
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: { "@type": "VirtualLocation", url },
    organizer: { "@type": "Organization", "@id": organizationId, name: "GDGoC IPB University", url: `${siteUrl}/` },
  };
}
