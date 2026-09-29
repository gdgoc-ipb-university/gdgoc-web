import { DINO } from "./engine";

/** The most world units a play view shows ahead of the dino; the engine spawns 1400 ahead, so nothing pops in. */
export const MAX_AHEAD = 1120;
/**
 * Play arenas fit the screen under the site header, so landscape phones and low windows get short ones. Below these
 * heights (any arena, or one wider than 760px) the play layout is compact: no title, the score top right, the controls
 * and back link on one row under the ground. bogor-run.module.css switches with container queries on the same limits.
 */
export const SHORT = { any: 440, wide: 600 } as const;

export const isShort = (width: number, height: number) => height < SHORT.any || (width > 760 && height < SHORT.wide);

/** CSS-pixel projection, independent of devicePixelRatio and game physics. */
export function getView(width: number, height: number, demo: boolean) {
  const mobile = width <= 760;
  const short = !demo && isShort(width, height);
  const ground = mobile || short ? height - 50 : height * 0.875;
  // The jump (the dino plus its apex, 153 units) must clear the title band, or on short arenas just the top edge:
  // there the score sits top right, above the highest elang.
  const scale = demo
    ? Math.min(3.8, Math.max(mobile ? 2.4 : 3.2, width / 420))
    : Math.min(3.3, Math.max(1.3, width / 420), (ground - (short ? 8 : 175)) / 154);
  // Ultra-wide play views move the dino inwards instead of revealing the spawn line.
  const x = demo ? width * (mobile ? 0.64 : 0.73) - DINO.width * scale / 2 : Math.max(width * 0.14, width - MAX_AHEAD * scale);
  return { scale, x, ground, short };
}
