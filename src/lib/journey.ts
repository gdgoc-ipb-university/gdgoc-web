import { startOfDay } from "./schedule";

/**
 * The landing's member journey (#165): the pure parts of its scroll effects and its year timeline, so they can be
 * tested without a browser.
 */

/**
 * When the missions use the sticky panel: a wide screen, and no reduced-motion preference. `journey.css` repeats this
 * query, so the prerendered page already has the right layout and nothing shifts when the effects start.
 */
export const storyQuery = "(min-width: 961px) and (prefers-reduced-motion: no-preference)";

/**
 * The band in the middle of the viewport a step must cross to become active, as an IntersectionObserver `rootMargin`.
 * Steps are taller than the band, so normally one step is in it at a time.
 */
export const activationBand = "-45% 0px -45% 0px";

/**
 * Which step is active, given which steps are in the activation band now. The current step stays while it is still in
 * the band, so two steps crossing the band together never flicker; otherwise the step in the band nearest the
 * current one wins. With no step in the band, `keep` decides: true keeps the current step (the missions, which always
 * show one scene), false returns -1 (the program cards, which only lift while their chapter is being read).
 */
export function nextActiveStep(inBand: readonly boolean[], current: number, keep = true): number {
  if (inBand[current]) return current;
  let next = -1;
  inBand.forEach((on, index) => {
    if (on && (next < 0 || Math.abs(index - current) < Math.abs(next - current))) next = index;
  });
  return next >= 0 ? next : keep ? current : -1;
}

/** A dated step of a program, as `catalyst.timeline` and `techLeague.timeline` list them (YYYY-MM-DD, WIB). */
export type Milestone = { readonly label: string; readonly start: string; readonly end?: string };
export type MilestoneStatus = "done" | "current" | "upcoming";

const day = 86_400_000;
const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Upcoming before 00:00 WIB on its first day, current through the end of its last day (WIB), done after. */
export function milestoneStatus(now: number, milestone: Milestone): MilestoneStatus {
  if (now < startOfDay(milestone.start)) return "upcoming";
  if (now < startOfDay(milestone.end ?? milestone.start) + day) return "current";
  return "done";
}

/** Today's date in WIB as YYYY-MM-DD; the machine and the visitor may be in another time zone. */
export function wibDate(now: number) {
  return new Date(now + 7 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * The whole months the milestones fall in, from the first day of the earliest month to the end of the latest, with
 * each month's share of the span so a ruler can draw them to scale.
 */
export function timelineSpan(milestones: readonly Milestone[]) {
  const starts = milestones.map((milestone) => milestone.start).sort();
  const ends = milestones.map((milestone) => milestone.end ?? milestone.start).sort();
  let [year, month] = starts[0].split("-").map(Number);
  const [lastYear, lastMonth] = ends[ends.length - 1].split("-").map(Number);
  const months: { key: string; label: string; year: number; start: number }[] = [];
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push({ key, label: monthNames[month - 1], year, start: startOfDay(`${key}-01`) });
    [year, month] = month === 12 ? [year + 1, 1] : [year, month + 1];
  }
  const start = months[0].start;
  const end = startOfDay(`${year}-${String(month).padStart(2, "0")}-01`);
  return {
    start,
    end,
    months: months.map((entry, index) => ({ ...entry, share: ((months[index + 1]?.start ?? end) - entry.start) / (end - start) })),
  };
}

/** Where a moment falls on the span, from 0 at its start to 1 at its end. */
export function spanPosition(span: { start: number; end: number }, at: number) {
  return (at - span.start) / (span.end - span.start);
}

/** A milestone's left edge and width on the span, covering its whole first and last days. */
export function milestoneExtent(span: { start: number; end: number }, milestone: Milestone) {
  const from = spanPosition(span, startOfDay(milestone.start));
  const to = spanPosition(span, startOfDay(milestone.end ?? milestone.start) + day);
  return { left: from, width: to - from };
}
