import { startOfDay, windowState } from "./schedule";
import { organizationId, siteUrl } from "./site";

/**
 * GDGoC Catalyst 2026/27, shown at /program/catalyst. The dates follow the program plan recorded in issues #32 and #89.
 * Oprec runs on Program & Development's Google Form (#32, decision 1), so `oprecUrl` stays null until it is published:
 * set it here and the page shows "Daftar" while oprec is open (#90).
 */
export const catalyst = {
  path: "/program/catalyst",
  name: "GDGoC Catalyst 2026/27",
  description:
    "GDGoC Catalyst: bootcamp Software Development gratis untuk siswa SMK dan mahasiswa, dengan peran Hacker, Hipster, dan Hustler. Pendaftaran 2–22 November 2026.",
  track: "Software Development",
  roles: [
    { name: "Hacker", focus: "Pengembangan teknologi", text: "Membangun produk tim dari sisi teknologi." },
    { name: "Hipster", focus: "Desain UI/UX", text: "Merancang alur dan tampilan produk tim." },
    { name: "Hustler", focus: "Pengelolaan proyek", text: "Menjaga arah, prioritas, dan jalannya proyek tim." },
  ],
  oprec: { opensAt: "2026-11-02", closesAt: "2026-11-22" },
  announcedAt: "2026-11-29",
  /** Nine online Sunday sessions: five with material, then capstone checkpoints. */
  sessions: { count: 9, start: "2026-12-06", end: "2027-04-18" },
  /** Share of sessions a participant commits to attend. */
  attendance: "70%",
  timeline: [
    { label: "Pendaftaran (oprec)", start: "2026-11-02", end: "2026-11-22" },
    { label: "Pengumuman peserta", start: "2026-11-29" },
    { label: "Sembilan sesi daring setiap hari Minggu", start: "2026-12-06", end: "2027-04-18" },
    { label: "Showcase dan awarding capstone", start: "2027-05-02" },
  ],
  oprecUrl: null as string | null,
} as const;

/** Oprec right now; the page is revalidated hourly, so this is at most an hour stale. */
export function currentOprecState() {
  return oprecState(Date.now());
}

/** Upcoming, open or closed like any sign-up window, then "announced" from 00:00 WIB on the announcement day. */
export function oprecState(now: number) {
  if (now >= startOfDay(catalyst.announcedAt)) return "announced" as const;
  return windowState(now, catalyst.oprec);
}

const organizer = { "@type": "Organization", "@id": organizationId, name: "GDGoC IPB University", url: `${siteUrl}/` };

/** The bootcamp as a free online `Course`, with the 2026/27 sessions as its instance. */
export function catalystCourseJsonLd() {
  const url = `${siteUrl}${catalyst.path}`;
  const { count, start, end } = catalyst.sessions;
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": `${url}#course`,
    name: catalyst.name,
    description: catalyst.description,
    url,
    inLanguage: "id",
    about: catalyst.track,
    provider: organizer,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", category: "Free", price: 0, priceCurrency: "IDR", url },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "Online",
      startDate: start,
      endDate: end,
      location: { "@type": "VirtualLocation", url },
      courseSchedule: { "@type": "Schedule", repeatCount: count, byDay: "https://schema.org/Sunday", startDate: start, endDate: end, scheduleTimezone: "Asia/Jakarta" },
    },
  };
}

/**
 * The sessions as one online `Event`, from the first session to the last. The showcase is left out:
 * its venue is not confirmed.
 */
export function catalystEventJsonLd() {
  const url = `${siteUrl}${catalyst.path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${url}#event`,
    name: catalyst.name,
    description: catalyst.description,
    url,
    image: `${siteUrl}/brand/og-image.jpg`,
    inLanguage: "id",
    startDate: catalyst.sessions.start,
    endDate: catalyst.sessions.end,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    isAccessibleForFree: true,
    location: { "@type": "VirtualLocation", url },
    organizer,
  };
}
