/**
 * Bogor Run's simulation, shared by the browser and the Convex score replay. Both must reach bit-identical states,
 * so it advances in fixed ticks, keeps its PRNG state on the Run, spawns in world space (never screen space) and uses
 * only + - * /, comparisons, bit operations and the exactly specified Math.floor/round/min/max/imul.
 */
export const TICK_RATE = 120;
export const WORLD = { width: 480, height: 230, ground: 176 } as const;
export const DINO = { x: 52, width: 44, height: 47, duckWidth: 59, duckHeight: 25 } as const;
export type ObstacleKind = "angkot" | "talas" | "genangan" | "elang";
export const OBSTACLES = {
  angkot: { width: 64, height: 40, label: "Angkot duluan!" },
  talas: { width: 34, height: 44, label: "Ada talas di jalan!" },
  genangan: { width: 52, height: 14, label: "Yah, masuk genangan!" },
  elang: { width: 46, height: 40, label: "Disambar elang jawa!" },
} as const satisfies Record<ObstacleKind, { width: number; height: number; label: string }>;
export type BirdLane = "low" | "mid" | "high";
export const BIRD = { minScore: 300, extraSpeed: 40, chance: 0.3, altitude: { low: 10, mid: 26, high: 50 } } as const;
/**
 * `x` is the sprite's left edge in world units (the dino's is DINO.x); `altitude` is the sprite's bottom above the ground.
 * `lead` marks a late-game cluster member with the id of the cluster's first obstacle: one jump clears the whole cluster.
 */
export type Obstacle = { id: number; kind: ObstacleKind; x: number; altitude: number; lane?: BirdLane; lead?: number };
export const INPUT = { jump: 1, duck: 2, stand: 3 } as const;
export type InputCode = 1 | 2 | 3;
export type Phase = "idle" | "running" | "paused" | "over";
/** A run that survives `maxTicks` (1 hour) ends there as finished: phase "over", `finished` true, no hit. */
export const LIMITS = { maxTicks: 432_000 /* 1 hour */, maxInputNumbers: 20_000 } as const;
/**
 * Bump with every change to physics or generation. A run replays only on the engine it was played on, so the server
 * turns away tickets and scores from another version (OUTDATED) rather than failing their replay as INVALID. The
 * "pins this engine version" test in engine.test.ts holds the current version's fingerprint and fails until it is bumped.
 */
export const ENGINE_VERSION = 1;
export const PHYSICS = { jump: 500, gravity: 1200, dropGravity: 3600 } as const;
/** Speed rises for the whole run but only approaches `max`: start + (max - start) * t / (t + ramp), t in seconds. */
export const SPEED = { start: 174, max: 400, ramp: 75 } as const;
/** The widest view shows ~1120 units ahead and the demo view ~500 behind, so spawns never pop in on screen. */
export const FIELD = { first: DINO.x + 600, spawn: DINO.x + 1400, despawn: DINO.x - 600 } as const;
/** [left, right, bottom, top] from the sprite's left edge and bottom; trimmed silhouettes forgive tails, leaf tips and splashes. */
export const HITBOX = {
  stand: [9, 39, 3, 44], duck: [5, 54, 2, 22],
  angkot: [5, 59, 0, 34], talas: [5, 29, 0, 38], genangan: [5, 47, 0, 8], elang: [6, 40, 8, 32],
} as const;
/** Centre-to-centre arrival spacing in seconds: airtime + a reaction margin that tightens with speed + seeded slack. */
const GAP = { margin: 0.24, slowMargin: 0.6, slack: 0.25, slowSlack: 0.35 } as const;
/**
 * Speed has all but levelled off by five minutes, so from `start` a pressure (pressureAt) keeps the course tightening
 * for the rest of the run: it shrinks the spacing margin by up to `margin` s and the slack by up to `slack` of itself,
 * and turns a growing share of ground obstacles (up to `cluster`, a `triple` of those three long) into clusters that
 * one jump must clear. A cluster is packed (`inner` units between sprites) so its jump window is at least ±`tolerance[0]`
 * s; that floor, and the widest gap allowed, move `tight` times as fast as pressure, so from ≈12 min some clusters are
 * as tight as ±`tolerance[1]` s. Tuned with the gameplay review's human-like bot (median crash ≈22 min at 1440 px).
 * Before `start` nothing here draws a random number, so early runs are unchanged.
 */
export const LATE = {
  start: 36_000, ramp: 72_000, margin: 0.2, slack: 0.8, cluster: 0.9, triple: 0.6, tolerance: [0.09, 0.05], tight: 2.5, inner: [8, 48],
} as const;
const AIR_TIME = 2 * PHYSICS.jump / PHYSICS.gravity;
const DINO_MID = DINO.x + (HITBOX.stand[0] + HITBOX.stand[1]) / 2;
const GROUND_KINDS = ["angkot", "talas", "genangan"] as const;
const LANES = ["low", "mid", "high"] as const;
/** Lift after each tick of an undisturbed jump, computed with step()'s own arithmetic. */
const ARC = (() => {
  const lifts: number[] = [];
  for (let lift = 0, velocity: number = PHYSICS.jump; lifts.length === 0 || lift > 0;) {
    lift = Math.max(0, Math.round(lift * TICK_RATE) + velocity) / TICK_RATE;
    velocity -= PHYSICS.gravity / TICK_RATE;
    lifts.push(lift);
  }
  return lifts;
})();

export type Run = {
  phase: Phase; seed: number; rng: number; tick: number; distance: number;
  /** Feet above the ground and vertical speed, in world units (up is positive). */
  lift: number; velocity: number;
  /** `ducking`: the duck input is held, so the dino ducks whenever it is grounded. `dropping`: a fast-drop is under way. */
  ducking: boolean; dropping: boolean;
  obstacles: Obstacle[]; hit: ObstacleKind | null;
  /** The pre-rolled next obstacle (x is set at spawn), its spacing slack, and the current same-kind streak. */
  next: Obstacle; slack: number; lastKind: ObstacleKind | null; repeat: number;
  /** Cluster members pre-rolled behind `next` (x is the offset from its x), and how far the last placed obstacle's centre
   * sits behind its cluster's middle (the middle of the cluster's hitbox span); spacing runs from middle to middle. */
  group: Obstacle[]; back: number;
  /** True once the run reached LIMITS.maxTicks without crashing. */
  finished: boolean;
};

export function createRun(): Run {
  return {
    phase: "idle", seed: 0, rng: 0, tick: 0, distance: 0, lift: 0, velocity: 0, ducking: false, dropping: false,
    obstacles: [], hit: null, next: { id: 0, kind: "angkot", x: 0, altitude: 0 }, slack: 0, lastKind: null, repeat: 0,
    group: [], back: 0, finished: false,
  };
}

export function startRun(seed: number): Run {
  const run: Run = { ...createRun(), phase: "running", seed: seed >>> 0, rng: seed | 0 };
  run.next = roll(run, 0);
  run.slack = random(run);
  place(run, FIELD.first);
  spawn(run, speedAt(0));
  return run;
}

export function speedAt(tick: number) {
  return SPEED.start + (SPEED.max - SPEED.start) * tick / (tick + SPEED.ramp * TICK_RATE);
}
export function speedOf(run: Run) { return speedAt(run.tick); }
/** Late-game pressure: 0 until LATE.start (5 min), then rising for the rest of the run like speed does, never reaching 1 (½ at 15 min, ≈0.85 at the hour). */
export function pressureAt(tick: number) { return tick <= LATE.start ? 0 : (tick - LATE.start) / (tick - LATE.start + LATE.ramp); }
export function scoreOf(run: Run) { return Math.floor(run.distance / 10); }
export function poseOf(run: Run): "run" | "duck" | "air" { return run.lift > 0 ? "air" : run.ducking ? "duck" : "run"; }

/** Applies one input between ticks. Returns false when it changed nothing, so callers can leave it out of the replay log. */
export function applyInput(run: Run, code: InputCode): boolean {
  if (run.phase !== "running") return false;
  if (code === INPUT.jump) {
    // A held or repeated jump never restarts a flight, and a crouch must be released first (as in Chrome).
    if (run.lift > 0 || run.velocity !== 0 || run.ducking) return false;
    run.velocity = PHYSICS.jump;
  } else if (code === INPUT.duck) {
    if (run.ducking) return false;
    run.ducking = true;
    run.dropping = run.lift > 0; // In the air a duck fast-drops; on the ground it cancels a jump pressed this same tick.
    run.velocity = Math.min(run.velocity, 0);
  } else {
    if (!run.ducking) return false;
    run.ducking = false; // A fast-drop already under way keeps going.
  }
  return true;
}

/** Simulates tick `run.tick`, then advances it (also on the crashing tick). Reaching LIMITS.maxTicks finishes the run. */
export function step(run: Run) {
  if (run.phase !== "running") return;
  const speed = speedAt(run.tick);
  run.distance += speed / TICK_RATE;
  if (run.lift > 0 || run.velocity > 0) {
    // Velocities stay whole numbers, so keeping lift on the 1/TICK_RATE grid lands jumps exactly, with no float residue.
    run.lift = Math.max(0, Math.round(run.lift * TICK_RATE) + run.velocity) / TICK_RATE;
    run.velocity = run.lift > 0 ? run.velocity - (run.dropping ? PHYSICS.dropGravity : PHYSICS.gravity) / TICK_RATE : 0;
    if (run.lift === 0) run.dropping = false;
  }
  const ground = speed / TICK_RATE, bird = (speed + BIRD.extraSpeed) / TICK_RATE;
  for (const obstacle of run.obstacles) obstacle.x -= obstacle.kind === "elang" ? bird : ground;
  // Arrival order is spawn order and gaps outlast a bird's overtaking, so the oldest obstacle leaves first.
  while (run.obstacles.length && run.obstacles[0].x < FIELD.despawn) run.obstacles.shift();
  spawn(run, speed);
  for (const obstacle of run.obstacles) {
    // Only obstacles within the dino's reach (no sprite is wider than 64) are tested, which keeps hour-long replays cheap.
    if (obstacle.x < DINO.x + DINO.duckWidth && obstacle.x > DINO.x - 64 && collides(run, obstacle)) { run.phase = "over"; run.hit = obstacle.kind; break; }
  }
  run.tick += 1;
  if (run.tick >= LIMITS.maxTicks && run.phase === "running") { run.phase = "over"; run.finished = true; }
}

/** Axis-aligned hitboxes; touching edges do not collide. Ducking only counts on the ground. */
export function collides(run: Run, obstacle: Obstacle) {
  const dino = run.ducking && run.lift === 0 ? HITBOX.duck : HITBOX.stand, box = boxOf(obstacle.kind);
  return DINO.x + dino[0] < obstacle.x + box[1] && DINO.x + dino[1] > obstacle.x + box[0]
    && run.lift + dino[2] < obstacle.altitude + box[3] && run.lift + dino[3] > obstacle.altitude + box[2];
}

// Comparisons beat a keyed HITBOX[kind] lookup by a third of a 1-hour replay's runtime.
function boxOf(kind: ObstacleKind) { return kind === "elang" ? HITBOX.elang : kind === "angkot" ? HITBOX.angkot : kind === "talas" ? HITBOX.talas : HITBOX.genangan; }
function middleOf(kind: ObstacleKind) { const box = boxOf(kind); return (box[0] + box[1]) / 2; }
function velocityOf(kind: ObstacleKind, speed: number) { return kind === "elang" ? speed + BIRD.extraSpeed : speed; }

/** mulberry32: 32-bit integer state on the Run, so clones and replays continue the same sequence. */
function random(run: Run) {
  let t = run.rng = (run.rng + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function roll(run: Run, id: number): Obstacle {
  const banned = run.repeat >= 2 ? run.lastKind : null;
  if (banned !== "elang" && scoreOf(run) >= BIRD.minScore && random(run) < BIRD.chance) {
    const lane = LANES[Math.floor(random(run) * LANES.length)];
    return { id, kind: "elang", x: 0, altitude: BIRD.altitude[lane], lane };
  }
  const kinds = GROUND_KINDS.filter((kind) => kind !== banned);
  return { id, kind: kinds[Math.floor(random(run) * kinds.length)], x: 0, altitude: 0 };
}

/** Places `next` with its cluster at x, then pre-rolls the obstacle after it. */
function place(run: Run, x: number) {
  for (const member of [run.next, ...run.group]) {
    const obstacle = { ...member, x: x + member.x };
    run.obstacles.push(obstacle);
    run.repeat = obstacle.kind === run.lastKind ? run.repeat + 1 : 1;
    run.lastKind = obstacle.kind;
  }
  const last = run.obstacles[run.obstacles.length - 1];
  run.back = run.group.length ? last.x + middleOf(last.kind) - (x + boxOf(run.next.kind)[0] + last.x + boxOf(last.kind)[1]) / 2 : 0;
  run.next = roll(run, last.id + 1);
  run.slack = random(run);
  run.group = run.next.kind !== "elang" && pressureAt(run.tick) > 0 ? cluster(run) : [];
}

/**
 * Late game: sometimes turns the pre-rolled ground obstacle into the leader of a 2–3 obstacle cluster. The members are
 * packed so that, at the current speed (arrival is never slower, and faster only widens it), a single jump that clears
 * the tallest member over the whole cluster has a window of at least ±`tolerance` s, which pressure lowers at random.
 */
function cluster(run: Run): Obstacle[] {
  const pressure = pressureAt(run.tick);
  if (random(run) >= LATE.cluster * pressure) return [];
  const size = random(run) < LATE.triple * pressure ? 3 : 2;
  const tolerance = LATE.tolerance[0] - (LATE.tolerance[0] - LATE.tolerance[1]) * Math.min(1, LATE.tight * pressure) * random(run);
  const kinds: ObstacleKind[] = [run.next.kind];
  for (let repeat = run.next.kind === run.lastKind ? run.repeat + 1 : 1; kinds.length < size;) {
    const last = kinds[kinds.length - 1], options = GROUND_KINDS.filter((kind) => repeat < 2 || kind !== last);
    const kind = options[Math.floor(random(run) * options.length)];
    repeat = kind === last ? repeat + 1 : 1;
    kinds.push(kind);
  }
  const speed = speedAt(run.tick), standWidth = HITBOX.stand[1] - HITBOX.stand[0];
  for (; kinds.length > 1; kinds.pop()) {
    let clear = 0, widths = 0;
    for (const kind of kinds) clear = Math.max(clear, boxOf(kind)[3] - HITBOX.stand[2]);
    for (let i = 0; i < kinds.length - 1; i++) widths += OBSTACLES[kinds[i]].width;
    let above = 0;
    for (const lift of ARC) if (lift >= clear) above++;
    // The hitbox span the jump may overlap, less the sprites themselves, shared between the gaps.
    const span = (above / TICK_RATE - 2 * tolerance) * speed - standWidth;
    const inner = (span - boxOf(kinds[kinds.length - 1])[1] + boxOf(kinds[0])[0] - widths) / (kinds.length - 1);
    if (inner < LATE.inner[0]) continue;
    // Early clusters stay compact, so a short view shows them whole sooner; they may spread out as pressure rises.
    const gap = Math.min(inner, LATE.inner[0] + (LATE.inner[1] - LATE.inner[0]) * Math.min(1, LATE.tight * pressure)), group: Obstacle[] = [];
    for (let i = 1, offset = 0; i < kinds.length; i++) {
      offset += OBSTACLES[kinds[i - 1]].width + gap;
      group.push({ id: run.next.id + i, kind: kinds[i], x: offset, altitude: 0, lead: run.next.id });
    }
    return group;
  }
  return [];
}

/**
 * Spawns the pending obstacle (with its cluster) once its planned x lets the whole cluster fit inside the spawn line:
 * the x at which the cluster's middle reaches the dino's `gap` seconds after the previous cluster's middle (a single
 * obstacle is its own cluster). Speed only rises, so sizing the gap at the speed expected on arrival never lets the
 * real gap shrink, and a gap this wide also keeps high birds clear of every takeoff and landing that their neighbours force.
 */
function spawn(run: Run, speed: number) {
  for (;;) {
    // Length checks first: reading index -1 of an empty array is a slow property lookup, and this runs every tick.
    const last = run.obstacles.length ? run.obstacles[run.obstacles.length - 1] : undefined, end = run.group.length ? run.group[run.group.length - 1] : undefined;
    // A cluster's middle is the middle of its whole hitbox span, which is where one jump's apex belongs.
    const span = end ? end.x : 0, half = end ? (end.x + boxOf(end.kind)[1] - boxOf(run.next.kind)[0]) / 2 - middleOf(run.next.kind) : 0;
    let x: number = FIELD.spawn - span;
    if (last) {
      const arrival = speedAt(run.tick + (FIELD.spawn - DINO_MID) / speed * TICK_RATE);
      const slow = (SPEED.max - arrival) / (SPEED.max - SPEED.start), pressure = pressureAt(run.tick);
      const gap = AIR_TIME + (GAP.margin - LATE.margin * pressure) + GAP.slowMargin * slow
        + run.slack * (GAP.slack * (1 - LATE.slack * pressure) + GAP.slowSlack * slow);
      const lastIn = (last.x + middleOf(last.kind) - run.back - DINO_MID) / velocityOf(last.kind, arrival);
      x = DINO_MID + (lastIn + gap) * velocityOf(run.next.kind, arrival) - middleOf(run.next.kind) - half;
    }
    if (last && x + span > FIELD.spawn) return;
    place(run, x);
  }
}

/**
 * The demo's decision for the upcoming tick: apply the returned inputs, then step. It jumps so the apex meets the
 * next ground obstacle, cluster middle or low bird, ducks under mid birds, and ignores high birds, which pass over a
 * grounded dino.
 */
export function autopilot(run: Run): InputCode[] {
  if (run.phase !== "running") return [];
  const index = run.obstacles.findIndex((obstacle) => obstacle.lane !== "high" && obstacle.x + boxOf(obstacle.kind)[1] > DINO.x + HITBOX.stand[0]);
  if (index < 0) return run.ducking ? [INPUT.stand] : [];
  const next = run.obstacles[index];
  const speed = velocityOf(next.kind, speedOf(run));
  if (next.lane === "mid") {
    // A quarter second early, so a dino still in the air fast-drops before the crouch has to hold.
    const reach = (next.x + HITBOX.elang[0] - DINO.x - HITBOX.duck[1]) / speed;
    return reach < 0.25 && !run.ducking ? [INPUT.duck] : [];
  }
  let end = next;
  for (let i = index + 1; i < run.obstacles.length && run.obstacles[i].lead === (next.lead ?? next.id); i++) end = run.obstacles[i];
  const middle = end === next ? next.x + middleOf(next.kind) : (next.x + boxOf(next.kind)[0] + end.x + boxOf(end.kind)[1]) / 2;
  const inputs: InputCode[] = run.ducking ? [INPUT.stand] : [];
  if ((middle - DINO_MID) / speed <= AIR_TIME / 2 && run.lift === 0 && run.velocity === 0) inputs.push(INPUT.jump);
  return inputs;
}

/** `finished` is present (true) only when the run reached LIMITS.maxTicks without crashing. */
export type ReplayResult =
  | { ok: true; crashed: boolean; finished?: true; tick: number; score: number; hit: ObstacleKind | null }
  | { ok: false; reason: string };

/**
 * Re-simulates a recorded run: before step i it applies every input logged at tick i, in order. `inputs` is a flat
 * [tick, code, ...] list; a run that crashes before `endTick` is rejected, and `crashed` is true only for a crash on the
 * last step. A run replayed to LIMITS.maxTicks without a crash comes back `finished`.
 */
export function replayRun(seed: number, inputs: readonly number[], endTick: number): ReplayResult {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return { ok: false, reason: "bad-seed" };
  if (!Number.isInteger(endTick) || endTick < 1 || endTick > LIMITS.maxTicks) return { ok: false, reason: "bad-end-tick" };
  if (!Array.isArray(inputs) || inputs.length % 2 || inputs.length > LIMITS.maxInputNumbers) return { ok: false, reason: "bad-length" };
  for (let i = 0; i < inputs.length; i += 2) {
    const tick = inputs[i], code = inputs[i + 1];
    if (!Number.isInteger(tick) || tick < 0 || tick >= endTick || (i > 0 && tick < inputs[i - 2])) return { ok: false, reason: "bad-tick" };
    if (code !== INPUT.jump && code !== INPUT.duck && code !== INPUT.stand) return { ok: false, reason: "bad-code" };
  }
  const run = startRun(seed);
  for (let i = 0; run.tick < endTick;) {
    while (i < inputs.length && inputs[i] === run.tick) { applyInput(run, inputs[i + 1] as InputCode); i += 2; }
    step(run);
    if (run.phase === "over" && run.tick < endTick) return { ok: false, reason: "crashed-early" };
  }
  return run.finished
    ? { ok: true, crashed: false, finished: true, tick: run.tick, score: scoreOf(run), hit: null }
    : { ok: true, crashed: run.phase === "over", tick: run.tick, score: scoreOf(run), hit: run.hit };
}

export const BEST_KEY = "gdgoc:bogor-run:best:v1";
export function readBest(value: string | null) {
  const score = Number(value);
  return Number.isSafeInteger(score) && score > 0 && score <= 1_000_000 ? score : 0;
}
