import { startOfDay } from "./schedule";

/**
 * The current GDGoC IPB University chapter year, both ends inclusive. Apresiasi takes only achievements announced
 * within it, and member cards are valid for it. Update it when a new chapter year starts in July.
 */
export const chapterPeriod = { start: "2026-07-01", end: "2027-07-01", label: "1 Juli 2026 – 1 Juli 2027", year: "2026/27" } as const;

/** Whether a moment falls in the chapter year, from 00:00 WIB on its first day to the end of its last day, WIB. */
export function inChapterPeriod(now: number, period: { start: string; end: string } = chapterPeriod) {
  return now >= startOfDay(period.start) && now <= Date.parse(`${period.end}T23:59:59+07:00`);
}
