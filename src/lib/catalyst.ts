import { rangeLabel, startOfDay, windowState } from "./schedule";
import { organizationId, siteUrl } from "./site";

/**
 * GDGoC Catalyst 2026/27, shown at /program/catalyst. The dates follow the program plan recorded in issues #32 and #89;
 * they are tentative and on hold (#210), so `scheduleOnHold` keeps them off the site until they are confirmed.
 * Oprec runs on Program & Development's Google Form (#32, decision 1), so `oprecUrl` stays null until it is published:
 * set it here and the page shows "Daftar" while oprec is open (#90).
 */
export const catalyst = {
  path: "/program/catalyst",
  name: "GDGoC Catalyst 2026/27",
  /**
   * True while the 2026/27 dates are tentative (#210): no Catalyst date appears on the site, and the pages say the
   * schedule follows on Instagram and on the Catalyst page. Set it to false to show the dates below again.
   */
  scheduleOnHold: true as boolean,
  /** What /bergabung and /program say instead of dates while the schedule is on hold. */
  scheduleToFollow: "Jadwal 2026/27 menyusul. Pantau Instagram @gdgoc.ipb.",
  /** The program in one sentence, without dates. `catalystDescription` adds the oprec dates unless they are on hold. */
  summary:
    "GDGoC Catalyst: bootcamp Software Development gratis untuk siswa SMK dan mahasiswa, dengan peran Hacker, Hipster, dan Hustler.",
  track: "Software Development",
  /** `key` matches the cohort's role key (`catalystCohort`), so the dashboard shows the same icon as this page. */
  roles: [
    { key: "hacker", name: "Hacker", icon: "code", focus: "Pengembangan teknologi", text: "Membangun produk tim dari sisi teknologi." },
    { key: "hipster", name: "Hipster", icon: "brush", focus: "Desain UI/UX", text: "Merancang alur dan tampilan produk tim." },
    { key: "hustler", name: "Hustler", icon: "clipboard-note", focus: "Pengelolaan proyek", text: "Menjaga arah, prioritas, dan jalannya proyek tim." },
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

/** The description for search and sharing: the summary, plus the oprec dates unless the schedule is on hold. */
export function catalystDescription(onHold = catalyst.scheduleOnHold) {
  const { opensAt, closesAt } = catalyst.oprec;
  return onHold ? catalyst.summary : `${catalyst.summary} Pendaftaran ${rangeLabel(opensAt, closesAt)}.`;
}

const organizer = { "@type": "Organization", "@id": organizationId, name: "GDGoC IPB University", url: `${siteUrl}/` };

/** The bootcamp as a free online `Course`, with the 2026/27 sessions as its instance unless the schedule is on hold. */
export function catalystCourseJsonLd(onHold = catalyst.scheduleOnHold) {
  const url = `${siteUrl}${catalyst.path}`;
  const { count, start, end } = catalyst.sessions;
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": `${url}#course`,
    name: catalyst.name,
    description: catalystDescription(onHold),
    url,
    inLanguage: "id",
    about: catalyst.track,
    provider: organizer,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", category: "Free", price: 0, priceCurrency: "IDR", url },
    // Left out while the schedule is on hold: `JSON.stringify` drops an undefined property.
    hasCourseInstance: onHold ? undefined : {
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
 * The sessions as one online `Event`, from the first session to the last, or null while the schedule is on hold. The
 * showcase is left out: its venue is not confirmed.
 */
export function catalystEventJsonLd(onHold = catalyst.scheduleOnHold) {
  if (onHold) return null;
  const url = `${siteUrl}${catalyst.path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${url}#event`,
    name: catalyst.name,
    description: catalystDescription(onHold),
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
