import { act, cleanup, render, waitFor } from "@testing-library/react";
import { motionValue } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScrollProgress } from "./scroll-progress";

const progress = motionValue(0);
vi.mock("motion/react", async (importOriginal) => ({
  ...await importOriginal<typeof import("motion/react")>(),
  useScroll: () => ({ scrollYProgress: progress }),
}));

afterEach(() => { cleanup(); progress.set(0); });

function scales(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(".scroll-progress-fill"), (fill) => {
    const transform = fill.style.transform;
    return transform === "none" ? 1 : Number(transform.match(/scaleX\(([^)]+)\)/)?.[1]);
  });
}

async function scrollTo(value: number, container: HTMLElement, expected: number[]) {
  act(() => progress.set(value));
  await waitFor(() => {
    scales(container).forEach((scale, index) => expect(scale).toBeCloseTo(expected[index], 5));
  });
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
});
