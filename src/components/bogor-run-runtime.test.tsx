import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountRunner, type Runner, type Snapshot } from "@/lib/bogor-run/runtime";

let callbacks: Map<number, FrameRequestCallback>;
let timestamp: number;
let nextFrame: number;
let runner: Runner | undefined;
let snapshot: Snapshot;
let saved: ReturnType<typeof vi.spyOn>;
let width: number;
let resize: ResizeObserverCallback;
const drawing = { clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), setTransform: vi.fn() };

function advance(seconds: number) {
  for (let i = 0; i < seconds * 60; i++) {
    timestamp += 1000 / 60;
    const queued = [...callbacks.values()]; callbacks.clear();
    queued.forEach((callback) => callback(timestamp));
  }
}

async function mount(reduced = false) {
  const canvas = document.createElement("canvas");
  vi.spyOn(canvas, "getContext").mockReturnValue(drawing as unknown as CanvasRenderingContext2D);
  vi.spyOn(canvas, "getBoundingClientRect").mockImplementation(() => ({ width, height: 640 } as DOMRect));
  runner = await mountRunner(canvas, (value) => { snapshot = value; }, reduced);
  runner.setVisible(true);
  return runner;
}

beforeEach(() => {
  callbacks = new Map(); timestamp = 1; nextFrame = 0; width = 1440;
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
});

afterEach(() => { runner?.dispose(); runner = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("full-width runner lifecycle", () => {
  it("plays autonomously without recording a personal score and can be paused", async () => {
    const game = await mount();
    expect(snapshot.autoplay).toBe(true);
    advance(20);
    expect(snapshot.phase).toBe("idle");
    expect(snapshot.score).toBe(0);
    expect(snapshot.best).toBe(0);
    expect(saved).not.toHaveBeenCalled();
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
    game.action(); expect(snapshot.phase).toBe("running");
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
