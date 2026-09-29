import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyInput, autopilot, BIRD, collides, createRun, DINO, FIELD, HITBOX, INPUT, LATE, LIMITS, OBSTACLES, poseOf, pressureAt, readBest,
  replayRun, scoreOf, speedAt, speedOf, SPEED, startRun, step, TICK_RATE, type BirdLane, type InputCode, type Obstacle, type ObstacleKind,
  type Run,
} from "./engine";
import { MAX_AHEAD } from "./view";

const FAST_TICK = 200_000; // ≈ 28 min in, speed ≈ 390.5, late-game pressure ≈ 0.69
const HOUR_TICK = LIMITS.maxTicks - 100 * TICK_RATE; // 100 s before the finish line, pressure ≈ 0.84
const PRE_TICK = LATE.start - 50 * TICK_RATE; // the fastest stretch before any late-game pressure
const GROUND: ObstacleKind[] = ["angkot", "talas", "genangan"];
const seeds = (count: number, salt = 0) => Array.from({ length: count }, (_, i) => Math.imul(i + 1 + salt, 2654435761) >>> 0);
const clone = (run: Run): Run => ({
  ...run, next: { ...run.next }, group: run.group.map((member) => ({ ...member })), obstacles: run.obstacles.map((obstacle) => ({ ...obstacle })),
});
const DINO_MID = DINO.x + (HITBOX.stand[0] + HITBOX.stand[1]) / 2;
const middle = (obstacle: Obstacle) => obstacle.x + (HITBOX[obstacle.kind][0] + HITBOX[obstacle.kind][1]) / 2;

/** A run moved to `tick` with birds unlocked; the field is cleared because the start's obstacles were spaced for speed 174. */
function lateRun(seed: number, tick: number) {
  const run = startRun(seed);
  Object.assign(run, { tick, distance: 10 * BIRD.minScore, obstacles: [] });
  return run;
}
const fastRun = (seed: number) => lateRun(seed, FAST_TICK);
const hourRun = (seed: number) => lateRun(seed, HOUR_TICK);

/** Steps with the autopilot and logs only effective inputs, exactly as the browser records them. */
function pilot(run: Run, ticks: number, log: number[] = [], watch?: (run: Run) => void) {
  for (const end = run.tick + ticks; run.tick < end && run.phase === "running";) {
    for (const code of autopilot(run)) if (applyInput(run, code)) log.push(run.tick, code);
    step(run);
    watch?.(run);
  }
  return log;
}

function steps(run: Run, count: number) { for (let i = 0; i < count; i++) step(run); }

/** Lift after each step of an undisturbed jump: trajectory[k - 1] is the lift during the k-th step after takeoff. */
const trajectory = (() => {
  const run = startRun(1); run.obstacles = []; applyInput(run, INPUT.jump);
  const lifts: number[] = [];
  do { step(run); lifts.push(run.lift); } while (run.lift > 0);
  return lifts;
})();

/**
 * Per-obstacle facts gathered while the autopilot plays: spawn, standing-hitbox overlap steps, and the step its centre
 * (for a cluster leader: the cluster's middle) crosses the dino's.
 */
type Track = { obstacle: Obstacle; spawnTick: number; spawnX: number; score: number; enter?: number; exit?: number; centre?: number };
function track(run: Run, ticks: number) {
  const seen = new Map<number, Track>();
  const watch = (current: Run) => {
    const at = current.tick - 1; // The step that just ran.
    for (const obstacle of current.obstacles) {
      let entry = seen.get(obstacle.id);
      if (!entry) seen.set(obstacle.id, entry = { obstacle: { ...obstacle }, spawnTick: current.tick, spawnX: obstacle.x, score: scoreOf(current) });
      const [left, right] = HITBOX[obstacle.kind];
      if (DINO.x + HITBOX.stand[0] < obstacle.x + right && DINO.x + HITBOX.stand[1] > obstacle.x + left) { entry.enter ??= at; entry.exit = at; }
      const last = current.obstacles.findLast((member) => member.lead === obstacle.id);
      const centre = last ? (obstacle.x + left + last.x + HITBOX[last.kind][1]) / 2 : middle(obstacle);
      if (entry.centre === undefined && obstacle.lead === undefined && centre <= DINO_MID) entry.centre = at;
    }
  };
  for (const obstacle of run.obstacles) seen.set(obstacle.id, { obstacle: { ...obstacle }, spawnTick: run.tick, spawnX: obstacle.x, score: scoreOf(run) });
  pilot(run, ticks, [], watch);
  return { run, list: [...seen.values()].sort((a, b) => a.obstacle.id - b.obstacle.id) };
}

/** Obstacles grouped as the player meets them: a cluster with its followers, anything else alone. */
function groupsOf(list: Track[]) {
  const groups: Track[][] = [];
  for (const entry of list) {
    if (entry.obstacle.lead !== undefined && groups.at(-1)?.[0].obstacle.id === entry.obstacle.lead) groups.at(-1)!.push(entry);
    else groups.push([entry]);
  }
  return groups;
}

/** Early-game fingerprint: see "keeps the first five minutes identical". */
function fingerprint() {
  const EARLY = LATE.start, all = seeds(60);
  const generation = (seed: number) => {
    const run = startRun(seed), parts: string[] = [], seen = new Set<number>();
    const log = () => { for (const o of run.obstacles) if (!seen.has(o.id)) { seen.add(o.id); parts.push(`${run.tick}:${o.id}:${o.kind}:${o.lane ?? ""}:${o.altitude}:${o.x}`); } };
    log();
    while (run.tick < EARLY) { step(run); if (run.phase === "over") { run.phase = "running"; run.hit = null; } log(); }
    parts.push(`${run.rng}|${run.distance}|${run.next.id}:${run.next.kind}:${run.next.lane ?? ""}|${run.slack}|${run.lastKind}|${run.repeat}`);
    return parts.join(";");
  };
  const piloted = (seed: number) => {
    const run = startRun(seed), log: number[] = [];
    while (run.tick < EARLY && run.phase === "running") { for (const c of autopilot(run)) if (applyInput(run, c)) log.push(run.tick, c); step(run); }
    return `${run.phase}|${run.tick}|${run.distance}|${run.lift}|${run.velocity}|${log.join(",")}`;
  };
  const hash = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);
  return { generation: hash(all.map(generation).join("\n")), piloted: hash(all.map(piloted).join("\n")) };
}

/**
 * Every takeoff tick whose undisturbed jump clears each jump-needing group (a ground obstacle, a low bird or a whole
 * cluster) when it is alone on the field, for `seconds` of a run from `tick`, in obstacle order. Crashes are ignored
 * so the course keeps coming; mid and high birds are left out (they need a duck or nothing).
 */
function jumpWindows(seed: number, tick: number, seconds: number) {
  const run = lateRun(seed, tick), xs = new Map<number, { obstacle: Obstacle; at: Map<number, number> }>();
  for (const end = tick + seconds * TICK_RATE; run.tick < end;) {
    const at = run.tick;
    step(run);
    if (run.phase === "over") { run.phase = "running"; run.hit = null; }
    for (const obstacle of run.obstacles) (xs.get(obstacle.id) ?? xs.set(obstacle.id, { obstacle, at: new Map() }).get(obstacle.id)!).at.set(at, obstacle.x);
  }
  const groups = new Map<number, { obstacle: Obstacle; at: Map<number, number> }[]>();
  for (const entry of [...xs.values()].sort((a, b) => a.obstacle.id - b.obstacle.id)) {
    const key = entry.obstacle.lead ?? entry.obstacle.id;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(entry);
  }
  const dino = createRun();
  const hit = (members: { obstacle: Obstacle; at: Map<number, number> }[], at: number, lift: number) => members.some(({ obstacle, at: positions }) => {
    const x = positions.get(at);
    dino.lift = lift;
    return x !== undefined && collides(dino, { ...obstacle, x });
  });
  return [...groups.values()].map((members) => {
    const lane = members[0].obstacle.lane;
    if (lane === "mid" || lane === "high") return { members, valid: null };
    const danger = [...members[0].at.keys()].filter((at) => hit(members, at, 0));
    if (!danger.length || danger[0] === tick) return { members, valid: null }; // Already under way when the run was moved here.
    const valid: number[] = [];
    for (let takeoff = danger[0] - trajectory.length; takeoff <= danger[0]; takeoff++) {
      if (danger.every((at) => !hit(members, at, at >= takeoff && at - takeoff < trajectory.length ? trajectory[at - takeoff] : 0))) valid.push(takeoff);
    }
    return { members, valid };
  });
}

/**
 * Proof of solvability: depth-first search over cloned states with actions {none, jump, duck-hold, stand} every
 * STRIDE ticks. The obstacle stream never depends on the dino, so (tick, dino state) identifies a node and failed
 * nodes are pruned. Returns the replayable input log, or null when no path clears obstacle `goal`.
 */
function solve(start: Run, goal: number, budget = 60_000) {
  const STRIDE = 4;
  const dead = new Set<string>();
  const seen = new Map<number, Obstacle>();
  const path: number[] = [];
  let nodes = 0;
  let end = start;
  const cleared = (run: Run) => run.next.id > goal
    && run.obstacles.every((obstacle) => obstacle.id > goal || obstacle.x + HITBOX[obstacle.kind][1] <= DINO.x + HITBOX.duck[0]);
  const search = (run: Run): boolean => {
    for (const obstacle of run.obstacles) if (obstacle.id <= goal) seen.set(obstacle.id, obstacle);
    if (cleared(run)) { end = run; return true; }
    const key = `${run.tick}|${run.lift}|${run.velocity}|${run.ducking}|${run.dropping}`;
    if (dead.has(key) || ++nodes > budget) return false;
    for (const code of [0, INPUT.jump, INPUT.duck, INPUT.stand] as const) {
      const next = clone(run);
      if (code && !applyInput(next, code)) continue; // Same state as doing nothing.
      for (let i = 0; i < STRIDE && next.phase === "running"; i++) step(next);
      if (next.phase === "running" && search(next)) { if (code) path.push(code, run.tick); return true; }
    }
    dead.add(key);
    return false;
  };
  return search(clone(start)) ? { log: path.reverse(), end, nodes, obstacles: [...seen.values()] } : null;
}

describe("Bogor Run engine", () => {
  describe("physics", () => {
    it("stays still until started and freezes while paused or over", () => {
      const idle = createRun(); step(idle);
      expect(idle).toEqual(createRun());
      expect(applyInput(idle, INPUT.jump)).toBe(false);
      const run = startRun(7); steps(run, 60);
      expect(scoreOf(run)).toBeGreaterThan(0);
      run.phase = "paused";
      const saved = structuredClone(run);
      steps(run, 600);
      for (const code of [INPUT.jump, INPUT.duck, INPUT.stand] as const) expect(applyInput(run, code)).toBe(false);
      expect(run).toEqual(saved);
    });

    it("keeps the old jump feel and never lets a held or repeated jump reset a flight", () => {
      expect(trajectory).toHaveLength(101); // ≈ 0.84 s of airtime
      expect(Math.max(...trajectory)).toBeCloseTo(106.25, 5);
      const run = startRun(3); run.obstacles = [];
      expect(applyInput(run, INPUT.jump)).toBe(true);
      expect(applyInput(run, INPUT.jump)).toBe(false);
      steps(run, 20);
      const { lift, velocity } = run;
      expect(poseOf(run)).toBe("air");
      expect(applyInput(run, INPUT.jump)).toBe(false);
      expect([run.lift, run.velocity]).toEqual([lift, velocity]);
    });

    it("ducks while held on the ground and blocks jumping until it stands", () => {
      const run = startRun(3); run.obstacles = [];
      expect(applyInput(run, INPUT.duck)).toBe(true);
      expect(applyInput(run, INPUT.duck)).toBe(false);
      steps(run, 30);
      expect(poseOf(run)).toBe("duck");
      expect(applyInput(run, INPUT.jump)).toBe(false);
      expect(applyInput(run, INPUT.stand)).toBe(true);
      expect(applyInput(run, INPUT.stand)).toBe(false);
      expect(poseOf(run)).toBe("run");
      expect(applyInput(run, INPUT.jump)).toBe(true);
    });

    it("fast-drops in the air, keeps dropping after release, and lands in a duck while held", () => {
      const land = (release: boolean) => {
        const run = startRun(3); run.obstacles = [];
        applyInput(run, INPUT.jump); steps(run, 20);
        const rising = run.velocity;
        applyInput(run, INPUT.duck);
        expect(rising).toBeGreaterThan(0);
        expect([run.velocity, run.dropping]).toEqual([0, true]);
        if (release) applyInput(run, INPUT.stand);
        let ticks = 20;
        while (run.lift > 0) { step(run); ticks++; }
        expect(run.dropping).toBe(false);
        return { ticks, pose: poseOf(run) };
      };
      const held = land(false), released = land(true);
      expect(held.ticks).toBeLessThan(trajectory.length - 30);
      expect(released.ticks).toBe(held.ticks);
      expect(held.pose).toBe("duck");
      expect(released.pose).toBe("run");
    });

    it("cancels a jump pressed on the same tick as a duck", () => {
      const run = startRun(3); run.obstacles = [];
      applyInput(run, INPUT.jump); applyInput(run, INPUT.duck); step(run);
      expect([run.lift, run.velocity, run.dropping, poseOf(run)]).toEqual([0, 0, false, "duck"]);
    });

    it("rises for the whole run, starts at 174 and never reaches 400", () => {
      expect(speedAt(0)).toBe(SPEED.start);
      expect(speedOf(startRun(1))).toBe(174);
      for (const [seconds, speed] of [[60, 274], [120, 313], [300, 355]]) expect(Math.abs(speedAt(seconds * TICK_RATE) - speed)).toBeLessThan(1.5);
      let rising = true;
      for (let tick = 1; tick <= LIMITS.maxTicks * 10; tick++) rising &&= speedAt(tick) > speedAt(tick - 1) && speedAt(tick) < SPEED.max;
      expect(rising).toBe(true);
      expect(speedAt(FAST_TICK)).toBeGreaterThan(390);
    });

    it("adds late-game pressure only after five minutes, rising for the rest of the run without reaching 1", () => {
      for (const tick of [0, 1, TICK_RATE * 60, LATE.start]) expect(pressureAt(tick)).toBe(0);
      expect(pressureAt(15 * 60 * TICK_RATE)).toBeCloseTo(0.5, 10);
      let rising = true;
      for (let tick = LATE.start + 1; tick <= LIMITS.maxTicks; tick++) rising &&= pressureAt(tick) > pressureAt(tick - 1) && pressureAt(tick) < 1;
      expect(rising).toBe(true);
    });

    it("finishes a run that reaches the hour: over, finished, no hit", () => {
      const run = startRun(9);
      Object.assign(run, { tick: LIMITS.maxTicks - 3, obstacles: [] });
      steps(run, 2);
      expect([run.phase, run.finished]).toEqual(["running", false]);
      step(run);
      expect([run.phase, run.finished, run.hit, run.tick]).toEqual(["over", true, null, LIMITS.maxTicks]);
      const saved = structuredClone(run); steps(run, 60);
      expect(applyInput(run, INPUT.jump)).toBe(false);
      expect(run).toEqual(saved);
      // A crash on the very last step is a crash, not a finish.
      const crash = startRun(9);
      Object.assign(crash, { tick: LIMITS.maxTicks - 1, obstacles: [{ id: 70, kind: "talas", x: DINO.x + 10, altitude: 0 }] });
      step(crash);
      expect([crash.phase, crash.finished, crash.hit, crash.tick]).toEqual(["over", false, "talas", LIMITS.maxTicks]);
    });

    it("moves birds faster than the ground and scores distance / 10", () => {
      const run = startRun(5);
      run.obstacles = [{ id: 90, kind: "angkot", x: 900, altitude: 0 }, { id: 91, kind: "elang", x: 1100, altitude: BIRD.altitude.high, lane: "high" }];
      steps(run, TICK_RATE);
      let travelled = 0;
      for (let tick = 0; tick < TICK_RATE; tick++) travelled += speedAt(tick) / TICK_RATE;
      expect(run.obstacles[0].x).toBeCloseTo(900 - travelled, 6);
      expect(run.obstacles[1].x).toBeCloseTo(1100 - travelled - BIRD.extraSpeed, 6);
      expect(scoreOf(run)).toBe(Math.floor(run.distance / 10));
    });
  });

  describe("collisions", () => {
    /** Centres the obstacle's hitbox on the pose's hitbox, so only heights decide. */
    function touches(target: string, pose: "run" | "duck" | "air", lift: number) {
      const [kind, lane] = target.split(":") as [ObstacleKind, BirdLane | undefined];
      const run = startRun(1);
      Object.assign(run, { lift: pose === "air" ? lift : 0, ducking: pose === "duck" });
      const [left, right] = HITBOX[kind], box = pose === "duck" ? HITBOX.duck : HITBOX.stand;
      const x = DINO.x + (box[0] + box[1]) / 2 - (left + right) / 2;
      return collides(run, { id: 0, kind, x, altitude: lane ? BIRD.altitude[lane] : 0, ...(lane && { lane }) });
    }
    it.each([
      ["angkot", "run", 0, true], ["angkot", "duck", 0, true], ["angkot", "air", 30, true], ["angkot", "air", 31, false],
      ["talas", "run", 0, true], ["talas", "duck", 0, true], ["talas", "air", 34, true], ["talas", "air", 35, false],
      ["genangan", "run", 0, true], ["genangan", "duck", 0, true], ["genangan", "air", 4, true], ["genangan", "air", 5, false],
      ["elang:low", "run", 0, true], ["elang:low", "duck", 0, true], ["elang:low", "air", 38, true], ["elang:low", "air", 39, false],
      ["elang:mid", "run", 0, true], ["elang:mid", "duck", 0, false], ["elang:mid", "air", 20, true], ["elang:mid", "air", 55, false],
      ["elang:high", "run", 0, false], ["elang:high", "duck", 0, false], ["elang:high", "air", 15, true], ["elang:high", "air", 78, true], ["elang:high", "air", 79, false],
    ] as const)("%s vs a dino in pose %s at lift %i collides: %s", (target, pose, lift, expected) => {
      expect(touches(target, pose, lift)).toBe(expected);
    });

    it("needs strict overlap and only uses the crouch box on the ground", () => {
      const run = startRun(1);
      const edge = (x: number): Obstacle => ({ id: 0, kind: "angkot", x, altitude: 0 });
      expect(collides(run, edge(DINO.x + HITBOX.stand[1] - HITBOX.angkot[0]))).toBe(false);
      expect(collides(run, edge(DINO.x + HITBOX.stand[1] - HITBOX.angkot[0] - 0.01))).toBe(true);
      const mid: Obstacle = { id: 0, kind: "elang", x: DINO.x + 10, altitude: BIRD.altitude.mid, lane: "mid" };
      Object.assign(run, { ducking: true, lift: 10 }); // Duck held mid-drop: still the standing box.
      expect(collides(run, mid)).toBe(true);
    });

    it.each(GROUND)("ends the run on %s and stops scoring", (kind) => {
      const run = startRun(2); run.obstacles = [{ id: 50, kind, x: DINO.x + 20, altitude: 0 }];
      step(run);
      expect([run.phase, run.hit, run.tick]).toEqual(["over", kind, 1]);
      const saved = structuredClone(run); steps(run, 120);
      expect(run).toEqual(saved);
    });

    /** A bird whose centre reaches the dino's `seconds` from now. */
    function birdRun(lane: BirdLane, seconds: number) {
      const run = startRun(4);
      const x = DINO_MID - 23 + (speedAt(0) + BIRD.extraSpeed) * seconds;
      run.obstacles = [{ id: 60, kind: "elang", x, altitude: BIRD.altitude[lane], lane }];
      return run;
    }
    const passes = (run: Run) => { steps(run, 90); return run.phase === "running"; };

    it("kills a dino that jumps into a high bird but lets a standing or ducking one pass", () => {
      const jumping = birdRun("high", 0.2); applyInput(jumping, INPUT.jump);
      expect(passes(jumping)).toBe(false); expect(jumping.hit).toBe("elang");
      expect(passes(birdRun("high", 0.2))).toBe(true);
      const ducking = birdRun("high", 0.2); applyInput(ducking, INPUT.duck);
      expect(passes(ducking)).toBe(true);
    });

    it("lets a ducking dino under a mid bird, and a well-timed jump over it", () => {
      expect(passes(birdRun("mid", 0.3))).toBe(false);
      const ducking = birdRun("mid", 0.3); applyInput(ducking, INPUT.duck);
      expect(passes(ducking)).toBe(true);
      const jumping = birdRun("mid", 0.42); applyInput(jumping, INPUT.jump);
      expect(passes(jumping)).toBe(true);
      const low = birdRun("low", 0.3); applyInput(low, INPUT.duck);
      expect(passes(low)).toBe(false);
    });
  });

  describe("determinism and replay", () => {
    it("keeps the first five minutes identical to the pre-ramp engine", () => {
      // Recorded from the engine before the late-game ramp existed: every obstacle spawned before LATE.start for 60 seeds
      // (crashes ignored), the generator state at LATE.start, and 60 five-minute autopilot runs.
      expect(fingerprint()).toEqual({ generation: "a00d263b44a4b068", piloted: "ec1b6aad9b70b894" });
    }, 30_000);

    it("is plain data that clones and resumes identically", () => {
      const run = hourRun(99); pilot(run, 40 * TICK_RATE);
      expect(run.obstacles.some((obstacle) => obstacle.lead !== undefined)).toBe(true);
      const copies = [structuredClone(run), JSON.parse(JSON.stringify(run)) as Run, clone(run)];
      for (const copy of copies) expect(copy).toEqual(run);
      pilot(run, 20 * TICK_RATE);
      for (const copy of copies) { pilot(copy, 20 * TICK_RATE); expect(copy).toEqual(run); }
    });

    it("rebuilds a deep-equal run from the same seed and inputs, and replayRun agrees with the live crash", () => {
      for (const seed of seeds(12, 500)) {
        const live = startRun(seed);
        const log = pilot(live, 50 * TICK_RATE);
        expect(live.phase).toBe("running");
        while (live.phase === "running") step(live); // Hands off: the next obstacle ends it.
        const again = startRun(seed);
        for (let i = 0; again.tick < live.tick;) {
          while (log[i] === again.tick) { applyInput(again, log[i + 1] as InputCode); i += 2; }
          step(again);
        }
        expect(again).toEqual(live);
        expect(replayRun(seed, log, live.tick)).toEqual({ ok: true, crashed: true, tick: live.tick, score: scoreOf(live), hit: live.hit });
        expect(replayRun(seed, log, live.tick - 1)).toMatchObject({ ok: true, crashed: false, tick: live.tick - 1 });
      }
    });

    it("rejects malformed or impossible logs", () => {
      const live = startRun(8);
      const log = pilot(live, 20 * TICK_RATE);
      while (live.phase === "running") step(live);
      const end = live.tick;
      expect(replayRun(8, log, end)).toMatchObject({ ok: true, crashed: true });
      const cases: [number, number[], number, string][] = [
        [8, [...log, 5], end, "bad-length"],
        [8, Array.from({ length: LIMITS.maxInputNumbers + 2 }, (_, i) => (i % 2 ? 1 : 0)), end, "bad-length"],
        [8, [10, 1, 9, 3], end, "bad-tick"],
        [8, [-1, 1], end, "bad-tick"],
        [8, [1.5, 1], end, "bad-tick"],
        [8, [Number.NaN, 1], end, "bad-tick"],
        [8, [end, 1], end, "bad-tick"],
        [8, [0, 0], end, "bad-code"],
        [8, [0, 4], end, "bad-code"],
        [8, [0, 1.5], end, "bad-code"],
        [8, log, 0, "bad-end-tick"],
        [8, log, 2.5, "bad-end-tick"],
        [8, log, LIMITS.maxTicks + 1, "bad-end-tick"],
        [-1, log, end, "bad-seed"],
        [2 ** 32, log, end, "bad-seed"],
        [8, log, end + 1, "crashed-early"],
        [8, log.slice(0, -2), end, "crashed-early"],
      ];
      for (const [seed, inputs, endTick, reason] of cases) expect(replayRun(seed, inputs, endTick), reason).toEqual({ ok: false, reason });
    });

    it("replays a finished hour well inside Convex's 1 s mutation budget", () => {
      const live = startRun(424242);
      const log = pilot(live, LIMITS.maxTicks + 10);
      expect([live.phase, live.finished, live.tick]).toEqual(["over", true, LIMITS.maxTicks]);
      expect(log.length).toBeLessThan(LIMITS.maxInputNumbers);
      const started = performance.now();
      const result = replayRun(424242, log, LIMITS.maxTicks);
      const elapsed = performance.now() - started;
      console.info(`Bogor Run: 1-hour replay (${log.length / 2} inputs, score ${scoreOf(live)}) took ${elapsed.toFixed(0)} ms`);
      expect(result).toEqual({ ok: true, crashed: false, finished: true, tick: LIMITS.maxTicks, score: scoreOf(live), hit: null });
      expect(elapsed).toBeLessThan(1000);
      // Short of the line it is an ordinary unfinished replay.
      expect(replayRun(424242, log.filter((_, i) => log[i - (i % 2)] < LIMITS.maxTicks - 1), LIMITS.maxTicks - 1)).toEqual({
        ok: true, crashed: false, tick: LIMITS.maxTicks - 1, score: expect.any(Number), hit: null,
      });
    }, 30_000);

    it("uses only engine-independent math", () => {
      const source = readFileSync(new URL("./engine.ts", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      const used = new Set([...source.matchAll(/Math\.(\w+)/g)].map((match) => match[1]));
      for (const name of used) expect(["floor", "ceil", "round", "min", "max", "abs", "imul"]).toContain(name);
      expect(source).not.toMatch(/\*\*|Date\b|performance\.|crypto\.|Math\.random/);
    });
  });

  describe("generation", () => {
    const starts = seeds(40).map((seed) => track(startRun(seed), 150 * TICK_RATE));
    const pres = seeds(40, 2000).map((seed) => track(lateRun(seed, PRE_TICK), 50 * TICK_RATE));
    const fasts = seeds(40, 1000).map((seed) => track(fastRun(seed), 90 * TICK_RATE));
    const hours = seeds(40, 4000).map((seed) => track(hourRun(seed), 90 * TICK_RATE));
    const all = [...starts, ...pres, ...fasts, ...hours];

    it("starts with a ground obstacle ~600 ahead and spawns off-screen afterwards", () => {
      for (const { list } of starts) {
        expect(list[0]).toMatchObject({ spawnTick: 0, spawnX: FIELD.first });
        expect(GROUND).toContain(list[0].obstacle.kind);
      }
      for (const { list } of all) {
        for (const group of groupsOf(list).filter((group) => group[0].spawnTick > 0)) {
          // A cluster spawns whole, as soon as its last member fits inside the spawn line, and beyond the widest view.
          for (const entry of group) expect(entry.spawnX).toBeLessThanOrEqual(FIELD.spawn);
          expect(group.at(-1)!.spawnX).toBeGreaterThan(FIELD.spawn - 5);
          expect(group[0].spawnX).toBeGreaterThan(DINO.x + MAX_AHEAD);
        }
      }
    });

    it("unlocks birds at 300 points, flies all three lanes, and never repeats a kind three times", () => {
      const entries = all.flatMap(({ list }) => list);
      const birds = entries.filter((entry) => entry.obstacle.kind === "elang");
      for (const bird of birds) expect(bird.score).toBeGreaterThanOrEqual(BIRD.minScore);
      expect(starts.flatMap(({ list }) => list).filter((entry) => entry.score < BIRD.minScore).length).toBeGreaterThan(200);
      expect(new Set(birds.map((bird) => bird.obstacle.lane))).toEqual(new Set(["low", "mid", "high"]));
      expect(new Set(entries.map((entry) => entry.obstacle.kind))).toEqual(new Set([...GROUND, "elang"]));
      // About 30% of spawns are birds; a cluster is one spawn.
      const unlocked = entries.filter((entry) => entry.score >= BIRD.minScore && entry.obstacle.lead === undefined);
      expect(birds.length / unlocked.length).toBeGreaterThan(0.22);
      expect(birds.length / unlocked.length).toBeLessThan(0.36);
      for (const { list } of all) {
        for (let i = 2; i < list.length; i++) {
          const kinds = new Set([list[i - 2], list[i - 1], list[i]].map((entry) => entry.obstacle.kind));
          expect(kinds.size).toBeGreaterThan(1);
        }
      }
    });

    it("clusters ground obstacles only after five minutes, more of them as pressure rises", () => {
      const share = (runs: typeof all) => {
        const groups = runs.flatMap(({ list }) => groupsOf(list)).filter((group) => group[0].obstacle.kind !== "elang");
        return groups.filter((group) => group.length > 1).length / groups.length;
      };
      expect(share([...starts, ...pres])).toBe(0);
      expect(share(fasts)).toBeGreaterThan(0.3);
      expect(share(hours)).toBeGreaterThan(share(fasts));
      let triples = 0;
      for (const { list } of [...fasts, ...hours]) {
        for (const group of groupsOf(list).filter((group) => group.length > 1)) {
          triples += group.length === 3 ? 1 : 0;
          expect(group.length).toBeLessThanOrEqual(3);
          group.forEach((entry, i) => {
            expect(entry.obstacle).toMatchObject({ id: group[0].obstacle.id + i, altitude: 0, ...(i > 0 && { lead: group[0].obstacle.id }) });
            expect(GROUND).toContain(entry.obstacle.kind);
            expect(entry.spawnTick).toBe(group[0].spawnTick);
            if (i === 0) return;
            const inner = entry.spawnX - group[i - 1].spawnX - OBSTACLES[group[i - 1].obstacle.kind].width;
            expect(inner).toBeGreaterThanOrEqual(LATE.inner[0] - 1e-9);
            expect(inner).toBeLessThanOrEqual(LATE.inner[1] + 1e-9);
          });
        }
      }
      expect(triples).toBeGreaterThan(20);
    });

    it("spaces arrivals by the airtime plus a reaction margin that tightens with speed, then with late-game pressure", () => {
      const gaps = (runs: typeof all, from = 0, until = Infinity) => runs.flatMap(({ list }) => {
        const centres = groupsOf(list).filter((group) => group[0].spawnTick >= from && group[0].spawnTick < until).map((group) => group[0].centre);
        return centres.slice(1).flatMap((centre, i) => (centre === undefined || centres[i] === undefined ? [] : [(centre - centres[i]!) / TICK_RATE]));
      });
      const air = trajectory.length / TICK_RATE;
      const early = Math.min(...gaps(starts, 0, 20 * TICK_RATE)), pre = Math.min(...gaps(pres));
      const fast = Math.min(...gaps(fasts)), hour = Math.min(...gaps(hours));
      expect(early).toBeGreaterThan(air + 0.6);
      expect(pre).toBeGreaterThanOrEqual(air + 0.22);
      expect(pre).toBeLessThan(early);
      expect(fast).toBeGreaterThanOrEqual(air + 0.1);
      expect(hour).toBeGreaterThanOrEqual(air + 0.06);
      expect(hour).toBeLessThan(pre);
    });

    it("never lets a high bird cross a takeoff or landing that a neighbour forces", () => {
      let checked = 0;
      for (const { list } of all) {
        const groups = groupsOf(list);
        groups.forEach(([bird], i) => {
          if (bird.obstacle.lane !== "high" || bird.enter === undefined || bird.exit === undefined) return;
          for (const neighbour of [groups[i - 1], groups[i + 1]]) {
            const first = neighbour?.[0], last = neighbour?.at(-1);
            if (!first || !last || first.enter === undefined || last.exit === undefined || ["mid", "high"].includes(first.obstacle.lane ?? "")) continue;
            // Every takeoff that clears the neighbour (a whole cluster in one jump), and the flight after it, must miss the bird's crossing.
            const need = Math.max(...neighbour.map(({ obstacle }) => obstacle.altitude + HITBOX[obstacle.kind][3] - HITBOX.stand[2]));
            const up = trajectory.findIndex((lift) => lift >= need) + 1, down = trajectory.findLastIndex((lift) => lift >= need) + 1;
            const earliest = last.exit + 1 - down, latestLanding = first.enter + 1 - up + trajectory.length - 1;
            expect(bird.exit < earliest || bird.enter > latestLanding).toBe(true);
            checked++;
          }
        });
      }
      expect(checked).toBeGreaterThan(100);
    });
  });

  describe("fairness", () => {
    it.each([
      ["from the start", (seed: number) => startRun(seed), 0],
      ["at near-max speed", fastRun, 7000],
      ["in the last minutes before the finish line", hourRun, 9000],
    ] as const)("a search solver clears 25 consecutive obstacles %s for 150 seeds", (label, begin, salt) => {
      const lanes = new Map<string, number>();
      let worst = 0, clustered = 0;
      for (const seed of seeds(150, salt)) {
        const run = begin(seed);
        const first = run.obstacles[0]?.id ?? run.next.id;
        const solution = solve(run, first + 24);
        expect(solution, `seed ${seed}`).not.toBeNull();
        const { log, end, obstacles, nodes } = solution!;
        worst = Math.max(worst, nodes);
        expect(obstacles.map((obstacle) => obstacle.id)).toEqual(Array.from({ length: 25 }, (_, i) => first + i));
        for (const obstacle of obstacles) if (obstacle.lane) lanes.set(obstacle.lane, (lanes.get(obstacle.lane) ?? 0) + 1);
        clustered += obstacles.filter((obstacle) => obstacle.lead !== undefined).length;
        if (salt === 0) expect(replayRun(seed, log, end.tick), `seed ${seed}`).toEqual({ ok: true, crashed: false, tick: end.tick, score: scoreOf(end), hit: null });
      }
      console.info(`Bogor Run solver ${label}: birds per lane ${JSON.stringify(Object.fromEntries(lanes))}, cluster followers ${clustered}, worst search ${worst} nodes`);
      for (const lane of ["low", "mid", "high"]) expect(lanes.get(lane) ?? 0).toBeGreaterThan(20);
      if (salt) expect(clustered).toBeGreaterThan(300);
    }, 120_000);

    it("finds nothing when obstacles are packed tighter than any jump allows", () => {
      const run = startRun(11);
      run.obstacles = [0, 1, 2].map((i) => ({ id: 100 + i, kind: "angkot" as const, x: 300 + i * 70, altitude: 0 }));
      run.next = { ...run.next, id: 103 };
      expect(solve(run, 102)).toBeNull();
    });

    it("leaves every late-game jump at least 100 ms of timing and never needs a fast-drop between two jumps", () => {
      const widths: Record<string, number[]> = {};
      let pairs = 0;
      for (const [tick, salt] of [[LATE.start + 5 * 60 * TICK_RATE, 100], [FAST_TICK, 200], [HOUR_TICK, 300]] as const) {
        for (const seed of seeds(16, salt)) {
          const groups = jumpWindows(seed, tick, 60);
          groups.forEach(({ members, valid }, i) => {
            if (!valid) return;
            const kind = members.length > 1 ? "cluster" : members[0].obstacle.kind === "elang" ? "low bird" : "ground";
            (widths[kind] ??= []).push(valid.length);
            expect(valid.length, `seed ${seed} obstacle ${members[0].obstacle.id}`).toBeGreaterThanOrEqual(12);
            // Two jumps in a row: the latest takeoff that clears this group comes after landing from the earliest one for the previous.
            const previous = groups[i - 1]?.valid;
            if (!previous) return;
            expect(valid.at(-1)! - (previous[0] + trajectory.length), `seed ${seed} obstacle ${members[0].obstacle.id}`).toBeGreaterThanOrEqual(0);
            pairs++;
          });
        }
      }
      const summary = Object.fromEntries(Object.entries(widths).map(([kind, list]) => [kind, `${list.length} × ≥${Math.min(...list)} ticks`]));
      console.info(`Bogor Run late-game jump windows: ${JSON.stringify(summary)}, ${pairs} back-to-back pairs`);
      expect(widths.cluster.length).toBeGreaterThan(200);
      expect(Math.min(...widths.cluster)).toBeLessThan(20); // The ramp really does tighten.
    }, 60_000);

    it.each([
      ["from the start", (seed: number) => startRun(seed), 0],
      ["at near-max speed", fastRun, 3000],
      ["up to the finish line", hourRun, 5000],
    ] as const)("the autopilot survives 90 s %s", (_, begin, salt) => {
      for (const seed of seeds(60, salt)) {
        const run = begin(seed);
        pilot(run, 90 * TICK_RATE);
        expect(run.phase, `seed ${seed} hit ${run.hit} at ${run.tick}`).toBe("running");
      }
    }, 30_000);

    it("lets the demo autopilot play whole hours to the finish line", () => {
      for (const seed of seeds(4, 6000)) {
        const run = startRun(seed);
        pilot(run, LIMITS.maxTicks + 10);
        expect([run.phase, run.finished, run.hit], `seed ${seed} at ${run.tick}`).toEqual(["over", true, null]);
      }
    }, 30_000);
  });

  it("validates the browser's stored record", () => {
    expect(readBest("157")).toBe(157);
    for (const stored of [null, "broken", "-1", "Infinity", "1.5", "1000001"]) expect(readBest(stored)).toBe(0);
  });
});
