import { describe, expect, it } from "vitest";
import { indexablePaths, siteUrl } from "./site";
import { registrationState, techLeague, techLeagueJsonLd } from "./tech-league";

describe("Tech League schedule", () => {
  it("opens registration at midnight WIB on the first day and closes it at the end of the last day", () => {
    const at = (iso: string) => Date.parse(iso);
    expect(registrationState(at("2026-11-01T23:59:59+07:00"))).toBe("upcoming");
    expect(registrationState(at("2026-11-02T00:00:00+07:00"))).toBe("open");
    expect(registrationState(at("2027-02-08T23:59:59+07:00"))).toBe("open");
    expect(registrationState(at("2027-02-09T00:00:00+07:00"))).toBe("closed");
  });

  it("keeps the timeline in order, inside the registration window where it should be", () => {
    const starts = techLeague.timeline.map((step) => step.start);
    expect([...starts].sort()).toEqual(starts);
    expect(techLeague.timeline[0]).toMatchObject({ start: techLeague.registration.opensAt, end: techLeague.registration.closesAt });
  });

  it("describes the competition as one online event, from registration to the last day of the final", () => {
    const event = techLeagueJsonLd();
    expect(event).toMatchObject({ "@type": "Event", startDate: "2026-11-02", endDate: "2027-03-27", url: `${siteUrl}/program/tech-league`, eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode" });
    expect(event.location.url).toBe(event.url);
    expect(event.organizer["@id"]).toBe(`${siteUrl}/#organization`);
    expect(indexablePaths).toContain(techLeague.path);
  });
});
