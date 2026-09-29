import {
  applyInput, autopilot, BEST_KEY, BIRD, createRun, DINO, INPUT, LIMITS, OBSTACLES, poseOf, readBest, replayRun, scoreOf,
  speedOf, startRun, step, TICK_RATE, type InputCode, type ObstacleKind, type Phase,
} from "./engine";
import { createSound, MILESTONE_EVERY, milestoneCrossed } from "./sound";
import { DINO_SHEET, ELANG_SHEET, type Frame } from "./sprites";
import { getView } from "./view";

export type Snapshot = {
  phase: Phase; score: number; best: number; message: string; autoplay: boolean;
  /** The milestone the HUD is flashing (0 when none); never set under reduced motion. */
  flash: number;
  sound: boolean;
  /** The run is over because it lasted the full hour (LIMITS.maxTicks), not because it crashed. */
  finished: boolean;
};
/**
 * A crashed or finished personal run, exactly as the server replays it. `token` is null for unranked runs, and then
 * `unranked` says why: no ticket had arrived when it started, or its input log outgrew what the server accepts.
 */
export type FinishedRun = { seed: number; token: string | null; inputs: number[]; endTick: number; score: number; unranked?: "ticket" | "log" };
export type Ticket = { seed: number; token: string };
export type RunnerOptions = {
  /** A fresh signed seed for the next run, or null when none is ready. */
  ticket?: () => Ticket | null;
  /**
   * True while a ticket is on its way. A run that starts without one holds its first tick for up to TICKET_WAIT until
   * it lands (a new run's seed can still be swapped then), and plays unranked on a local seed if it does not.
   */
  ticketPending?: () => boolean;
  finish?: (run: FinishedRun) => void;
};
/** What `action` did: started a new run, resumed a pause, pressed jump, or nothing (still loading, or right after a crash). */
export type ActionResult = "start" | "resume" | "jump" | null;
export type Runner = {
  action: () => ActionResult;
  duck: (down: boolean) => void;
  togglePause: () => void;
  pause: () => void;
  leave: () => void;
  toggleAutoplay: () => void;
  setVisible: (visible: boolean) => void;
  setReduced: (reduced: boolean) => void;
  /** Call from user gestures: browsers only start audio inside one. */
  unlock: () => void;
  setSound: (on: boolean) => void;
  /**
   * Signs a run that started without a ticket, while it is still on its first tick: nothing of the unranked seed has
   * been simulated yet (inputs on that tick do not depend on it), so swapping the seed is invisible. `take` is called
   * only when it can adopt.
   */
  adopt: (take: () => Ticket | null) => boolean;
  /** Re-simulates a crashed or finished run (e.g. after the sign-in round trip) and shows its end. False if it does not replay. */
  restore: (run: FinishedRun) => boolean;
  dispose: () => void;
};

const base = "/games/bogor-run/";
const STEP = 1 / TICK_RATE;
const EPSILON = 1e-7; // absorbs float drift so 60 Hz frames advance exactly two ticks each
const FLASH_TICKS = TICK_RATE; // Chrome-style score blink after each milestone
const DEMO_TICKS = 90 * TICK_RATE; // the backdrop demo restarts before it gets frantic
const RESTART_GUARD = 500; // ms after a crash in which a mashed jump does not restart the run, as in Chrome
const TICKET_WAIT = 1; // s a run without a ticket holds its first tick for one that is on its way
export const FINISH_MESSAGE = "Selesai! 1 jam penuh";
const GROUND: readonly ObstacleKind[] = ["angkot", "talas", "genangan"];

function loadImage(name: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load Bogor Run ${name}`));
    image.src = `${base}${name}.svg`;
  });
}

const randomSeed = () => Math.floor(Math.random() * 4294967296) >>> 0;

export async function mountRunner(canvas: HTMLCanvasElement, changed: (value: Snapshot) => void, initiallyReduced: boolean, options: RunnerOptions = {}): Promise<Runner> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const [dino, elang, ...ground] = await Promise.all(["dino", "elang", ...GROUND].map(loadImage));
  const sprites = Object.fromEntries(GROUND.map((kind, i) => [kind, ground[i]])) as Record<ObstacleKind, HTMLImageElement>;
  const sound = createSound();
  let run = createRun();
  let demo = startRun(randomSeed());
  let width = 0;
  let height = 0;
  let best = 0;
  let reduced = initiallyReduced;
  let visible = false;
  let ambientPaused = false;
  let disposed = false;
  let frame = 0;
  let lastTime = 0;
  let lastPublish = 0;
  let entrance = 1;
  // Fixed-step clock: leftover seconds and the lift before the last tick, for drawing between ticks.
  let acc = 0;
  let prevLift = 0;
  let travel = 0; // ground-mark offset carried across demo restarts
  // The personal run's replay log and ticket.
  let ticket: Ticket | null = null;
  let inputs: number[] = [];
  let overflow = false;
  let lastScore = 0;
  let flash = 0;
  let flashUntil = 0;
  let crashedAt = -Infinity;
  let hold = 0; // seconds of TICKET_WAIT left
  try { best = readBest(localStorage.getItem(BEST_KEY)); } catch { /* The game also works without storage. */ }

  const autoplay = () => run.phase === "idle" && !reduced && !ambientPaused && visible && !document.hidden;
  const moving = () => visible && !document.hidden && (run.phase === "running" || autoplay());

  function publish() {
    changed({
      phase: run.phase, score: scoreOf(run), best, message: run.finished ? FINISH_MESSAGE : run.hit ? OBSTACLES[run.hit].label : "",
      autoplay: autoplay(), flash: run.phase === "running" && run.tick < flashUntil ? flash : 0, sound: sound.enabled, finished: run.finished,
    });
  }

  function remember() {
    const score = scoreOf(run);
    if (score <= best) return;
    best = score;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* Private browsing may deny storage. */ }
  }

  /** Applies a player input and logs it for the replay only when it changed the run. */
  function input(code: InputCode) {
    if (!applyInput(run, code)) return;
    if (inputs.length < LIMITS.maxInputNumbers) inputs.push(run.tick, code);
    else overflow = true; // a log the server cannot accept makes the run unranked
  }

  function finish() {
    crashedAt = performance.now();
    remember();
    sound.play(run.finished ? "milestone" : "crash");
    const done: FinishedRun = { seed: run.seed, token: ticket && !overflow ? ticket.token : null, inputs: [...inputs], endTick: run.tick, score: scoreOf(run) };
    if (!done.token) done.unranked = ticket ? "log" : "ticket";
    options.finish?.(done);
  }

  function newDemo() {
    travel += demo.distance;
    demo = startRun(randomSeed());
  }

  function simulate(dt: number) {
    acc += dt;
    const scene = run.phase === "idle" ? demo : run;
    while (acc >= STEP - EPSILON && scene.phase === "running") {
      acc -= STEP;
      prevLift = scene.lift;
      if (scene === demo) {
        for (const code of autopilot(demo)) applyInput(demo, code);
        step(demo);
        if (demo.phase === "over") { newDemo(); prevLift = 0; }
        continue;
      }
      step(run);
      if (prevLift === 0 && run.lift > 0) sound.play("jump");
      const score = scoreOf(run);
      if (milestoneCrossed(lastScore, score)) {
        sound.play("milestone");
        if (!reduced) { flash = Math.floor(score / MILESTONE_EVERY) * MILESTONE_EVERY; flashUntil = run.tick + FLASH_TICKS; lastPublish = 0; }
      }
      lastScore = score;
      if (run.phase === "over") finish();
    }
    if (scene.phase !== "running") acc = 0;
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
    // Between ticks, draw where the run was `lag` seconds ago so motion stays smooth on any refresh rate.
    const live = scene.phase === "running" && (idle || entrance >= 1);
    const alpha = live ? Math.min(1, acc / STEP) : 1;
    const lag = (1 - alpha) * STEP;
    const speed = speedOf(scene);
    const position = (worldX: number) => Math.round(x + (worldX - DINO.x) * scale);
    const offset = reduced ? 0 : Math.round(((idle ? travel : 0) + scene.distance - speed * lag) * scale);
    ctx.fillStyle = "#aab887";
    for (let i = 0; i < Math.ceil(width / 180) + 1; i++) {
      const dashX = ((i * 180 - offset * 0.85) % (width + 180) + width + 180) % (width + 180) - 40;
      ctx.fillRect(dashX, ground + 10 + (i % 2) * 9, 12 + (i % 3) * 8, 2);
    }

    // A finished run stands tall; a crash while ducking keeps the crouch (its hitbox reached further forward).
    const pose = scene.phase !== "over" ? poseOf(scene) : scene.finished ? "idle" : scene.ducking && scene.lift === 0 ? "duckCrash" : "crash";
    const lift = (live ? prevLift + (scene.lift - prevLift) * alpha : scene.lift) * scale;
    const stride = Math.floor(scene.tick / 10) & 1; // legs swap 12 times a second
    const still = reduced || scene.phase !== "running";
    const body: Frame = pose === "crash" ? DINO_SHEET.frames.crash : pose === "duckCrash" ? DINO_SHEET.frames.duckCrash
      : pose === "duck" ? DINO_SHEET.frames.duck[still ? 0 : stride]
      : pose === "run" && !still ? DINO_SHEET.frames.run[stride] : DINO_SHEET.frames.idle;
    ctx.fillStyle = "#637b4530";
    ctx.fillRect(Math.round(x + 3 * scale + lift * 0.04), Math.round(ground + 2), Math.max(10, body.w * scale - lift * 0.18), Math.max(3, scale));
    drawFrame(dino, body, x, ground - lift, scale);

    const flap = reduced ? 0 : Math.floor(scene.tick / 20) & 1;
    for (const obstacle of scene.obstacles) {
      const shape = OBSTACLES[obstacle.kind];
      const bird = obstacle.kind === "elang";
      const left = position(obstacle.x + (bird ? speed + BIRD.extraSpeed : speed) * lag);
      if (left > width || left + shape.width * scale < 0) continue; // cull off-screen actors
      // Fade the autonomous scenery under the copy's paper-colored mist.
      ctx.globalAlpha = idle && width > 760 ? Math.max(0, Math.min(1, (left - width * 0.35) / (width * 0.22))) : 1;
      if (ctx.globalAlpha > 0) {
        if (bird) drawFrame(elang, ELANG_SHEET.frames.flap[flap], left, ground - obstacle.altitude * scale, scale);
        else ctx.drawImage(sprites[obstacle.kind], left, Math.round(ground - shape.height * scale), Math.round(shape.width * scale), Math.round(shape.height * scale));
      }
      ctx.globalAlpha = 1;
    }
  }

  /** Draws a sheet frame with its bottom-left corner at (left, bottom), one sheet pixel per world unit. */
  function drawFrame(image: HTMLImageElement, frame: Frame, left: number, bottom: number, scale: number) {
    const w = Math.round(frame.w * scale), h = Math.round(frame.h * scale);
    ctx!.drawImage(image, frame.x, frame.y, frame.w, frame.h, Math.round(left), Math.round(bottom) - h, w, h);
  }

  /** Restarts a long demo, before it gets frantic, at a moment with no obstacle on screen, so the swap never pops. */
  function refreshDemo() {
    if (demo.tick < DEMO_TICKS || !width || demo.lift > 0 || demo.ducking) return;
    const view = getView(width, height, true);
    const left = DINO.x - view.x / view.scale, right = DINO.x + (width - view.x) / view.scale;
    if (demo.obstacles.every((o) => o.x > right || o.x + OBSTACLES[o.kind].width < left)) { newDemo(); acc = 0; prevLift = 0; }
  }

  function tick(now: number) {
    frame = 0;
    if (disposed || !moving()) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0; // never simulates ahead of the wall clock
    lastTime = now;
    if (run.phase === "idle") { simulate(dt); refreshDemo(); }
    else if (entrance < 1) entrance = Math.min(1, entrance + dt / 0.65);
    else if (!waiting(dt)) simulate(dt);
    draw();
    if (run.phase === "over" || (run.phase === "running" && now - lastPublish > 120)) {
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
    // Stand up first: inputs are ignored while paused, so a crouch held into the pause could never be released.
    if (run.ducking) input(INPUT.stand);
    run.phase = "paused";
    remember(); schedule(); draw(); publish();
  }

  function begin() {
    ticket = options.ticket?.() ?? null;
    run = startRun(ticket?.seed ?? randomSeed());
    inputs = []; overflow = false; lastScore = 0; flash = 0; flashUntil = 0; acc = 0; prevLift = 0;
    hold = !ticket && options.ticketPending?.() ? TICKET_WAIT : 0;
  }

  /** Holds a ticketless run on its first tick while its ticket is on the way, then adopts it if it came. */
  function waiting(dt: number) {
    if (hold <= 0) return false;
    hold -= dt;
    if (hold > 0 && options.ticketPending?.()) return true;
    hold = 0;
    if (options.ticket) adopt(options.ticket);
    return false;
  }

  function action(): ActionResult {
    if (disposed || (run.phase === "over" && performance.now() - crashedAt < RESTART_GUARD)) return null;
    let result: ActionResult = "jump";
    if (run.phase === "idle" || run.phase === "over") {
      entrance = run.phase === "idle" && !reduced ? 0 : 1;
      begin();
      result = "start";
    } else if (run.phase === "paused") { run.phase = "running"; result = "resume"; }
    else input(INPUT.jump);
    schedule(); publish();
    return result;
  }

  function duck(down: boolean) {
    if (disposed || run.phase !== "running") return;
    input(down ? INPUT.duck : INPUT.stand);
  }

  function adopt(take: () => Ticket | null) {
    if (disposed || (run.phase !== "running" && run.phase !== "paused") || ticket || run.tick !== 0) return false;
    const late = take();
    if (!late) return false;
    // Inputs logged so far are all on tick 0 and only move the dino, so the new run replays them to the same state.
    const next = startRun(late.seed);
    for (let i = 1; i < inputs.length; i += 2) applyInput(next, inputs[i] as InputCode);
    next.phase = run.phase;
    ticket = late; run = next; hold = 0;
    draw();
    return true;
  }

  function restore(done: FinishedRun) {
    if (disposed) return false;
    // The same checks as the server's replay, so a tampered or stale log never reaches the screen.
    const check = replayRun(done.seed, done.inputs, done.endTick);
    if (!check.ok || !(check.crashed || check.finished) || check.score !== done.score) return false;
    const replay = startRun(done.seed);
    for (let i = 0; replay.phase === "running";) {
      while (i < done.inputs.length && done.inputs[i] === replay.tick) { applyInput(replay, done.inputs[i + 1] as InputCode); i += 2; }
      step(replay);
    }
    run = replay; entrance = 1; acc = 0; prevLift = 0; ticket = null; flashUntil = 0; crashedAt = -Infinity; hold = 0;
    remember(); schedule(); draw(); publish();
    return true;
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
    draw();
  }

  function visibility() { if (document.hidden) pause(); schedule(); publish(); }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("blur", pause);
  resize(); publish();
  return {
    action, duck, pause, adopt, restore,
    togglePause() { if (run.phase === "running") pause(); else if (run.phase === "paused") void action(); },
    leave() { remember(); run = createRun(); entrance = 1; acc = 0; prevLift = 0; schedule(); draw(); publish(); },
    toggleAutoplay() { ambientPaused = !ambientPaused; schedule(); publish(); },
    setVisible(value) { visible = value; if (!value) pause(); schedule(); publish(); },
    setReduced(value) { reduced = value; if (value) { entrance = 1; flashUntil = 0; } schedule(); draw(); publish(); },
    unlock() { sound.unlock(); },
    setSound(on) { sound.setEnabled(on); publish(); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      sound.dispose();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", pause);
    },
  };
}
