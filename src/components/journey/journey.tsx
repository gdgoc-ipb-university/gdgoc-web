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
      stop = wide.matches ? followStory(root) : () => {};
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
