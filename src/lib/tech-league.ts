import { leagueHome } from "./league";
import { windowState } from "./schedule";
import { organizationId, siteUrl } from "./site";

/**
 * Tech League 2026/27, shown at the league's own host (`leagueUrl`, #179), or at /program/tech-league where the league
 * has no host yet. Links to the competition use `href`; `path` is the old page, which then redirects to the league root.
 * The categories match the landing; the dates are the main version of Program & Development's timeline of 4 November
 * 2026 (awarding 13 February 2027), chosen for the site on 5 November (#166). The registration form and guidebook links
 * stay null until Program & Development publishes them: set them here and the page switches on its own.
 *
 * Each timeline item is `{ label, start, end? }`. `phase` groups the items on the page, `note` adds a line under the
 * label, and items are in date order within a phase.
 */
export const techLeague = {
  path: "/program/tech-league",
  /** Where links to Tech League go: the league root, or the old page where the league has no host. */
  href: leagueHome ?? "/program/tech-league",
  /** The competition's canonical, absolute URL. */
  url: leagueHome ?? `${siteUrl}/program/tech-league`,
  description:
    "Tech League GDGoC IPB: kompetisi nasional untuk Software Development, UI/UX Design, dan Business Plan. Pendaftaran tim dibuka 1 Desember 2026.",
  categories: ["Software Development", "UI/UX Design", "Business Plan"],
  // Early and regular registration plus the two-day extension.
  registration: { opensAt: "2026-12-01", closesAt: "2027-01-14" },
  timeline: [
    { phase: "Registrasi", label: "Registrasi gelombang awal", start: "2026-12-01", end: "2026-12-07" },
    { phase: "Registrasi", label: "Registrasi reguler", start: "2026-12-08", end: "2027-01-12" },
    { phase: "Registrasi", label: "Perpanjangan registrasi", start: "2027-01-13", end: "2027-01-14" },
    { phase: "Karya", label: "Pengerjaan karya", start: "2026-12-01", end: "2027-01-14" },
    { phase: "Karya", label: "Technical Meeting pertama", start: "2027-01-07" },
    { phase: "Karya", label: "Batas pengumpulan karya", start: "2027-01-14" },
    { phase: "Seleksi", label: "Seleksi preliminary", start: "2027-01-15", end: "2027-01-21" },
    { phase: "Seleksi", label: "Pengumuman finalis", start: "2027-01-22" },
    { phase: "Seleksi", label: "Konfirmasi finalis", start: "2027-01-22", end: "2027-01-23" },
    { phase: "Final", label: "Persiapan presentasi final", start: "2027-01-23", end: "2027-02-05" },
    { phase: "Final", label: "Technical Meeting kedua", start: "2027-01-24" },
    { phase: "Final", label: "Batas pitch deck", start: "2027-02-05" },
    { phase: "Final", label: "Final daring", start: "2027-02-06", end: "2027-02-08", note: "Satu kategori per hari. Urutannya diumumkan kemudian." },
    { phase: "Final", label: "Awarding luring", start: "2027-02-13", note: "Tempat diumumkan kemudian." },
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
