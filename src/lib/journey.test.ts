import { describe, expect, it } from "vitest";
import { nextActiveStep, storyQuery } from "./journey";

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
