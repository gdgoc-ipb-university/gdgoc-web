import { advanceAutoplay, advanceRun, BEST_KEY, createRun, DINO, jump, OBSTACLES, readBest, scoreOf, startRun, type Phase } from "./engine";
import { getView } from "./view";

export type Snapshot = { phase: Phase; score: number; best: number; message: string; autoplay: boolean };
export type Runner = {
  action: () => void;
  togglePause: () => void;
  pause: () => void;
  leave: () => void;
  toggleAutoplay: () => void;
  setVisible: (visible: boolean) => void;
  setReduced: (reduced: boolean) => void;
  dispose: () => void;
};
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
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const [dino, angkot, talas, genangan] = await Promise.all(["dino", "angkot", "talas", "genangan"].map(loadImage));
  const sprites = { angkot, talas, genangan };
  let run = createRun();
  let width = 0;
  let height = 0;
  let demo = startRun();
  let best = 0;
  let reduced = initiallyReduced;
  let visible = false;
  let ambientPaused = false;
  let disposed = false;
  let frame = 0;
  let lastTime = 0;
  let lastPublish = 0;
  let entrance = 1;
  try { best = readBest(localStorage.getItem(BEST_KEY)); } catch { /* The game also works without storage. */ }

  const autoplay = () => run.phase === "idle" && !reduced && !ambientPaused && visible && !document.hidden;
  const moving = () => visible && !document.hidden && (run.phase === "running" || autoplay());

  function newRun(isDemo: boolean) {
    const view = getView(width, height, isDemo);
    return startRun(view.spawnX, view.despawnX);
  }

  function publish() {
    changed({ phase: run.phase, score: scoreOf(run), best, message: run.hit ? OBSTACLES[run.hit].label : "", autoplay: autoplay() });
  }

  function remember() {
    const score = scoreOf(run);
    if (score <= best) return;
    best = score;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* Private browsing may deny storage. */ }
  }

  function draw() {
    if (!ctx || disposed || !width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const idle = run.phase === "idle";
    const scene = idle ? demo : run;
    const view = getView(width, height, idle);
    if (!idle && entrance < 1) {
      const origin = getView(width, height, true);
      const progress = 1 - (1 - entrance) ** 3;
      view.x = origin.x + (view.x - origin.x) * progress;
      view.scale = origin.scale + (view.scale - origin.scale) * progress;
    }
    const { scale, x, ground } = view;
    const position = (worldX: number) => Math.round(x + (worldX - DINO.x) * scale);
    const travel = reduced ? 0 : Math.round(scene.distance * scale);
    ctx.fillStyle = "#aab887";
    for (let i = 0; i < Math.ceil(width / 180) + 1; i++) {
      const dashX = ((i * 180 - travel * 0.85) % (width + 180) + width + 180) % (width + 180) - 40;
      ctx.fillRect(dashX, ground + 10 + (i % 2) * 9, 12 + (i % 3) * 8, 2);
    }
    const lift = scene.lift * scale;
    ctx.fillStyle = "#637b4530";
    ctx.fillRect(Math.round(x + 3 * scale + lift * 0.04), Math.round(ground + 2), Math.max(10, DINO.width * scale - lift * 0.18), Math.max(3, scale));
    const spriteFrame = scene.phase === "over" ? 3 : !reduced && scene.phase === "running" && scene.lift === 0 ? 1 + Math.floor(scene.time * 12) % 2 : 0;
    ctx.drawImage(dino, spriteFrame * DINO.width, 0, DINO.width, DINO.height, Math.round(x), Math.round(ground - DINO.height * scale - lift), Math.round(DINO.width * scale), Math.round(DINO.height * scale));
    for (const obstacle of scene.obstacles) {
      const shape = OBSTACLES[obstacle.kind];
      const obstacleX = position(obstacle.x);
      if (obstacleX > width || obstacleX + shape.width * scale < 0) continue;
      // Fade the autonomous scenery under the copy's paper-colored mist.
      ctx.globalAlpha = idle && width > 760 ? Math.max(0, Math.min(1, (obstacleX - width * 0.35) / (width * 0.22))) : 1;
      ctx.drawImage(sprites[obstacle.kind], obstacleX, Math.round(ground - shape.height * scale), Math.round(shape.width * scale), Math.round(shape.height * scale));
      ctx.globalAlpha = 1;
    }
  }

  function tick(now: number) {
    frame = 0;
    if (disposed || !moving()) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;
    if (run.phase === "idle") {
      advanceAutoplay(demo, dt);
      if (demo.hit) demo = newRun(true);
    } else if (entrance < 1) {
      entrance = Math.min(1, entrance + dt / 0.65);
    } else {
      advanceRun(run, dt);
      if (run.hit) remember();
    }
    draw();
    if (run.hit || (run.phase === "running" && now - lastPublish > 120)) {
      lastPublish = now;
      publish();
    }
    if (moving()) frame = requestAnimationFrame(tick);
  }

  function schedule() {
    if (disposed) return;
    if (moving() && !frame) { lastTime = 0; frame = requestAnimationFrame(tick); }
    if (!moving() && frame) { cancelAnimationFrame(frame); frame = 0; }
  }

  function pause() {
    if (run.phase !== "running" || disposed) return;
    run.phase = "paused";
    remember(); schedule(); draw(); publish();
  }

  function action() {
    if (disposed) return;
    if (run.phase === "idle" || run.phase === "over") {
      entrance = run.phase === "idle" && !reduced ? 0 : 1;
      run = newRun(false);
    } else if (run.phase === "paused") run.phase = "running";
    else jump(run);
    schedule(); publish();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (width && Math.abs(width - rect.width) > 1) pause();
    width = rect.width; height = rect.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx!.imageSmoothingEnabled = false;
    const view = getView(width, height, false);
    run.spawnX = view.spawnX;
    run.despawnX = view.despawnX;
    demo = newRun(true);
    draw();
  }

  function visibility() { if (document.hidden) pause(); schedule(); publish(); }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("blur", pause);
  resize(); publish();
  return {
    action, pause,
    togglePause() { if (run.phase === "running") pause(); else if (run.phase === "paused") action(); },
    leave() { remember(); run = createRun(); entrance = 1; schedule(); draw(); publish(); },
    toggleAutoplay() { ambientPaused = !ambientPaused; schedule(); publish(); },
    setVisible(value) { visible = value; if (!value) pause(); schedule(); publish(); },
    setReduced(value) { reduced = value; if (value) entrance = 1; schedule(); draw(); publish(); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", pause);
    },
  };
}
