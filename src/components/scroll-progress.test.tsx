import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ScrollProgress } from "./scroll-progress";

// A 900 px window on a 3600 px page scrolls through 2700 px.
const range = 2700;

beforeEach(() => {
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: range + 900 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});
afterEach(cleanup);

function scales(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(".scroll-progress-fill"), (fill) =>
    Number(fill.style.transform.match(/scaleX\(([^)]+)\)/)?.[1]));
}

async function scrollTo(value: number, container: HTMLElement, expected: number[]) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: value * range });
  fireEvent.scroll(window);
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); });
  scales(container).forEach((scale, index) => expect(scale).toBeCloseTo(expected[index], 5));
}

describe("four-quarter scroll progress", () => {
  it("fills blue, red, yellow, then green at the 25 percent boundaries", async () => {
    const { container } = render(<ScrollProgress />);
    expect(Array.from(container.querySelectorAll("[data-color]"), (block) => block.getAttribute("data-color")))
      .toEqual(["blue", "red", "yellow", "green"]);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    await scrollTo(0, container, [0, 0, 0, 0]);
    await scrollTo(0.125, container, [0.5, 0, 0, 0]);
    await scrollTo(0.25, container, [1, 0, 0, 0]);
    await scrollTo(0.375, container, [1, 0.5, 0, 0]);
    await scrollTo(0.5, container, [1, 1, 0, 0]);
    await scrollTo(0.625, container, [1, 1, 0.5, 0]);
    await scrollTo(0.75, container, [1, 1, 1, 0]);
    await scrollTo(0.875, container, [1, 1, 1, 0.5]);
    await scrollTo(1, container, [1, 1, 1, 1]);
  });

  it("reverses each quarter when scrolling up and clamps overscroll", async () => {
    const { container } = render(<ScrollProgress />);
    await scrollTo(1.1, container, [1, 1, 1, 1]);
    await scrollTo(0.6, container, [1, 1, 0.4, 0]);
    await scrollTo(0.2, container, [0.8, 0, 0, 0]);
    await scrollTo(-0.1, container, [0, 0, 0, 0]);
  });

  it("starts from the current position on a page that was already scrolled, and stays empty on one that cannot scroll", () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: range / 2 });
    expect(scales(render(<ScrollProgress />).container)).toEqual([1, 1, 0, 0]);
    cleanup();
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 900 });
    expect(scales(render(<ScrollProgress />).container)).toEqual([0, 0, 0, 0]);
  });
});
