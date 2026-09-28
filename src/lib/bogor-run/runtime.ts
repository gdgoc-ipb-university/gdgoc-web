import { advanceRun, BEST_KEY, createRun, DINO, jump, OBSTACLES, readBest, scoreOf, startRun, WORLD, type Phase, type Run } from "./engine";

export type Snapshot = { phase: Phase; score: number; best: number; message: string };
export type Runner = { action: () => void; togglePause: () => void; pause: () => void; setReduced: (reduced: boolean) => void; dispose: () => void };
const base = "/games/bogor-run/";

function loadImage(name: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load Bogor Run ${name}`));
    image.src = `${base}${name}.svg`;
  });
}

export async function mountRunner(canvas: HTMLCanvasElement, changed: (value: Snapshot) => void, initiallyReduced: boolean): Promise<Runner> {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas unavailable");
  const [backdrop, dino, angkot, talas, genangan] = await Promise.all(["backdrop", "dino", "angkot", "talas", "genangan"].map(loadImage));
  const sprites = { angkot, talas, genangan };
  let run = createRun();
  let best = 0;
  let reduced = initiallyReduced;
  let disposed = false;
  let frame = 0;
  let lastTime = 0;
  let lastPublish = 0;
  try { best = readBest(localStorage.getItem(BEST_KEY)); } catch { /* The game also works without storage. */ }
  canvas.width = WORLD.width * 2;
  canvas.height = WORLD.height * 2;
  ctx.scale(2, 2);
  ctx.imageSmoothingEnabled = false;

  function publish() {
    changed({ phase: run.phase, score: scoreOf(run), best, message: run.hit ? OBSTACLES[run.hit].label : "" });
  }

  function remember() {
    const score = scoreOf(run);
    if (score <= best) return;
    best = score;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* Private browsing may deny storage. */ }
  }

  function draw() {
    if (!ctx || disposed) return;
    ctx.drawImage(backdrop, 0, 0, WORLD.width, WORLD.height);
    const travel = reduced ? 0 : Math.round(run.distance);
    ctx.fillStyle = "#b6bf9e";
    for (let i = 0; i < 8; i++) {
      const x = ((i * 78 - travel * 0.85) % 570 + 570) % 570 - 40;
      ctx.fillRect(x, WORLD.ground + 16 + (i % 3) * 9, 9 + (i % 2) * 11, 2);
    }
    const lift = Math.round(run.lift);
    ctx.fillStyle = "#5e775028";
    ctx.fillRect(DINO.x + 2 + lift * 0.08, WORLD.ground + 3, DINO.width - lift * 0.15, 3);
    const stride = !reduced && run.phase === "running" && run.lift === 0 ? Math.floor(run.time * 9) % 2 : 0;
    ctx.drawImage(dino, stride * 32, 0, 32, 36, DINO.x, WORLD.ground - DINO.height - lift, DINO.width, DINO.height);
    const obstacles: Run["obstacles"] = run.phase === "idle" ? [{ id: 0, kind: "angkot", x: 341 }, { id: 1, kind: "talas", x: 445 }] : run.obstacles;
    for (const obstacle of obstacles) {
      const shape = OBSTACLES[obstacle.kind];
      ctx.drawImage(sprites[obstacle.kind], Math.round(obstacle.x), WORLD.ground - shape.height, shape.width, shape.height);
    }
  }

  function tick(now: number) {
    frame = 0;
    if (disposed || run.phase !== "running") return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;
    advanceRun(run, dt);
    draw();
    if (run.hit !== null) { remember(); publish(); return; }
    if (now - lastPublish > 120) { lastPublish = now; publish(); }
    frame = requestAnimationFrame(tick);
  }

  function play() {
    lastTime = 0;
    publish();
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function pause() {
    if (run.phase !== "running" || disposed) return;
    run.phase = "paused";
    cancelAnimationFrame(frame); frame = 0;
    remember(); draw(); publish();
  }

  function action() {
    if (disposed) return;
    if (run.phase === "idle" || run.phase === "over") { run = startRun(); play(); }
    else if (run.phase === "paused") { run.phase = "running"; play(); }
    else jump(run);
  }

  function togglePause() {
    if (run.phase === "running") pause();
    else if (run.phase === "paused") action();
  }

  function visibility() { if (document.hidden) pause(); }
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("blur", pause);
  draw(); publish();
  return {
    action, togglePause, pause,
    setReduced(value) { reduced = value; draw(); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", pause);
    },
  };
}
