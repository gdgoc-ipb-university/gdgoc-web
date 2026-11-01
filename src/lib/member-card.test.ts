import { describe, expect, it } from "vitest";
import { chapterPeriod, inChapterPeriod } from "./chapter";
import { cardNumber, cardPath, cardPrefix, cardTokenPattern, divisionAccent, divisionAccents, photoAt } from "./member-card";
import { divisions } from "./onboarding";

/** WCAG contrast of a hex colour against white. */
function contrastWithWhite(hex: string) {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255).map((c) => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return 1.05 / (.2126 * r + .7152 * g + .0722 * b + .05);
}

describe("member card helpers", () => {
  it("numbers cards by chapter year", () => {
    expect(cardPrefix()).toBe("2627");
    expect(cardPrefix({ start: "2027-07-01", end: "2028-07-01" })).toBe("2728");
    expect([cardNumber("2627", 1), cardNumber("2627", 42), cardNumber("2627", 12345)]).toEqual(["2627-0001", "2627-0042", "2627-12345"]);
  });

  it("accepts only 22-character URL-safe tokens", () => {
    expect(cardTokenPattern.test("abcdefghijklmnopqrst_-")).toBe(true);
    for (const token of ["", "short", "abcdefghijklmnopqrst_-x", "abcdefghijklmnopqrst/+", "../../dashboard/anggota"]) expect(cardTokenPattern.test(token), token).toBe(false);
    expect(cardPath("abcdefghijklmnopqrst_-")).toBe("/k/abcdefghijklmnopqrst_-");
  });

  it("asks Google for a sharper photo, and leaves other addresses alone", () => {
    expect(photoAt("https://lh3.googleusercontent.com/a/abc=s96-c", 256)).toBe("https://lh3.googleusercontent.com/a/abc=s256-c");
    expect(photoAt("https://example.com/me.png", 256)).toBe("https://example.com/me.png");
    expect([photoAt(null, 256), photoAt("", 256)]).toEqual([null, null]);
  });

  it("gives each division one role bar colour that white text reads on", () => {
    expect(Object.keys(divisionAccents).sort()).toEqual([...divisions].sort());
    const colours = divisions.map(divisionAccent);
    expect(new Set(colours.filter((colour) => colour !== "#172d43")).size).toBe(4);
    for (const colour of colours) expect(contrastWithWhite(colour), colour).toBeGreaterThanOrEqual(4.5);
    expect(divisionAccent("Technical")).toBe("#1967d2");
    for (const division of ["Secretary Treasurer", null, undefined, "", "Unknown", "constructor"]) expect(divisionAccent(division), String(division)).toBe("#172d43");
  });

  it("holds the chapter year from 00:00 WIB on its first day to the end of its last day", () => {
    expect(chapterPeriod.year).toBe("2026/27");
    expect(inChapterPeriod(Date.parse("2026-06-30T23:59:59+07:00"))).toBe(false);
    expect(inChapterPeriod(Date.parse("2026-07-01T00:00:00+07:00"))).toBe(true);
    expect(inChapterPeriod(Date.parse("2027-07-01T23:59:59+07:00"))).toBe(true);
    expect(inChapterPeriod(Date.parse("2027-07-02T00:00:00+07:00"))).toBe(false);
  });
});
