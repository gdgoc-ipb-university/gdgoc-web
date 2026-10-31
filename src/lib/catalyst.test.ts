import { describe, expect, it } from "vitest";
import { catalyst, catalystCourseJsonLd, catalystEventJsonLd, oprecState } from "./catalyst";
import { indexablePaths, siteUrl } from "./site";

describe("Catalyst schedule", () => {
  it("opens oprec at midnight WIB on 2 November, closes it after 22 November, and announces on 29 November", () => {
    const at = (iso: string) => Date.parse(iso);
    expect(oprecState(at("2026-11-01T23:59:59+07:00"))).toBe("upcoming");
    expect(oprecState(at("2026-11-02T00:00:00+07:00"))).toBe("open");
    expect(oprecState(at("2026-11-22T23:59:59+07:00"))).toBe("open");
    expect(oprecState(at("2026-11-23T00:00:00+07:00"))).toBe("closed");
    expect(oprecState(at("2026-11-28T23:59:59+07:00"))).toBe("closed");
    expect(oprecState(at("2026-11-29T00:00:00+07:00"))).toBe("announced");
  });

  it("keeps the timeline in order and in step with the oprec, announcement and session dates", () => {
    const starts = catalyst.timeline.map((step) => step.start);
    expect([...starts].sort()).toEqual(starts);
    expect(catalyst.timeline[0]).toMatchObject({ start: catalyst.oprec.opensAt, end: catalyst.oprec.closesAt });
    expect(catalyst.timeline[1].start).toBe(catalyst.announcedAt);
    expect(catalyst.timeline[2]).toMatchObject({ start: catalyst.sessions.start, end: catalyst.sessions.end });
  });

  it("runs every session on a Sunday", () => {
    for (const day of [catalyst.sessions.start, catalyst.sessions.end]) expect(new Date(`${day}T00:00:00Z`).getUTCDay()).toBe(0);
  });
});

describe("Catalyst structured data", () => {
  it("describes a free online course, provided by the chapter, with nine Sunday sessions", () => {
    const course = catalystCourseJsonLd();
    expect(course).toMatchObject({ "@type": "Course", url: `${siteUrl}/program/catalyst`, isAccessibleForFree: true, offers: { price: 0, category: "Free" } });
    expect(course.provider["@id"]).toBe(`${siteUrl}/#organization`);
    expect(course.hasCourseInstance).toMatchObject({ courseMode: "Online", startDate: "2026-12-06", endDate: "2027-04-18", courseSchedule: { repeatCount: 9 } });
  });

  it("describes the sessions as one online event", () => {
    const event = catalystEventJsonLd();
    expect(event).toMatchObject({ "@type": "Event", startDate: "2026-12-06", endDate: "2027-04-18", eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode" });
    expect(event.location.url).toBe(event.url);
    expect(indexablePaths).toContain(catalyst.path);
  });
});
