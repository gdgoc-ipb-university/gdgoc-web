import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { about } from "@/lib/about";
import { activationBand, storyQuery } from "@/lib/journey";
import { Journey } from "./journey";
import { TigaMisi } from "./missions";

type Observed = { callback: IntersectionObserverCallback; options?: IntersectionObserverInit; targets: Element[] };
let observers: Observed[] = [];

function stubBrowser({ wide }: { wide: boolean }) {
  observers = [];
  // jsdom has no Web Animations; `Reveal` only cancels animations with it.
  Element.prototype.getAnimations ??= () => [];
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === storyQuery && wide,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observed: Observed;
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.observed = { callback, options, targets: [] };
        observers.push(this.observed);
      }
      observe(target: Element) { this.observed.targets.push(target); }
      unobserve() {}
      disconnect() {}
    },
  );
}

/** Tells the story's observer which steps are now in the band. */
function cross(observed: Observed, inBand: Record<number, boolean>) {
  const entries = Object.entries(inBand).map(([index, isIntersecting]) => ({ target: observed.targets[Number(index)], isIntersecting }));
  act(() => observed.callback(entries as IntersectionObserverEntry[], {} as IntersectionObserver));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("mission scrollytelling", () => {
  it("lists the three missions in order, each with its own described scene", () => {
    stubBrowser({ wide: true });
    render(<Journey><TigaMisi /></Journey>);
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps.map((step) => within(step).getByRole("heading").textContent)).toEqual(about.missions.map((mission) => mission.name));
    for (const step of steps) expect(within(step).getByRole("img").getAttribute("alt")?.length).toBeGreaterThan(40);
  });

  it("hides the sticky panel from assistive tech, since it repeats the steps", () => {
    stubBrowser({ wide: true });
    const { container } = render(<Journey><TigaMisi /></Journey>);
    const panel = container.querySelector(".story-panel");
    expect(panel?.getAttribute("aria-hidden")).toBe("true");
    for (const image of panel?.querySelectorAll("img") ?? []) expect(image.getAttribute("alt")).toBe("");
  });

  it("on a wide screen, marks the step crossing the middle of the screen active and the one it replaced as prev", () => {
    stubBrowser({ wide: true });
    const { container } = render(<Journey><TigaMisi /></Journey>);
    const story = container.querySelector<HTMLElement>("[data-story]")!;
    expect(observers).toHaveLength(1);
    const [observed] = observers;
    expect(observed.options?.rootMargin).toBe(activationBand);
    expect(observed.targets).toHaveLength(3);
    expect(story.dataset.active).toBe("0");

    cross(observed, { 0: false, 1: true });
    expect(story.dataset).toMatchObject({ active: "1", prev: "0" });
    cross(observed, { 1: true, 2: true });
    expect(story.dataset).toMatchObject({ active: "1", prev: "0" });
    cross(observed, { 1: false });
    expect(story.dataset).toMatchObject({ active: "2", prev: "1" });
    cross(observed, { 2: false });
    expect(story.dataset).toMatchObject({ active: "2", prev: "1" });
  });

  it("on phones and with reduced motion, observes nothing and leaves every scene inline", () => {
    stubBrowser({ wide: false });
    const { container } = render(<Journey><TigaMisi /></Journey>);
    expect(observers).toHaveLength(0);
    expect(container.querySelectorAll(".story-step .story-inline img")).toHaveLength(3);
    expect(container.querySelector<HTMLElement>("[data-story]")?.dataset.prev).toBeUndefined();
  });
});
