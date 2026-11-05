"use client";

import { useEffect, useRef } from "react";
import { activationBand, nextActiveStep, storyQuery } from "@/lib/journey";

/**
 * Follows which mission step crosses the middle of the screen and writes it to the story's `data-active`, with the
 * step it replaced in `data-prev`; the CSS does the rest. Only runs while the sticky panel is on screen (wide, no
 * reduced motion), so phones and reduced motion keep the inline layout with nothing to drive. IntersectionObserver,
 * not scroll math, so it follows Lenis and native scrolling alike.
 */
function followStory(root: HTMLElement) {
  const story = root.querySelector<HTMLElement>("[data-story]");
  const steps = Array.from(story?.querySelectorAll<HTMLElement>(".story-step") ?? []);
  if (!story || steps.length === 0) return () => {};
  const inBand = steps.map(() => false);
  let active = Number(story.dataset.active ?? 0);
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) inBand[steps.indexOf(entry.target as HTMLElement)] = entry.isIntersecting;
      const next = nextActiveStep(inBand, active);
      if (next === active) return;
      story.dataset.prev = String(active);
      story.dataset.active = String(next);
      active = next;
    },
    { rootMargin: activationBand },
  );
  steps.forEach((step) => observer.observe(step));
  return () => observer.disconnect();
}

/**
 * Follows the program chapter: three invisible bands stacked over the cards cross the middle of the screen in turn,
 * and the card for the band in the middle is written to `data-selected` (none once the chapter has passed).
 */
function followLevels(root: HTMLElement) {
  const levels = root.querySelector<HTMLElement>("[data-levels]");
  const bands = Array.from(levels?.querySelectorAll<HTMLElement>(".level-band") ?? []);
  if (!levels || bands.length === 0) return () => {};
  const inBand = bands.map(() => false);
  let selected = -1;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) inBand[bands.indexOf(entry.target as HTMLElement)] = entry.isIntersecting;
      const next = nextActiveStep(inBand, selected, false);
      if (next === selected) return;
      selected = next;
      if (next < 0) delete levels.dataset.selected;
      else levels.dataset.selected = String(next);
    },
    { rootMargin: activationBand },
  );
  bands.forEach((band) => observer.observe(band));
  return () => {
    observer.disconnect();
    delete levels.dataset.selected;
  };
}

/** The journey's wrapper: server-rendered chapters inside, the scroll effects wired up once it hydrates. */
export function Journey({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const wide = window.matchMedia(storyQuery);
    let stop = () => {};
    const sync = () => {
      stop();
      if (!wide.matches) {
        stop = () => {};
        return;
      }
      const stops = [followStory(root), followLevels(root)];
      stop = () => stops.forEach((each) => each());
    };
    sync();
    wide.addEventListener("change", sync);
    return () => {
      stop();
      wide.removeEventListener("change", sync);
    };
  }, []);
  return (
    <div ref={ref} className="journey">
      {children}
    </div>
  );
}
