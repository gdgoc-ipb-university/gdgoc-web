import { describe, expect, it } from "vitest";
import { indexablePaths, siteUrl } from "./site";
import { registrationState, techLeague, techLeagueJsonLd } from "./tech-league";

describe("Tech League schedule", () => {
  it("opens registration at midnight WIB on 1 December and closes it at the end of 14 January, WIB", () => {
    const at = (iso: string) => Date.parse(iso);
    expect(registrationState(at("2026-11-05T12:00:00+07:00"))).toBe("upcoming");
    expect(registrationState(at("2026-11-30T23:59:59+07:00"))).toBe("upcoming");
    expect(registrationState(at("2026-11-30T17:00:00Z"))).toBe("open");
    expect(registrationState(at("2027-01-14T23:59:59+07:00"))).toBe("open");
    expect(registrationState(at("2027-01-14T17:00:00Z"))).toBe("closed");
  });

  it("runs registration from the early wave to the end of the extension", () => {
    const registration = techLeague.timeline.filter((step) => step.phase === "Registrasi");
    expect(registration[0].start).toBe(techLeague.registration.opensAt);
    expect(registration.at(-1)).toMatchObject({ label: "Perpanjangan registrasi", end: techLeague.registration.closesAt });
    expect(techLeague.description).toContain("dibuka 1 Desember 2026");
  });

  it("keeps each phase together and in date order, ending with the awarding", () => {
    const phases = techLeague.timeline.map((step) => step.phase);
    expect(phases.filter((phase, i) => phase !== phases[i - 1])).toEqual(["Registrasi", "Karya", "Seleksi", "Final"]);
    for (const phase of new Set(phases)) {
      const starts = techLeague.timeline.filter((step) => step.phase === phase).map((step) => step.start);
      expect([...starts].sort()).toEqual(starts);
    }
    expect(techLeague.timeline.at(-1)).toMatchObject({ label: "Awarding luring", start: "2027-02-13" });
  });

  it("describes the competition as one online event, from registration to the awarding", () => {
    const event = techLeagueJsonLd();
    expect(event).toMatchObject({ "@type": "Event", startDate: "2026-12-01", endDate: "2027-02-13", url: `${siteUrl}/program/tech-league`, eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode" });
    expect(event.location).toEqual({ "@type": "VirtualLocation", url: event.url });
    expect(event.organizer["@id"]).toBe(`${siteUrl}/#organization`);
    expect(indexablePaths).toContain(techLeague.path);
  });
});
