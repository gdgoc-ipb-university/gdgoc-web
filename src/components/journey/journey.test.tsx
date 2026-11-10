import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { about } from "@/lib/about";
import { catalyst } from "@/lib/catalyst";
import { activationBand, storyQuery } from "@/lib/journey";
import { dayLabel, rangeLabel } from "@/lib/schedule";
import { Journey } from "./journey";
import { TigaMisi } from "./missions";
import { PilihJalurmu } from "./programs";
import { SetahunBersama } from "./setahun";
import { YearTimeline } from "./year-timeline";

const motion = vi.hoisted(() => ({ animated: false }));
vi.mock("@/components/experience-provider", () => ({ useExperience: () => ({ animated: motion.animated }) }));

type Observed = { callback: IntersectionObserverCallback; options?: IntersectionObserverInit; targets: Element[] };
let observers: Observed[] = [];

function stubBrowser({ wide }: { wide: boolean }) {
  observers = [];
  // jsdom has no Web Animations (which `Reveal` only cancels) and no ResizeObserver.
  Element.prototype.getAnimations ??= () => [];
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
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
  motion.animated = false;
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

describe("program level select", () => {
  it("selects the card whose band crosses the middle of the screen, and none once the chapter has passed", () => {
    stubBrowser({ wide: true });
    const { container } = render(<Journey><PilihJalurmu /></Journey>);
    const levels = container.querySelector<HTMLElement>("[data-levels]")!;
    const observed = observers.find((each) => each.targets[0]?.classList.contains("level-band"))!;
    expect(observed.targets).toHaveLength(3);
    expect(levels.dataset.selected).toBeUndefined();
    cross(observed, { 0: true });
    expect(levels.dataset.selected).toBe("0");
    cross(observed, { 0: false, 1: true });
    expect(levels.dataset.selected).toBe("1");
    cross(observed, { 1: false, 2: false });
    expect(levels.dataset.selected).toBeUndefined();
  });

  it("keeps every program's link and the link to all programs", () => {
    stubBrowser({ wide: false });
    render(<Journey><PilihJalurmu /></Journey>);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/program/catalyst", "/program/tech-league", "/program/tech-support", "/program",
    ]);
    expect(observers).toHaveLength(0);
  });

  it("offers the Catalyst page, not its schedule, while the schedule is on hold", () => {
    stubBrowser({ wide: false });
    render(<Journey><PilihJalurmu /></Journey>);
    const card = screen.getAllByRole("link")[0];
    expect(card.getAttribute("href")).toBe(catalyst.path);
    expect(card.querySelector(".level-link")?.textContent?.trim()).toBe("Lihat Catalyst");
  });
});

describe("year chapter", () => {
  /** Every Catalyst date as the timeline would write it, and the ISO dates behind them. */
  const catalystDates = [...new Set(catalyst.timeline.flatMap((step) => {
    const end = "end" in step ? step.end : undefined;
    const days = end ? [step.start, end] : [step.start];
    return [...days, ...days.map(dayLabel), rangeLabel(step.start, end)];
  }))];
  const trackNames = (container: HTMLElement) => Array.from(container.querySelectorAll(".year-track h3"), (heading) => heading.textContent);

  beforeEach(() => {
    stubBrowser({ wide: false });
    // A day that is not a Catalyst date, should "Hari ini" be written before the assertions run.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-01T05:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("leaves Catalyst's track and dates out while its schedule is on hold, and says they follow on Instagram", () => {
    const { container } = render(<SetahunBersama />);
    expect(trackNames(container)).toEqual(["Tech League"]);
    expect(container.querySelectorAll(".year-lane")).toHaveLength(1);
    expect(container.querySelector(".chapter-lead")?.textContent).toContain("Jadwal Catalyst menyusul di Instagram @gdgoc.ipb.");
    for (const step of catalyst.timeline) expect(container.textContent).not.toContain(step.label);
    for (const date of catalystDates) expect(container.innerHTML).not.toContain(date);
  });

  it("draws Catalyst's track before Tech League's once the schedule is no longer on hold", () => {
    const { container } = render(<SetahunBersama catalystOnHold={false} />);
    expect(trackNames(container)).toEqual(["GDGoC Catalyst", "Tech League"]);
    expect(container.querySelector(".chapter-lead")?.textContent).toContain("Jadwal Catalyst dan Tech League 2026/2027");
    const first = container.querySelector(".year-track li");
    expect(first?.querySelector(".year-date")?.textContent).toBe("2–22 November 2026");
    expect(first?.querySelector(".year-label")?.textContent).toBe("Pendaftaran (oprec)");
  });
});

describe("year timeline", () => {
  const tracks = [
    { name: "GDGoC Catalyst", href: "/program/catalyst", color: "blue" as const, milestones: [
      { label: "Pendaftaran (oprec)", start: "2026-11-02", end: "2026-11-22" },
      { label: "Pengumuman peserta", start: "2026-11-29" },
    ] },
  ];
  const frame = () => act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); });

  afterEach(() => vi.useRealTimers());

  it("renders no status until it reads today on the client, then marks each milestone in WIB", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 17:30 UTC on 22 November is already 00:30 WIB on the 23rd: oprec has closed.
    vi.setSystemTime(new Date("2026-11-22T17:30:00Z"));
    const { container } = render(<YearTimeline tracks={tracks} />);
    const items = () => Array.from(container.querySelectorAll<HTMLElement>(".year-track li"));
    expect(items().map((item) => item.dataset.status)).toEqual([undefined, undefined]);
    expect(container.querySelector(".year-today")).toBeNull();
    await frame();
    expect(items().map((item) => item.dataset.status)).toEqual(["done", "upcoming"]);
    expect(items().map((item) => item.querySelector(".year-status")?.textContent)).toEqual(["Selesai", "Akan datang"]);
    expect(screen.getByText(/Hari ini 23 November 2026 WIB/)).toBeTruthy();
    expect(container.querySelector(".year-today")).not.toBeNull();
  });

  it("drops the pin when today is outside the year", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-08-01T00:00:00Z"));
    const { container } = render(<YearTimeline tracks={tracks} />);
    await frame();
    expect(container.querySelector(".year-today")).toBeNull();
    expect(Array.from(container.querySelectorAll<HTMLElement>(".year-track li"), (item) => item.dataset.status)).toEqual(["done", "done"]);
  });
});

describe("the angkot", () => {
  const frame = () => act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); });
  let scroll = 0;

  /** A 900 px window over a journey 1000 px down the page, with two 1000 px wide chapters under an 80 px start line. */
  function renderRoad() {
    stubBrowser({ wide: true });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    const { container } = render(
      <Journey>
        <section data-chapter data-side="right" />
        <section data-chapter data-side="left" />
      </Journey>,
    );
    const rect = (top: number, height: number) => () => ({ top: top - scroll, left: 20, width: 1000, height }) as DOMRect;
    const [first, second] = container.querySelectorAll<HTMLElement>("[data-chapter]");
    container.querySelector<HTMLElement>(".journey")!.getBoundingClientRect = () => ({ top: 1000 - scroll, left: 0 }) as DOMRect;
    first.getBoundingClientRect = rect(1080, 800);
    second.getBoundingClientRect = rect(1880, 2000);
    return container.querySelector<HTMLElement>(".angkot")!;
  }

  it("is decorative: hidden from assistive tech, with an empty alt", () => {
    const angkot = renderRoad();
    expect(angkot.getAttribute("aria-hidden")).toBe("true");
    expect(angkot.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("with reduced motion, waits at the start of the road and ignores scrolling", async () => {
    scroll = 0;
    const angkot = renderRoad();
    await frame();
    expect(angkot.style.transform).toBe("translate(34px, 94px)");
    expect(angkot.dataset.heading).toBe("right");
    scroll = 1500;
    fireEvent.scroll(window);
    await frame();
    expect(angkot.style.transform).toBe("translate(34px, 94px)");
  });

  it("with motion, drives along the road with the reader's eye line", async () => {
    motion.animated = true;
    scroll = 0;
    const angkot = renderRoad();
    await frame();
    expect(angkot.style.transform).toBe("translate(34px, 94px)");
    // The eye line (55% of 900 px) is 1495 px down the page: 415 px into the first chapter, already down its side.
    scroll = 1000;
    fireEvent.scroll(window);
    await frame();
    expect(angkot.dataset.heading).toBe("down");
    expect(angkot.style.transform).toMatch(/^translate\(1006px, \d+px\)$/);
    scroll = 2000;
    fireEvent.scroll(window);
    await frame();
    expect(angkot.dataset.heading).toBe("down");
    expect(angkot.style.transform).toMatch(/^translate\(34px, \d+px\)$/);
  });
});
