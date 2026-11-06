"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useExperience } from "@/components/experience-provider";
import { activationBand, nextActiveStep, roadPoint, storyQuery, type RoadChapter } from "@/lib/journey";

/** Where the angkot stays off: phones, where the road is one thin lane. `journey.css` hides it there too. */
const phoneQuery = "(max-width: 760px)";
/** The reader's eye line, as a share of the viewport's height. */
const eyeLine = 0.55;

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

/**
 * Drives the angkot along the road: each frame after a scroll it reads the chapters' boxes and puts the angkot where
 * the reader's eye line meets the road. Reads native scroll, which Lenis drives too. With reduced motion it is placed
 * once at the start and stays there; on phones it is hidden and nothing runs.
 */
function driveAngkot(root: HTMLElement, angkot: HTMLElement, moving: boolean) {
  const phone = window.matchMedia(phoneQuery);
  let frame = 0;
  const place = () => {
    frame = 0;
    if (phone.matches) return;
    const box = root.getBoundingClientRect();
    const chapters: RoadChapter[] = Array.from(root.querySelectorAll<HTMLElement>("[data-chapter]"), (chapter) => {
      const { top, left, width, height } = chapter.getBoundingClientRect();
      return { top: top - box.top, left: left - box.left, width, height, side: chapter.dataset.side === "left" ? "left" : "right" };
    });
    if (chapters.length === 0) return;
    const road = parseFloat(getComputedStyle(root).getPropertyValue("--road")) || 28;
    const line = moving ? window.innerHeight * eyeLine - box.top : -Infinity;
    const { x, y, heading } = roadPoint(chapters, road, line, window.innerHeight * 0.35);
    angkot.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    angkot.dataset.heading = heading;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(place);
  };
  // Images and fonts settle the chapters' heights after the first frame.
  const resized = new ResizeObserver(schedule);
  resized.observe(root);
  schedule();
  if (moving) window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  phone.addEventListener("change", schedule);
  return () => {
    cancelAnimationFrame(frame);
    resized.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    phone.removeEventListener("change", schedule);
  };
}

/**
 * The journey's wrapper: server-rendered chapters inside, the scroll effects wired up once it hydrates. The angkot is
 * decorative and rides the road, never the text.
 */
export function Journey({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const angkot = useRef<HTMLDivElement>(null);
  const { animated } = useExperience();
  useEffect(() => {
    if (!ref.current || !angkot.current) return;
    return driveAngkot(ref.current, angkot.current, animated);
  }, [animated]);
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
      <div ref={angkot} className="angkot" aria-hidden="true">
        <Image src="/landing/angkot-bogor.svg" alt="" width={116} height={67} unoptimized />
      </div>
    </div>
  );
}
