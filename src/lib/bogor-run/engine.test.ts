import { describe, expect, it } from "vitest";
import { advanceAutoplay, advanceRun, createRun, DINO, jump, OBSTACLES, readBest, scoreOf, speedOf, startRun, type ObstacleKind, type Run } from "./engine";

function advance(run: Run, seconds: number) {
  for (let tick = 0; tick < Math.ceil(seconds * 120); tick++) advanceRun(run, 1 / 120, () => 0.5);
}

describe("Bogor Run", () => {
  it("remains still until started and freezes when paused", () => {
    const idle = createRun(); advance(idle, 2);
    expect(idle.distance).toBe(0);
    const run = startRun(); advance(run, 0.5);
    expect(scoreOf(run)).toBeGreaterThan(0);
    run.phase = "paused";
    const saved = structuredClone(run); advance(run, 5);
    expect(run).toEqual(saved);
  });

  it.each(Object.keys(OBSTACLES) as ObstacleKind[])("detects a ground collision with %s and stops scoring", (kind) => {
    const run = startRun(); run.obstacles = [{ id: 0, kind, x: DINO.x + 20 }];
    advanceRun(run, 1 / 60);
    expect(run.phase).toBe("over"); expect(run.hit).toBe(kind);
    const score = scoreOf(run); advance(run, 2);
    expect(scoreOf(run)).toBe(score);
  });

  it.each([0, 60])("can clear every obstacle with one jump at %i seconds of difficulty", (time) => {
    for (const kind of Object.keys(OBSTACLES) as ObstacleKind[]) {
      const run = startRun(); run.time = time; run.spawnIn = 10;
      run.obstacles = [{ id: 0, kind, x: DINO.x + 75 }];
      jump(run); advance(run, 1.15);
      expect(run.phase, kind).toBe("running");
      expect(run.lift, kind).toBe(0);
      expect(run.obstacles, kind).toHaveLength(0);
    }
  });

  it("does not let a held or repeated jump reset the flight", () => {
    const run = startRun(); jump(run); advance(run, 0.2);
    const velocity = run.velocity; jump(run);
    expect(run.velocity).toBe(velocity);
    expect(run.lift).toBeGreaterThan(0);
  });

  it("keeps speed, long frames, and spacing bounded", () => {
    const run = startRun(); run.time = 999;
    expect(speedOf(run)).toBe(270);
    advanceRun(run, 20);
    expect(run.distance).toBeLessThanOrEqual(28);
    run.spawnIn = 0; advanceRun(run, 1 / 120, () => 0);
    expect(run.spawnIn).toBeGreaterThanOrEqual(1.6);
    expect(run.obstacles[1].kind).toBe("talas");
  });

  it("autonomously clears repeated obstacle cycles without changing player state", () => {
    const demo = startRun(230);
    const player = createRun();
    for (let tick = 0; tick < 120 * 60; tick++) advanceAutoplay(demo, 1 / 60);
    expect(demo.phase).toBe("running");
    expect(demo.sequence).toBeGreaterThan(45);
    expect(scoreOf(player)).toBe(0);
    expect(player.phase).toBe("idle");
  });

  it("starts each retry cleanly and validates the browser's stored record", () => {
    const run = startRun(); advance(run, 4);
    expect(run.phase).toBe("over");
    const retry = startRun(); expect(retry.distance).toBe(0); expect(retry.lift).toBe(0); expect(retry.hit).toBeNull();
    expect(readBest("157")).toBe(157);
    for (const stored of [null, "broken", "-1", "Infinity", "1.5", "1000001"]) expect(readBest(stored)).toBe(0);
  });
});
