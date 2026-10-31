import { describe, expect, it } from "vitest";
import { dayLabel, rangeLabel, startOfDay, windowState } from "./schedule";

describe("program schedules", () => {
  it("writes Indonesian dates without shifting the calendar day", () => {
    expect(dayLabel("2026-11-02")).toBe("2 November 2026");
    expect(rangeLabel("2027-02-15")).toBe("15 Februari 2027");
    expect(rangeLabel("2027-03-25", "2027-03-27")).toBe("25–27 Maret 2027");
    expect(rangeLabel("2027-02-19", "2027-03-16")).toBe("19 Februari – 16 Maret 2027");
    expect(rangeLabel("2026-11-02", "2027-02-08")).toBe("2 November 2026 – 8 Februari 2027");
  });

  it("starts a day at midnight WIB", () => {
    expect(startOfDay("2026-11-29")).toBe(Date.parse("2026-11-28T17:00:00Z"));
  });

  it("opens a window at midnight WIB on the first day and closes it at the end of the last day", () => {
    const window = { opensAt: "2026-11-02", closesAt: "2026-11-22" };
    const at = (iso: string) => Date.parse(iso);
    expect(windowState(at("2026-11-01T23:59:59+07:00"), window)).toBe("upcoming");
    expect(windowState(at("2026-11-02T00:00:00+07:00"), window)).toBe("open");
    expect(windowState(at("2026-11-22T23:59:59+07:00"), window)).toBe("open");
    expect(windowState(at("2026-11-23T00:00:00+07:00"), window)).toBe("closed");
  });
});
