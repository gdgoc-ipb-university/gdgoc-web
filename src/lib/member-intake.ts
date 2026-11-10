import { rangeLabel, windowState } from "./schedule";
import { twibbon } from "./twibbon";

/**
 * Open recruitment for members 2026/27 (#211), as the intake posts and the guidebook at /gb-member give it: open to
 * students of any campus and SMA/SMK students, no selection, 10–30 November 2026 (WIB). The landing's popup reads it.
 */
export const memberIntake = {
  name: "Open recruitment member 2026/27",
  window: { opensAt: "2026-11-10", closesAt: "2026-11-30" },
  links: { register: "/dashboard", twibbon: twibbon.path, guidebook: "/gb-member" },
  hashtag: twibbon.hashtag,
  /** Set in this browser once the landing's popup is closed. The edition is part of the key, so the next intake shows again. */
  seenKey: "gdgoc:member-intake:2026-27:popup",
} as const;

/** "10–30 November 2026". */
export const memberIntakeDates = rangeLabel(memberIntake.window.opensAt, memberIntake.window.closesAt);

/** Upcoming, open or closed, from 00:00 WIB on 10 November to the end of 30 November WIB, like every sign-up window. */
export function memberIntakeState(now: number) {
  return windowState(now, memberIntake.window);
}
