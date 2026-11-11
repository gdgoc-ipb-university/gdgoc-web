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

/**
 * A dated step of a program, as `catalyst.timeline`, `techLeague.milestones` and `techLeague.timeline` list them
 * (YYYY-MM-DD, WIB). The items of Tech League's full timeline also name the `phase` they belong to.
 */
export type Milestone = { readonly label: string; readonly start: string; readonly end?: string; readonly phase?: string };
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

/**
 * The steps a track shows on the landing. A timeline that names phases shows one step per phase, from its first
 * item's start to its last item's end, in the order the phases first appear; one without (Catalyst's, and Tech
 * League's five milestones) shows each item.
 */
export function timelineSteps(milestones: readonly Milestone[]): Milestone[] {
  const groups = new Map<string, Milestone[]>();
  for (const milestone of milestones) {
    const key = milestone.phase ?? milestone.label;
    groups.set(key, [...(groups.get(key) ?? []), milestone]);
  }
  return Array.from(groups, ([label, items]) => {
    const start = items.map((item) => item.start).sort()[0];
    const end = items.map((item) => item.end ?? item.start).sort()[items.length - 1];
    return end === start ? { label, start } : { label, start, end };
  });
}

/**
 * Which row of a lane each step sits in so none overlap: steps are drawn at least `minWidth` wide (a share of the
 * span), and each takes the first row that is clear by the time it starts.
 */
export function laneRows(extents: readonly { left: number; width: number }[], minWidth: number): number[] {
  const order = extents.map((_, index) => index).sort((a, b) => extents[a].left - extents[b].left);
  const ends: number[] = [];
  const rows: number[] = [];
  for (const index of order) {
    const { left, width } = extents[index];
    let row = ends.findIndex((end) => end <= left);
    if (row < 0) row = ends.length;
    ends[row] = left + Math.max(width, minWidth);
    rows[index] = row;
  }
  return rows;
}

/** A chapter's box inside the journey, in px from the journey's top left, and the side its road runs down. */
export type RoadChapter = { top: number; left: number; width: number; height: number; side: "left" | "right" };
export type RoadPoint = { x: number; y: number; heading: "left" | "right" | "down" };

/**
 * Where the angkot is on the road when the reader's eye line is `line` px below the journey's top. Each chapter's road
 * runs across its top (entering on the side away from `side`) and down `side`. The angkot crosses the top while the
 * line moves `turn` px into the chapter (or a quarter of a short chapter), so it never falls far behind the reader,
 * then drives down with the line and meets it at the chapter's bottom. It waits at the start before the first
 * chapter and stops one road width short of the finish line after the last.
 */
export function roadPoint(chapters: readonly RoadChapter[], road: number, line: number, turn = 320): RoadPoint {
  const half = road / 2;
  const entry = (chapter: RoadChapter) => (chapter.side === "right" ? chapter.left + half : chapter.left + chapter.width - half);
  const exit = (chapter: RoadChapter) => (chapter.side === "right" ? chapter.left + chapter.width - half : chapter.left + half);
  const across = (chapter: RoadChapter) => (chapter.side === "right" ? "right" : "left");
  const first = chapters[0];
  if (line <= first.top) return { x: entry(first), y: first.top + half, heading: across(first) };
  const index = chapters.findIndex((chapter) => line < chapter.top + chapter.height);
  const chapter = index < 0 ? chapters[chapters.length - 1] : chapters[index];
  const into = index < 0 ? chapter.height : line - chapter.top;
  const crossing = Math.min(turn, chapter.height / 4);
  if (into < crossing) {
    return { x: entry(chapter) + ((exit(chapter) - entry(chapter)) * into) / crossing, y: chapter.top + half, heading: across(chapter) };
  }
  const bottom = chapter.top + chapter.height - (chapter === chapters[chapters.length - 1] ? road : 0);
  const y = chapter.top + half + ((bottom - chapter.top - half) * (into - crossing)) / (chapter.height - crossing);
  return { x: exit(chapter), y, heading: "down" };
}
