import { describe, expect, it } from "vitest";
import { BIRD, DINO, FIELD, OBSTACLES, PHYSICS } from "./engine";
import { getView, isShort, MAX_AHEAD, MIN_AHEAD, SHORT } from "./view";

const apexOf = () => PHYSICS.jump * PHYSICS.jump / (2 * PHYSICS.gravity);

describe("responsive game projection", () => {
  it.each([[320, 440], [320, 540], [375, 557], [390, 680], [768, 640], [1024, 640], [1440, 640], [1920, 720], [3840, 720], [5120, 720]])("keeps a full jump below the controls at %i px", (width, height) => {
    const view = getView(width, height, false);
    const apex = view.ground - (DINO.height + apexOf() + 2) * view.scale;
    expect(apex).toBeGreaterThan(175);
    // A high elang, the tallest actor, also stays clear of the HUD.
    expect(view.ground - (BIRD.altitude.high + OBSTACLES.elang.height) * view.scale).toBeGreaterThan(175);
    expect(view.x).toBeGreaterThan(0);
    expect(view.x + DINO.duckWidth * view.scale).toBeLessThan(width);
    // Obstacles enter off-screen: the play view never reaches the engine's spawn line.
    expect((width - view.x) / view.scale).toBeLessThanOrEqual(MAX_AHEAD + 1e-9);
    expect(view.x + (FIELD.spawn - DINO.x) * view.scale).toBeGreaterThan(width);
    // Every width warns as early: at least MIN_AHEAD from the dino's nose to the right edge.
    expect((width - view.x) / view.scale - DINO.width).toBeGreaterThanOrEqual(MIN_AHEAD - 1e-9);
  });

  it("zooms phones out to the same warning and leaves wide screens as they were", () => {
    const ahead = (width: number, height: number) => { const view = getView(width, height, false); return (width - view.x) / view.scale - DINO.width; };
    expect(ahead(390, 680)).toBeCloseTo(MIN_AHEAD, 6);
    expect(ahead(320, 540)).toBeCloseTo(MIN_AHEAD, 6);
    expect(getView(390, 680, false)).toMatchObject({ x: 390 * 0.08, scale: expect.closeTo(0.986, 3) });
    for (const [width, height] of [[1440, 640], [1920, 720], [3840, 720]]) {
      // The projection from before MIN_AHEAD: wide screens already show more than it.
      expect(getView(width, height, false).scale).toBe(Math.min(3.3, Math.max(1.3, width / 420), (height * 0.875 - 175) / 154));
    }
    // The idle demo keeps its own projection.
    expect(getView(390, 680, true).scale).toBe(2.4);
  });

  // Playing arenas fit the screen under the header: landscape phones and low laptop windows get short ones.
  it.each([[568, 245], [667, 300], [740, 285], [844, 302], [932, 342], [1024, 520], [1280, 489], [1366, 569], [1920, 599]])("fits the whole jump into a short %i x %i arena", (width, height) => {
    const view = getView(width, height, false);
    expect(view.short).toBe(true);
    expect(view.ground).toBe(height - 50); // the controls row sits under the ground, as on phones
    // The dino's jump clears the top edge, and the highest elang passes under the score in the top-right corner.
    expect(view.ground - (DINO.height + apexOf() + 2) * view.scale).toBeGreaterThanOrEqual(8);
    expect(view.ground - (BIRD.altitude.high + OBSTACLES.elang.height) * view.scale).toBeGreaterThan(44);
    // Fitting only ever shrinks the width-based scale (never enlarges it), so it shows at most MAX_AHEAD, as before.
    expect(view.scale).toBeLessThanOrEqual(Math.min(3.3, Math.max(1.3, width / 420)));
    expect(view.x).toBeGreaterThan(0);
    expect((width - view.x) / view.scale).toBeLessThanOrEqual(MAX_AHEAD + 1e-9);
    expect(view.x + (FIELD.spawn - DINO.x) * view.scale).toBeGreaterThan(width);
    expect((width - view.x) / view.scale - DINO.width).toBeGreaterThanOrEqual(MIN_AHEAD - 1e-9);
  });

  it("switches to the compact layout at the container-query limits", () => {
    expect([isShort(390, SHORT.any - 1), isShort(390, SHORT.any), isShort(761, SHORT.wide - 1), isShort(760, SHORT.wide - 1), isShort(761, SHORT.wide)]).toEqual([true, false, true, false, false]);
    // The demo keeps its own projection; the idle arena is never short.
    expect(getView(844, 302, true).short).toBe(false);
    for (const [width, height] of [[390, 769], [1440, 640], [1024, 640], [768, 640]]) expect(getView(width, height, false).short).toBe(false);
  });

  it.each([[390, 680], [1440, 640], [1920, 720]])("keeps passed obstacles until they leave the %i px scene", (width, height) => {
    for (const demo of [false, true]) {
      const view = getView(width, height, demo);
      expect(view.x + (FIELD.despawn + OBSTACLES.angkot.width - DINO.x) * view.scale).toBeLessThan(0);
      expect(view.x + (FIELD.spawn - DINO.x) * view.scale).toBeGreaterThan(width);
    }
  });
});
