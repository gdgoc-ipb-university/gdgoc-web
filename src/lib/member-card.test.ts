import { describe, expect, it } from "vitest";
import { chapterPeriod, inChapterPeriod } from "./chapter";
import { cardNumber, cardPath, cardPrefix, cardTokenPattern, cr80, divisionAccent, divisionAccents, nameArea, nameFit, photoAt } from "./member-card";
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

  it("wraps the name within the 440 px clear area between the landmarks, centred in the column", () => {
    expect(nameArea).toEqual({ width: 440, column: 568, size: 54, min: 40, floor: 30 });
    // 99 to 539 px across the 638 px trim: right of Tugu Kujang (its spire ends near 76 px) and left of the AHN roof.
    expect([(cr80.width - nameArea.width) / 2, (cr80.width + nameArea.width) / 2]).toEqual([99, 539]);
    expect(nameFit("Rania Putri")).toEqual({ px: 54, width: 440, lines: ["Rania Putri"] });
    // 13 characters at 54 px: .61 em × 54 × 13 = 428 px, inside 440.
    expect(nameFit("Fajar Nugroho")).toEqual({ px: 54, width: 440, lines: ["Fajar Nugroho"] });
    // 17 characters were one 560 px line across the Kujang; now two lines, as Figma wraps, the first taking what fits.
    expect(nameFit("Dewi Kartika Sari")).toEqual({ px: 54, width: 440, lines: ["Dewi Kartika", "Sari"] });
    expect(nameFit("  Rania  Putri Maharani ")).toEqual({ px: 54, width: 440, lines: ["Rania Putri", "Maharani"] });
    expect(nameFit("Adela Belinda Vista")).toEqual({ px: 54, width: 440, lines: ["Adela Belinda", "Vista"] });
  });

  it("steps the size down a pixel at a time when two lines are not enough, never below 40 px", () => {
    // "Ramadhan Saputra" is 16 characters: 16 × .61 × 45 = 439 px.
    expect(nameFit("Muhammad Rizky Ramadhan Saputra")).toEqual({ px: 45, width: 440, lines: ["Muhammad Rizky", "Ramadhan Saputra"] });
    expect(nameFit("Ramadhanisaputra")).toEqual({ px: 45, width: 440, lines: ["Ramadhanisaputra"] });
    for (const name of ["Dewi Kartika Sari", "Muhammad Rizky Ramadhan Saputra", "Nur Aisyah Kusumawardhani", "Anak Agung Gede Ngurah Putra", "Bambang Pamungkas"]) {
      const fit = nameFit(name);
      expect(fit.lines.length, name).toBeLessThanOrEqual(2);
      expect(fit.px, name).toBeGreaterThanOrEqual(40);
      expect(fit.width, name).toBe(440);
      for (const line of fit.lines) expect(line.length * .61 * fit.px, line).toBeLessThanOrEqual(440);
      expect(fit.lines.join(" "), name).toBe(name);
    }
  });

  it("takes the whole column at 40 px for a name too long for the clear area, and goes smaller only past two full lines", () => {
    // A 21-character word cannot fit 18 characters at 40 px: the 568 px column holds 23.
    expect(nameFit("Bambang Pamungkasnugrahaputra")).toEqual({ px: 40, width: 568, lines: ["Bambang", "Pamungkasnugrahaputra"] });
    // At 40 px a clear-area line holds 18 characters, too few for "Kusumawardhani Putri".
    expect(nameFit("Nur Aisyah Kusumawardhani Putri")).toEqual({ px: 40, width: 568, lines: ["Nur Aisyah", "Kusumawardhani Putri"] });
    // A word longer than a full line breaks anywhere, staying in the clear area when two of its lines fit there.
    expect(nameFit("Wolfeschlegelsteinhausenbergerdorff")).toEqual({ px: 40, width: 440, lines: ["Wolfeschlegelstein", "hausenbergerdorff"] });
    // 55 letters fit neither: two 28-letter lines of the column at 33 px.
    expect(nameFit("Wolfeschlegelsteinhausenbergerdorffwelchevoralternwaren")).toEqual({ px: 33, width: 568, lines: ["Wolfeschlegelsteinhausenberg", "erdorffwelchevoralternwaren"] });
    // 55 characters: past two 23-character lines at 40 px, so 32 px across the column.
    expect(nameFit("Raden Mas Muhammad Rizky Ramadhan Saputra Wijayakusuma")).toEqual({ px: 32, width: 568, lines: ["Raden Mas Muhammad Rizky", "Ramadhan Saputra Wijayakusuma"] });
    const longest = nameFit("A".repeat(80));
    expect([longest.px, longest.width, longest.lines.length]).toEqual([30, 568, 3]);
  });

  it("holds the chapter year from 00:00 WIB on its first day to the end of its last day", () => {
    expect(chapterPeriod.year).toBe("2026/27");
    expect(inChapterPeriod(Date.parse("2026-06-30T23:59:59+07:00"))).toBe(false);
    expect(inChapterPeriod(Date.parse("2026-07-01T00:00:00+07:00"))).toBe(true);
    expect(inChapterPeriod(Date.parse("2027-07-01T23:59:59+07:00"))).toBe(true);
    expect(inChapterPeriod(Date.parse("2027-07-02T00:00:00+07:00"))).toBe(false);
  });
});
