/**
 * The landing's member journey (#165): the pure parts of its scroll effects, so they can be tested without a browser.
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
