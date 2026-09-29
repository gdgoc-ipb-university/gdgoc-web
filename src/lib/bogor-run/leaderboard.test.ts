import { describe, expect, it } from "vitest";
import { isWeekKey, packInputs, shortName, unpackInputs, weekKey, weekLabel, weekStart } from "./leaderboard";

const wib = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m - 1, d, h - 7, min);

describe("leaderboard weeks", () => {
  it("starts each week on Monday 00:00 WIB regardless of the runtime time zone", () => {
    expect(weekKey(wib(2026, 9, 28))).toBe("2026-09-28");
    expect(weekKey(wib(2026, 9, 28) - 1)).toBe("2026-09-21");
    expect(weekKey(wib(2026, 10, 4, 23, 59))).toBe("2026-09-28");
    expect(weekKey(Date.UTC(2026, 8, 27, 18))).toBe("2026-09-28"); // Sunday in UTC, already Monday in Bogor.
    expect(weekKey(wib(2027, 1, 1, 12))).toBe("2026-12-28");
    expect(weekKey(Date.UTC(1969, 11, 20))).toBe("1969-12-15");
    expect(weekStart("2026-09-28")).toBe(wib(2026, 9, 28));
  });

  it("accepts only real Monday keys", () => {
    expect(isWeekKey("2026-09-28")).toBe(true);
    for (const value of ["2026-09-29", "2026-02-30", "2026-9-28", "2026-09-28T00:00", "", " 2026-09-28", 20260928, null]) expect(isWeekKey(value)).toBe(false);
    expect(weekStart("2026-09-29")).toBeNaN();
  });

  it("labels weeks in Indonesian", () => {
    expect(weekLabel("2026-09-28")).toBe("28 Sep – 4 Okt");
    expect(weekLabel("2026-10-05")).toBe("5–11 Okt");
    expect(weekLabel("2026-12-28")).toBe("28 Des – 3 Jan");
    expect(weekLabel("2026-08-03")).toBe("3–9 Agu");
    expect(weekLabel("bukan-minggu")).toBe("bukan-minggu");
  });
});

describe("public short names", () => {
  it("shows a first name and last initial only", () => {
    expect(shortName("Aldio Lisafron")).toBe("Aldio L.");
    expect(shortName("  Rania\t Putri   ayu ")).toBe("Rania A.");
    expect(shortName("Budi")).toBe("Budi");
    expect(shortName("")).toBe("Pemain");
    expect(shortName(" ​ ")).toBe("Pemain");
  });

  it("skips a leading initial and drops invisible characters", () => {
    expect(shortName("M. Rizky Pratama")).toBe("Rizky P.");
    expect(shortName("M Rizky")).toBe("Rizky");
    expect(shortName("A. B.")).toBe("A. B.");
    expect(shortName("Ald​io Lisa\u0000fron")).toBe("Aldio L.");
    expect(shortName("Siti (Nurhaliza)")).toBe("Siti N.");
  });

  it("caps names at 24 characters", () => {
    expect(shortName("Wolfeschlegelsteinhausenbergerdorff Smith")).toBe("Wolfeschlegelsteinhau S.");
    expect(shortName("Wolfeschlegelsteinhausenbergerdorff")).toHaveLength(24);
    expect(Array.from(shortName("😀".repeat(30)))).toHaveLength(24);
  });
});

describe("packed input logs", () => {
  it("round-trips a flat [tick, code] log", () => {
    const inputs = [0, 1, 0, 2, 5, 3, 120, 1, 431_999, 2];
    expect(packInputs(inputs)).toBe("01,02,53,371,998n2");
    expect(unpackInputs(packInputs(inputs), 20_000)).toEqual(inputs);
    expect(unpackInputs("", 20_000)).toEqual([]);
  });

  it("rejects malformed or oversized logs", () => {
    for (const packed of ["x", "11,", ",11", "-11", "14", "1.51", "0A1", "123451", "1 1"]) expect(unpackInputs(packed, 20_000)).toBeNull();
    expect(unpackInputs(Array(11).fill("01").join(","), 20)).toBeNull();
    expect(unpackInputs(Array(10).fill("01").join(","), 20)).toHaveLength(20);
  });
});
