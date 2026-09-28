import { describe, expect, it } from "vitest";
import { DINO } from "./engine";
import { getView } from "./view";

describe("responsive game projection", () => {
  it.each([[320, 600], [390, 680], [768, 640], [1440, 640], [1920, 720]])("keeps a full jump below the controls at %i px", (width, height) => {
    const view = getView(width, height, false);
    const apex = view.ground - (DINO.height + 105) * view.scale;
    expect(apex).toBeGreaterThan(175);
    const spawn = view.x + (view.spawnX - DINO.x) * view.scale;
    expect(spawn).toBeGreaterThan(width);
    expect(view.x).toBeGreaterThan(0);
    expect(view.x + DINO.width * view.scale).toBeLessThan(width);
  });

  it("keeps passed obstacles until they leave the full-width scene", () => {
    const view = getView(1440, 640, true);
    expect(view.x + (view.despawnX - DINO.x) * view.scale).toBeLessThan(0);
    expect(view.despawnX).toBeLessThan(-150);
  });
});
