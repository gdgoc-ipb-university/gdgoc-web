import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyInput, autopilot, LIMITS, replayRun, scoreOf, startRun, step, type InputCode, type Run } from "@/lib/bogor-run/engine";
import { FINISH_MESSAGE, mountRunner, type FinishedRun, type Runner, type RunnerOptions, type Snapshot, type Ticket } from "@/lib/bogor-run/runtime";

const sound = vi.hoisted(() => {
  const fake = { play: vi.fn(), unlock: vi.fn(), dispose: vi.fn(), enabled: true, setEnabled: vi.fn((on: boolean) => { fake.enabled = on; }) };
  return fake;
});
vi.mock("@/lib/bogor-run/sound", async (original) => ({ ...await original<typeof import("@/lib/bogor-run/sound")>(), createSound: () => sound }));

let callbacks: Map<number, FrameRequestCallback>;
let timestamp: number;
let nextFrame: number;
let runner: Runner | undefined;
let snapshot: Snapshot;
let snapshots: Snapshot[];
let saved: ReturnType<typeof vi.spyOn>;
let width: number;
let resize: ResizeObserverCallback;
const drawing = { clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), setTransform: vi.fn() };

function frame() {
  timestamp += 1000 / 60;
  const queued = [...callbacks.values()]; callbacks.clear();
  queued.forEach((callback) => callback(timestamp));
}
function advance(seconds: number) { for (let i = 0; i < seconds * 60; i++) frame(); }
/** The dino sheet frames drawn so far, as [x, y, w, h] (the elang's frames are 40 tall). */
const dinoFrames = () => drawing.drawImage.mock.calls.filter((call) => call.length === 9 && (call[4] === 47 || call[4] === 25)).map((call) => call.slice(1, 5));

async function mount(reduced = false, options?: RunnerOptions) {
  const canvas = document.createElement("canvas");
  vi.spyOn(canvas, "getContext").mockReturnValue(drawing as unknown as CanvasRenderingContext2D);
  vi.spyOn(canvas, "getBoundingClientRect").mockImplementation(() => ({ width, height: 640 } as DOMRect));
  runner = await mountRunner(canvas, (value) => { snapshot = value; snapshots.push(value); }, reduced, options);
  runner.setVisible(true);
  return runner;
}

/**
 * Plays the runner with the engine's autopilot, deciding once per 60 Hz frame on a mirror run kept in lockstep
 * (each frame is exactly two ticks). Inputs reach the runner through its public controls, as keys and taps would.
 */
function drive(game: Runner, mirror: Run, until: (run: Run) => boolean) {
  const forward = { 1: () => game.action(), 2: () => game.duck(true), 3: () => game.duck(false) } satisfies Record<InputCode, () => unknown>;
  while (mirror.phase === "running" && !until(mirror)) {
    for (const code of autopilot(mirror)) if (applyInput(mirror, code)) forward[code]();
    frame(); step(mirror); step(mirror);
  }
}

beforeEach(() => {
  callbacks = new Map(); timestamp = 1; nextFrame = 0; width = 1440; snapshots = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callbacks.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  vi.stubGlobal("Image", class {
    onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { resize = callback; }
    observe() {} disconnect() {}
  });
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  localStorage.clear();
  saved = vi.spyOn(Storage.prototype, "setItem");
  sound.enabled = true;
  vi.clearAllMocks();
});

afterEach(() => { runner?.dispose(); runner = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("full-width runner lifecycle", () => {
  it("plays autonomously and silently without recording a personal score and can be paused", async () => {
    const game = await mount();
    expect(snapshot.autoplay).toBe(true);
    advance(20);
    expect(snapshot.phase).toBe("idle");
    expect(snapshot.score).toBe(0);
    expect(snapshot.best).toBe(0);
    expect(saved).not.toHaveBeenCalled();
    expect(sound.play).not.toHaveBeenCalled();
    expect(callbacks.size).toBe(1);
    game.toggleAutoplay();
    expect(callbacks.size).toBe(0);
    expect(snapshot.autoplay).toBe(false);
    game.toggleAutoplay();
    expect(callbacks.size).toBe(1);
  });

  it("suspends all frames offscreen and under reduced motion, but allows explicit play", async () => {
    const game = await mount(true);
    expect(snapshot.autoplay).toBe(false);
    expect(callbacks.size).toBe(0);
    game.setReduced(false); expect(callbacks.size).toBe(1);
    game.setVisible(false); expect(callbacks.size).toBe(0);
    game.setVisible(true); expect(callbacks.size).toBe(1);
    game.setReduced(true); expect(callbacks.size).toBe(0);
    expect(game.action()).toBe("start"); expect(snapshot.phase).toBe("running");
    advance(1); expect(snapshot.score).toBeGreaterThan(0);
    game.setVisible(false);
    expect(snapshot.phase).toBe("paused"); expect(callbacks.size).toBe(0);
    game.setVisible(true);
    expect(snapshot.phase).toBe("paused"); expect(callbacks.size).toBe(0);
  });

  it("keeps manual scores separate when returning to autoplay and cleans up frames", async () => {
    const game = await mount();
    advance(5); game.action();
    advance(6);
    expect(snapshot.phase).toBe("over");
    expect(snapshot.best).toBeGreaterThan(0);
    expect(saved).toHaveBeenCalledOnce();
    const best = snapshot.best;
    game.leave(); advance(10);
    expect(snapshot.phase).toBe("idle"); expect(snapshot.autoplay).toBe(true);
    expect(snapshot.best).toBe(best); expect(snapshot.score).toBe(0);
    expect(saved).toHaveBeenCalledOnce();
    game.dispose(); expect(callbacks.size).toBe(0);
  });

  it("pauses a personal run when viewport width changes", async () => {
    const game = await mount(); game.action(); advance(1);
    width = 390; resize([], {} as ResizeObserver);
    expect(snapshot.phase).toBe("paused");
    expect(callbacks.size).toBe(0);
  });
});

describe("ranked runs", () => {
  it("records exactly the inputs the server replays, with sounds and a milestone flash along the way", async () => {
    const finish = vi.fn<(run: FinishedRun) => void>();
    const game = await mount(true, { ticket: () => ({ seed: 1, token: "signed" }), finish });
    const mirror = startRun(1);
    expect(game.action()).toBe("start");
    frame(); // the first frame after a start only sets the clock
    drive(game, mirror, (run) => scoreOf(run) >= 480);
    game.setReduced(false); // the flash is a motion effect
    drive(game, mirror, (run) => scoreOf(run) >= 520);
    if (mirror.ducking) { applyInput(mirror, 3); game.duck(false); }
    drive(game, mirror, () => true); // hands off: the run crashes on its own
    while (mirror.phase === "running") { frame(); step(mirror); step(mirror); }

    expect(finish).toHaveBeenCalledOnce();
    const run = finish.mock.calls[0][0];
    expect(run).toMatchObject({ seed: 1, token: "signed", score: snapshot.score });
    expect(snapshot.phase).toBe("over");
    expect(scoreOf(mirror)).toBe(run.score);
    expect(replayRun(run.seed, run.inputs, run.endTick)).toEqual({ ok: true, crashed: true, tick: run.endTick, score: run.score, hit: mirror.hit });
    const jumps = run.inputs.filter((value, i) => i % 2 === 1 && value === 1).length;
    expect(jumps).toBeGreaterThan(5);
    expect(sound.play.mock.calls.filter(([name]) => name === "jump")).toHaveLength(jumps);
    expect(sound.play.mock.calls.filter(([name]) => name === "milestone")).toHaveLength(1);
    expect(sound.play).toHaveBeenLastCalledWith("crash");
    expect(snapshots.some((value) => value.flash === 500)).toBe(true);
    expect(snapshot.flash).toBe(0);
  });

  it("releases a held duck before pausing, so the replay log stays exact", async () => {
    const finish = vi.fn<(run: FinishedRun) => void>();
    const game = await mount(true, { ticket: () => ({ seed: 7, token: "signed" }), finish });
    game.action(); advance(0.5);
    game.duck(true); game.duck(true); advance(0.2);
    game.pause();
    expect(snapshot.phase).toBe("paused");
    expect(game.action()).toBe("resume");
    advance(8);
    const { inputs, endTick, score } = finish.mock.calls[0][0];
    expect(inputs).toHaveLength(4);
    expect(inputs.filter((_, i) => i % 2 === 1)).toEqual([2, 3]);
    expect(inputs[2] - inputs[0]).toBe(24); // 0.2 s of crouching, then the stand logged at the pause
    expect(replayRun(7, inputs, endTick)).toMatchObject({ ok: true, crashed: true, score });
  });

  it("plays unranked without a ticket, adopts a late one before the first tick, and guards instant restarts", async () => {
    const finish = vi.fn<(run: FinishedRun) => void>();
    let ticket: Ticket | null = null;
    const game = await mount(true, { ticket: () => ticket, finish });
    game.action();
    expect(game.adopt(() => ({ seed: 99, token: "late" }))).toBe(true);
    expect(game.adopt(() => ({ seed: 5, token: "again" }))).toBe(false);
    advance(8);
    expect(finish.mock.calls[0][0]).toMatchObject({ seed: 99, token: "late" });

    const now = performance.now();
    const clock = vi.spyOn(performance, "now").mockReturnValue(now + 200);
    expect(game.action()).toBeNull(); // mashing jump right after a crash does not restart
    clock.mockReturnValue(now + 10_000);
    expect(game.action()).toBe("start");
    advance(0.5);
    expect(game.adopt(() => ({ seed: 5, token: "too-late" }))).toBe(false);
    advance(8);
    expect(finish.mock.calls[1][0]).toMatchObject({ token: null, unranked: "ticket" });
    ticket = { seed: 3, token: "fresh" };
    clock.mockReturnValue(now + 20_000);
    game.action(); advance(8);
    expect(finish.mock.calls[2][0]).toMatchObject({ seed: 3, token: "fresh" });
  });

  it("restores a finished run after the sign-in round trip, but only one that replays", async () => {
    const game = await mount(true);
    const run = startRun(11);
    while (run.phase === "running") step(run);
    const done: FinishedRun = { seed: 11, token: "t", inputs: [], endTick: run.tick, score: scoreOf(run) };
    expect(game.restore({ ...done, score: done.score + 1 })).toBe(false);
    expect(game.restore({ ...done, inputs: [0, 9] })).toBe(false);
    expect(snapshot.phase).toBe("idle");
    expect(game.restore(done)).toBe(true);
    expect(snapshot).toMatchObject({ phase: "over", score: done.score, best: done.score, finished: false });
    expect(dinoFrames().at(-1)).toEqual([132, 0, 44, 47]); // the standing crash frame
    expect(sound.play).not.toHaveBeenCalled();
  });

  it("holds a ticketless start while its ticket is on the way, then adopts it with the inputs pressed meanwhile", async () => {
    const finish = vi.fn<(run: FinishedRun) => void>();
    let pending = true, ticket: Ticket | null = null;
    const take = vi.fn(() => { const late = ticket; ticket = null; return late; });
    const game = await mount(true, { ticket: take, ticketPending: () => pending, finish });
    expect(game.action()).toBe("start");
    frame();
    expect(game.action()).toBe("jump"); // pressed while waiting: logged on tick 0
    advance(0.5);
    expect(snapshot).toMatchObject({ phase: "running", score: 0 }); // still on its first tick
    ticket = { seed: 99, token: "late" }; pending = false;
    advance(8);
    const run = finish.mock.calls[0][0];
    expect(run).toMatchObject({ seed: 99, token: "late" });
    expect(run.inputs.slice(0, 2)).toEqual([0, 1]);
    expect(replayRun(99, run.inputs, run.endTick)).toMatchObject({ ok: true, crashed: true, score: run.score });
  });

  it("waits at most a second for a ticket, and not at all when none is coming", async () => {
    const finish = vi.fn<(run: FinishedRun) => void>();
    let pending = true;
    const take = vi.fn(() => null);
    const game = await mount(true, { ticket: take, ticketPending: () => pending, finish });
    game.action(); frame();
    advance(0.9);
    expect(snapshot.score).toBe(0);
    advance(0.5);
    expect(snapshot.score).toBeGreaterThan(0);
    expect(take).toHaveBeenCalledTimes(2); // at the start, and once more as the wait ends
    advance(8);
    expect(finish.mock.calls[0][0]).toMatchObject({ token: null, unranked: "ticket" });

    pending = false;
    vi.spyOn(performance, "now").mockReturnValue(performance.now() + 10_000);
    expect(game.action()).toBe("start");
    frame(); advance(0.2);
    expect(snapshot.score).toBeGreaterThan(0);
  });

  it("marks a run whose input log outgrew the server's limit as unranked", async () => {
    const finish = vi.fn<(run: FinishedRun) => void>();
    const game = await mount(true, { ticket: () => ({ seed: 5, token: "signed" }), finish });
    game.action();
    for (let i = 0; i <= LIMITS.maxInputNumbers / 4; i++) { game.duck(true); game.duck(false); }
    advance(10);
    const run = finish.mock.calls[0][0];
    expect(run).toMatchObject({ token: null, unranked: "log" });
    expect(run.inputs).toHaveLength(LIMITS.maxInputNumbers);
  });

  it("keeps the crouch in a crash while ducking, and ends a full hour standing, with no crash", async () => {
    const game = await mount(true, { ticket: () => ({ seed: 3, token: "t" }) });
    game.action(); game.duck(true);
    advance(8);
    expect(snapshot).toMatchObject({ phase: "over", finished: false });
    expect(dinoFrames().at(-1)).toEqual([294, 22, 59, 25]); // duck pose with the crash's X eyes, touching what it hit

    const live = startRun(424242), inputs: number[] = [];
    while (live.phase === "running") { for (const code of autopilot(live)) if (applyInput(live, code)) inputs.push(live.tick, code); step(live); }
    expect([live.finished, live.tick]).toEqual([true, LIMITS.maxTicks]);
    const hour: FinishedRun = { seed: 424242, token: "t", inputs, endTick: live.tick, score: scoreOf(live) };
    expect(game.restore(hour)).toBe(true); // a finished hour comes back from the sign-in round trip too
    expect(snapshot).toMatchObject({ phase: "over", finished: true, message: FINISH_MESSAGE, score: hour.score });
    expect(dinoFrames().at(-1)).toEqual([0, 0, 44, 47]);
  }, 30_000);

  it("persists the mute toggle through the sound module", async () => {
    const game = await mount(true);
    expect(snapshot.sound).toBe(true);
    game.setSound(false);
    expect(sound.setEnabled).toHaveBeenCalledWith(false);
    expect(snapshot.sound).toBe(false);
    game.unlock(); expect(sound.unlock).toHaveBeenCalledOnce();
    game.dispose(); expect(sound.dispose).toHaveBeenCalledOnce();
    runner = undefined;
  });
});
