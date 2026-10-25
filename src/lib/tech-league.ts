import { windowState } from "./schedule";
import { organizationId, siteUrl } from "./site";

/**
 * Tech League 2026/27, shown at /program/tech-league. The categories match the landing; the dates follow the program
 * blueprint recorded in issue #33. Registration, payment and submissions run on Program & Development's forms,
 * so the links stay null until they are published: set them here and the page switches on its own.
 */
export const techLeague = {
  path: "/program/tech-league",
  description:
    "Tech League GDGoC IPB: kompetisi nasional untuk Software Development, UI/UX Design, dan Business Plan. Pendaftaran tim dibuka 2 November 2026.",
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

/** The registration state right now; the page is revalidated hourly, so this is at most an hour stale. */
export function currentRegistrationState() {
  return registrationState(Date.now());
}

/** Registration opens at 00:00 WIB on the first day and closes at the end of the last day, WIB. */
export function registrationState(now: number) {
  return windowState(now, techLeague.registration);
}

/** The competition as one online `Event`, from registration opening to the last day of the final. */
export function techLeagueJsonLd() {
  const url = `${siteUrl}${techLeague.path}`;
  const final = techLeague.timeline[techLeague.timeline.length - 1];
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
    endDate: "end" in final ? final.end : final.start,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: { "@type": "VirtualLocation", url },
    organizer: { "@type": "Organization", "@id": organizationId, name: "GDGoC IPB University", url: `${siteUrl}/` },
  };
}
