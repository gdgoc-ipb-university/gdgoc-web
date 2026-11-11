import { describe, expect, it } from "vitest";
import { flagMatches, flagPointsFor, flagPreview, floorPlace, nextTryAt, parseFlagPoints, triesAvailable, validateFlag } from "./flag-task";

const value = { maxPoints: 100, minPoints: 20, decrement: 10 };

describe("flag task points", () => {
  it("gives the n-th solver max(min, max − decrement × (n − 1))", () => {
    expect([1, 2, 5, 8, 9, 10, 500].map((place) => flagPointsFor(value, place))).toEqual([100, 90, 60, 30, 20, 20, 20]);
    expect(flagPointsFor({ maxPoints: 100, minPoints: 0, decrement: 30 }, 5)).toBe(0);
    expect(flagPointsFor({ maxPoints: 50, minPoints: 10, decrement: 0 }, 99)).toBe(50);
  });

  it("finds the first solver at the floor and previews the drop", () => {
    expect(floorPlace(value)).toBe(9);
    expect(floorPlace({ maxPoints: 100, minPoints: 20, decrement: 30 })).toBe(4);
    expect(floorPlace({ maxPoints: 20, minPoints: 20, decrement: 5 })).toBeNull();
    expect(flagPreview(value)).toBe("Solver ke-1: 100, ke-2: 90, ke-5: 60, minimum 20 mulai solver ke-9.");
    expect(flagPreview({ maxPoints: 100, minPoints: 20, decrement: 50 })).toBe("Solver ke-1: 100, ke-2: 50, minimum 20 mulai solver ke-3.");
    expect(flagPreview({ maxPoints: 100, minPoints: 20, decrement: 80 })).toBe("Solver ke-1: 100, minimum 20 mulai solver ke-2.");
    expect(flagPreview({ maxPoints: 1500, minPoints: 0, decrement: 0 })).toBe("Setiap solver mendapat 1.500 poin.");
  });

  it("accepts whole numbers with max ≥ min ≥ 0 and a one-line flag", () => {
    const ok = { flag: " GDGOC{x} ", maxPoints: " 100", minPoints: "0", decrement: "0" };
    expect(validateFlag(ok)).toEqual({});
    expect(parseFlagPoints(ok)).toEqual({ maxPoints: 100, minPoints: 0, decrement: 0 });
    expect(validateFlag({ flag: "", maxPoints: "1.5", minPoints: "-1", decrement: "x" })).toEqual({
      flag: "Isi flag yang harus ditemukan member.", maxPoints: "Isi bilangan bulat 0 sampai 10.000.", minPoints: "Isi bilangan bulat 0 sampai 10.000.", decrement: "Isi bilangan bulat 0 sampai 10.000.",
    });
    expect(validateFlag({ ...ok, minPoints: "101" }).minPoints).toBe("Poin minimal tidak boleh melebihi poin maksimal.");
    expect(validateFlag({ ...ok, maxPoints: "10001" }).maxPoints).toBeDefined();
    expect(validateFlag({ ...ok, flag: "GDGOC{a\nb}" }).flag).toBe("Flag harus satu baris.");
    expect(validateFlag({ ...ok, flag: "x".repeat(201) }).flag).toBe("Maksimal 200 karakter.");
  });

  it("trims the ends, then matches exactly and case-sensitively", () => {
    expect(flagMatches("  GDGOC{x}\t", "GDGOC{x}")).toBe(true);
    expect(flagMatches("gdgoc{x}", "GDGOC{x}")).toBe(false);
    expect(flagMatches("GDGOC{ x}", "GDGOC{x}")).toBe(false);
  });
});

describe("wrong flag bucket", () => {
  it("starts full, refills one try a minute up to five, and says when the next try opens", () => {
    expect(triesAvailable(null, 0)).toBe(5);
    expect(triesAvailable({ tokens: 0, tokensAt: 1000 }, 31000)).toBe(0.5);
    expect(triesAvailable({ tokens: 0, tokensAt: 0 }, 10 * 60000)).toBe(5);
    expect(nextTryAt(0.5, 31000)).toBe(61000);
  });
});
