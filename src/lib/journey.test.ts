import { describe, expect, it } from "vitest";
import { catalyst } from "./catalyst";
import { milestoneExtent, milestoneStatus, nextActiveStep, spanPosition, storyQuery, timelineSpan, wibDate } from "./journey";
import { techLeague } from "./tech-league";

describe("mission step activation", () => {
  it("activates the step crossing the middle of the screen", () => {
    expect(nextActiveStep([false, true, false], 0)).toBe(1);
    expect(nextActiveStep([false, false, true], 1)).toBe(2);
    expect(nextActiveStep([true, false, false], 2)).toBe(0);
  });

  it("keeps the current step while it is still in the band, so two steps crossing together never flicker", () => {
    expect(nextActiveStep([true, true, false], 0)).toBe(0);
    expect(nextActiveStep([false, true, true], 2)).toBe(2);
  });

  it("picks the step nearest the current one when it has left the band and several are in it", () => {
    expect(nextActiveStep([true, false, true, false], 3)).toBe(2);
    expect(nextActiveStep([true, false, false, true], 1)).toBe(0);
  });

  it("keeps the last scene between steps and past either end", () => {
    expect(nextActiveStep([false, false, false], 2)).toBe(2);
    expect(nextActiveStep([false, false, false], 0)).toBe(0);
  });

  it("reports no step when asked not to keep one", () => {
    expect(nextActiveStep([false, false, false], 1, false)).toBe(-1);
    expect(nextActiveStep([false, true, false], -1, false)).toBe(1);
  });

  it("only uses the sticky panel on a wide screen without reduced motion", () => {
    expect(storyQuery).toContain("min-width: 961px");
    expect(storyQuery).toContain("prefers-reduced-motion: no-preference");
  });
});

describe("timeline status in WIB", () => {
  const oprec = { label: "Pendaftaran (oprec)", start: "2026-11-02", end: "2026-11-22" };
  const announcement = { label: "Pengumuman peserta", start: "2026-11-29" };
  const at = (wib: string) => Date.parse(`${wib}+07:00`);

  it("is upcoming until 00:00 WIB on the first day, even when it is already that day in UTC+8", () => {
    expect(milestoneStatus(at("2026-11-01T23:59:59"), oprec)).toBe("upcoming");
    expect(milestoneStatus(Date.parse("2026-11-01T23:30:00+08:00"), oprec)).toBe("upcoming");
    expect(milestoneStatus(at("2026-11-02T00:00:00"), oprec)).toBe("current");
  });

  it("is current through the end of its last day in WIB, then done", () => {
    expect(milestoneStatus(at("2026-11-22T23:59:59"), oprec)).toBe("current");
    expect(milestoneStatus(at("2026-11-23T00:00:00"), oprec)).toBe("done");
    // 22:00 UTC on the 22nd is already 05:00 WIB on the 23rd.
    expect(milestoneStatus(Date.parse("2026-11-22T22:00:00Z"), oprec)).toBe("done");
  });

  it("treats a one-day milestone as current for that whole WIB day", () => {
    expect(milestoneStatus(at("2026-11-28T23:59:59"), announcement)).toBe("upcoming");
    expect(milestoneStatus(at("2026-11-29T12:00:00"), announcement)).toBe("current");
    expect(milestoneStatus(at("2026-11-30T00:00:00"), announcement)).toBe("done");
  });

  it("reads today's date in WIB", () => {
    expect(wibDate(Date.parse("2026-11-04T17:30:00Z"))).toBe("2026-11-05");
    expect(wibDate(Date.parse("2026-11-04T16:59:59Z"))).toBe("2026-11-04");
  });
});

describe("timeline span", () => {
  const span = timelineSpan([...catalyst.timeline, ...techLeague.timeline]);

  it("covers whole months from the first milestone to the last, November 2026 to May 2027", () => {
    expect(span.months.map((month) => `${month.label} ${month.year}`)).toEqual([
      "Nov 2026", "Des 2026", "Jan 2027", "Feb 2027", "Mar 2027", "Apr 2027", "Mei 2027",
    ]);
    expect(span.start).toBe(Date.parse("2026-11-01T00:00:00+07:00"));
    expect(span.end).toBe(Date.parse("2027-06-01T00:00:00+07:00"));
    expect(span.months.reduce((sum, month) => sum + month.share, 0)).toBeCloseTo(1, 10);
    expect(span.months[2].share / span.months[3].share).toBeCloseTo(31 / 28, 10);
  });

  it("places milestones and today to scale", () => {
    expect(spanPosition(span, span.start)).toBe(0);
    expect(spanPosition(span, span.end)).toBe(1);
    const oprec = milestoneExtent(span, catalyst.timeline[0]);
    expect(oprec.left).toBeCloseTo(1 / 212, 10);
    expect(oprec.width).toBeCloseTo(21 / 212, 10);
    expect(milestoneExtent(span, catalyst.timeline[1]).width).toBeCloseTo(1 / 212, 10);
  });
});
