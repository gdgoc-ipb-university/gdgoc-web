import { DINO } from "./engine";

/** CSS-pixel projection, independent of devicePixelRatio and game physics. */
export function getView(width: number, height: number, demo: boolean) {
  const mobile = width <= 760;
  const ground = mobile ? height - 50 : height * 0.875;
  const scale = demo
    ? Math.min(3.8, Math.max(mobile ? 2.4 : 3.2, width / 420))
    : Math.min(3.3, Math.max(1.3, width / 420), (ground - 175) / 154);
  const x = demo ? width * (mobile ? 0.64 : 0.73) - DINO.width * scale / 2 : width * 0.14;
  return { scale, x, ground, spawnX: DINO.x + (width - x) / scale + 24, despawnX: DINO.x - x / scale - 16 };
}
