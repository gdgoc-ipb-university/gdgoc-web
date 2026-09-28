export const WORLD = { width: 480, height: 230, ground: 176 } as const;
export const DINO = { x: 52, width: 40, height: 46 } as const;
export const OBSTACLES = {
  angkot: { width: 64, height: 40, label: "Angkot duluan!" },
  talas: { width: 34, height: 44, label: "Ada talas di jalan!" },
  genangan: { width: 52, height: 14, label: "Yah, masuk genangan!" },
} as const;
export type ObstacleKind = keyof typeof OBSTACLES;
export type Phase = "idle" | "running" | "paused" | "over";
export type Obstacle = { id: number; kind: ObstacleKind; x: number };
export type Run = {
  phase: Phase; distance: number; time: number; lift: number; velocity: number;
  spawnIn: number; sequence: number; obstacles: Obstacle[]; hit: ObstacleKind | null;
};

export function createRun(): Run {
  return { phase: "idle", distance: 0, time: 0, lift: 0, velocity: 0, spawnIn: 0, sequence: 0, obstacles: [], hit: null };
}

export function startRun(): Run {
  return { ...createRun(), phase: "running", spawnIn: 2.1, sequence: 1, obstacles: [{ id: 0, kind: "angkot", x: WORLD.width + 24 }] };
}

export function jump(run: Run) {
  if (run.phase === "running" && run.lift === 0) run.velocity = 500;
}

export function scoreOf(run: Run) { return Math.floor(run.distance / 10); }
export function speedOf(run: Run) { return Math.min(270, 174 + run.time * 1.9); }

function collides(run: Run, obstacle: Obstacle) {
  const shape = OBSTACLES[obstacle.kind];
  // Inset silhouettes make the tail, leaf tips, and puddle splash forgiving.
  return DINO.x + 9 < obstacle.x + shape.width - 5
    && DINO.x + DINO.width - 5 > obstacle.x + 5
    && WORLD.ground - run.lift - 3 > WORLD.ground - shape.height + 6;
}

/** Fixed small steps prevent a slow frame from tunneling through an obstacle. */
export function advanceRun(run: Run, seconds: number, random: () => number = Math.random) {
  if (run.phase !== "running" || !Number.isFinite(seconds) || seconds <= 0) return;
  let remaining = Math.min(seconds, 0.1);
  while (remaining > 0 && run.phase === "running") {
    const dt = Math.min(remaining, 1 / 120);
    remaining -= dt;
    run.time += dt;
    const speed = speedOf(run);
    run.distance += speed * dt;
    run.lift = Math.max(0, run.lift + run.velocity * dt);
    run.velocity = run.lift > 0 ? run.velocity - 1200 * dt : 0;
    run.spawnIn -= dt;
    if (run.spawnIn <= 0) {
      const kinds: ObstacleKind[] = ["angkot", "talas", "genangan"];
      const kind = kinds[run.sequence % kinds.length];
      run.obstacles.push({ id: run.sequence++, kind, x: WORLD.width + 24 });
      // Even at top speed, leave time to land and make the next jump.
      run.spawnIn = 1.65 + Math.max(0, Math.min(1, random())) * 0.55;
    }
    for (const obstacle of run.obstacles) {
      obstacle.x -= speed * dt;
      if (collides(run, obstacle)) { run.phase = "over"; run.hit = obstacle.kind; break; }
    }
    run.obstacles = run.obstacles.filter((obstacle) => obstacle.x + OBSTACLES[obstacle.kind].width > -8);
  }
}

export const BEST_KEY = "gdgoc:bogor-run:best:v1";
export function readBest(value: string | null) {
  const score = Number(value);
  return Number.isSafeInteger(score) && score > 0 && score <= 1_000_000 ? score : 0;
}
