import { describe, expect, it } from "vitest";
import { dayLabel, rangeLabel, registrationState, techLeague } from "./tech-league";

describe("Tech League schedule", () => {
  it("writes Indonesian dates without shifting the calendar day", () => {
    expect(dayLabel("2026-11-02")).toBe("2 November 2026");
    expect(rangeLabel("2027-02-15")).toBe("15 Februari 2027");
    expect(rangeLabel("2027-03-25", "2027-03-27")).toBe("25–27 Maret 2027");
    expect(rangeLabel("2027-02-19", "2027-03-16")).toBe("19 Februari – 16 Maret 2027");
    expect(rangeLabel("2026-11-02", "2027-02-08")).toBe("2 November 2026 – 8 Februari 2027");
  });

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
});
