import { afterEach, describe, expect, it, vi } from "vitest";
import { createSound, MILESTONE_EVERY, milestoneCrossed, readSoundEnabled, SOUND_KEY, type SoundName } from "./sound";

// Minimal Web Audio stand-ins: they record what the module schedules so tests can check timing, gain and cleanup.
type Ramp = [kind: "set" | "linear" | "exp", value: number, time: number];
class FakeParam {
  ramps: Ramp[] = [];
  setValueAtTime(value: number, time: number) { this.ramps.push(["set", value, time]); }
  linearRampToValueAtTime(value: number, time: number) { this.ramps.push(["linear", value, time]); }
  exponentialRampToValueAtTime(value: number, time: number) {
    if (!(value > 0)) throw new RangeError("exponential ramps need a positive target");
    this.ramps.push(["exp", value, time]);
  }
}
class FakeNode {
  outputs: FakeNode[] = [];
  disconnects = 0;
  constructor(readonly context: FakeContext, readonly kind: string) { context.nodes.push(this); }
  connect(node: FakeNode) { this.outputs.push(node); return node; }
  disconnect() { this.disconnects += 1; this.outputs = []; }
}
class FakeSource extends FakeNode {
  startAt?: number;
  stopAt?: number;
  onended: (() => void) | null = null;
  start(time = 0) { if (this.startAt !== undefined) throw new Error("InvalidStateError"); this.startAt = time; }
  stop(time = 0) { if (this.startAt === undefined) throw new Error("InvalidStateError"); this.stopAt = time; }
  end() { this.onended?.(); }
}
class FakeOscillator extends FakeSource { type = "sine"; frequency = new FakeParam(); }
class FakeBuffer { data: Float32Array; constructor(readonly length: number, readonly sampleRate: number) { this.data = new Float32Array(length); } getChannelData() { return this.data; } }
class FakeBufferSource extends FakeSource { buffer: FakeBuffer | null = null; }
class FakeGain extends FakeNode { gain = new FakeParam(); }
class FakeContext {
  state: "suspended" | "running" | "closed" = "suspended";
  currentTime = 2;
  sampleRate = 48_000;
  nodes: FakeNode[] = [];
  destination = new FakeNode(this, "destination");
  resume = vi.fn(() => { this.state = "running"; return Promise.resolve(); });
  close = vi.fn(() => { this.state = "closed"; return Promise.resolve(); });
  createOscillator() { return new FakeOscillator(this, "oscillator"); }
  createGain() { return new FakeGain(this, "gain"); }
  createBufferSource() { return new FakeBufferSource(this, "buffer-source"); }
  createBuffer(_channels: number, length: number, sampleRate: number) { return new FakeBuffer(length, sampleRate); }
  sources() { return this.nodes.filter((node): node is FakeSource => node instanceof FakeSource); }
  gains() { return this.nodes.filter((node): node is FakeGain => node instanceof FakeGain); }
}

function installAudio(name: "AudioContext" | "webkitAudioContext" = "AudioContext", setup?: (context: FakeContext) => void) {
  const contexts: FakeContext[] = [];
  vi.stubGlobal("AudioContext", undefined);
  vi.stubGlobal("webkitAudioContext", undefined);
  vi.stubGlobal(name, class extends FakeContext { constructor() { super(); setup?.(this); contexts.push(this); } });
  return contexts;
}

function installStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, String(value)), removeItem: (key: string) => void data.delete(key) });
  return data;
}

// A ready sound: storage empty, context created by a "gesture" and running, priming buffer ignored.
function ready() {
  installStorage();
  const contexts = installAudio();
  const sound = createSound();
  sound.unlock();
  const context = contexts[0];
  const before = context.nodes.length;
  return { sound, context, contexts, fresh: () => context.nodes.slice(before) };
}

const peak = (gain: FakeGain) => Math.max(...gain.gain.ramps.map(([, value]) => value));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("milestone detection", () => {
  it.each([
    [0, 0, false], [0, 499, false], [499, 500, true], [500, 500, false], [500, 501, false], [999, 1000, true],
    [480, 1010, true], [1000, 1499, false], [1499, 1500, true], [1200, 0, false], [1200, 600, false], [-5, 0, false],
    [Number.NaN, 600, false], [0, Number.POSITIVE_INFINITY, false],
  ])("from %s to %s is %s", (previous, score, expected) => {
    expect(milestoneCrossed(previous, score)).toBe(expected);
  });

  it("fires once per 500 points however the score advances, and never at 0", () => {
    expect(MILESTONE_EVERY).toBe(500);
    for (const stride of [1, 3, 7, 13, 120, 499, 530, 1600]) {
      let previous = 0;
      const fired: number[] = [];
      for (let score = 0; score <= 5_000; score += stride) { if (milestoneCrossed(previous, score)) fired.push(score); previous = score; }
      const band = (score: number) => Math.floor(score / MILESTONE_EVERY);
      const sampled = new Set(Array.from({ length: Math.floor(5_000 / stride) + 1 }, (_, i) => band(i * stride)));
      expect(fired.every((score) => score >= MILESTONE_EVERY)).toBe(true);
      expect(new Set(fired.map(band)).size).toBe(fired.length);
      expect(fired.length).toBe(sampled.size - 1); // every band reached except the starting one, once each
    }
  });
});

describe("sound preference", () => {
  it("defaults to on, with or without storage", () => {
    expect(readSoundEnabled()).toBe(true);
    installStorage();
    expect(readSoundEnabled()).toBe(true);
    expect(createSound().enabled).toBe(true);
  });

  it("reads and persists the mute toggle", () => {
    const data = installStorage({ [SOUND_KEY]: "0" });
    expect(readSoundEnabled()).toBe(false);
    const sound = createSound();
    expect(sound.enabled).toBe(false);
    sound.setEnabled(true);
    expect([sound.enabled, data.get(SOUND_KEY), readSoundEnabled()]).toEqual([true, "1", true]);
    sound.setEnabled(false);
    expect([sound.enabled, data.get(SOUND_KEY), readSoundEnabled()]).toEqual([false, "0", false]);
    data.set(SOUND_KEY, "garbage");
    expect(readSoundEnabled()).toBe(true);
  });

  it("keeps working when storage methods throw", () => {
    const blocked = () => { throw new DOMException("blocked", "SecurityError"); };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked });
    expect(readSoundEnabled()).toBe(true);
    const sound = createSound();
    expect(() => sound.setEnabled(false)).not.toThrow();
    expect(sound.enabled).toBe(false);
  });

  it("keeps working when merely touching localStorage throws", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new DOMException("sandboxed", "SecurityError"); } });
    try {
      expect(readSoundEnabled()).toBe(true);
      const sound = createSound();
      expect(() => { sound.setEnabled(false); sound.setEnabled(true); }).not.toThrow();
      expect(sound.enabled).toBe(true);
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original); else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});

describe("sound playback", () => {
  it("imports without reading browser globals", async () => {
    const names = ["window", "document", "localStorage", "AudioContext", "webkitAudioContext", "navigator"];
    const originals = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
    const touched: string[] = [];
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, get() { touched.push(name); return undefined; } });
    try {
      vi.resetModules();
      const mod = await import("./sound");
      expect(typeof mod.createSound).toBe("function");
    } finally {
      for (const [name, descriptor] of originals) if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete (globalThis as Record<string, unknown>)[name];
    }
    expect(touched).toEqual([]);
  });

  it("never throws without Web Audio", () => {
    installStorage();
    const sound = createSound();
    expect(() => { sound.unlock(); (["jump", "crash", "milestone"] as const).forEach((name) => sound.play(name)); sound.setEnabled(false); sound.setEnabled(true); sound.dispose(); sound.play("jump"); }).not.toThrow();
  });

  it("stays silent before unlock and creates one context lazily on the first gesture", () => {
    installStorage();
    const contexts = installAudio();
    const sound = createSound();
    sound.play("jump");
    expect(contexts).toHaveLength(0);
    sound.unlock();
    sound.unlock();
    expect(contexts).toHaveLength(1);
    expect(contexts[0].resume).toHaveBeenCalledTimes(1);
    // The priming blank buffer starts inside the gesture and cleans up after itself.
    const [blank] = contexts[0].sources();
    expect(blank).toBeInstanceOf(FakeBufferSource);
    expect(blank.startAt).toBe(0);
    blank.end();
    expect(blank.disconnects).toBe(1);
  });

  it("falls back to webkitAudioContext", () => {
    installStorage();
    const contexts = installAudio("webkitAudioContext");
    const sound = createSound();
    sound.unlock();
    sound.play("jump");
    expect(contexts).toHaveLength(1);
    expect(contexts[0].sources().some((source) => source instanceof FakeOscillator)).toBe(true);
  });

  it("is silent while the context is still suspended", () => {
    installStorage();
    const contexts = installAudio("AudioContext", (context) => { context.resume = vi.fn(() => Promise.resolve()); });
    const sound = createSound();
    sound.unlock();
    const before = contexts[0].nodes.length;
    sound.play("crash");
    expect(contexts[0].nodes.length).toBe(before);
  });

  it("is silent when disabled", () => {
    installStorage({ [SOUND_KEY]: "0" });
    const contexts = installAudio();
    const sound = createSound();
    sound.unlock();
    sound.play("jump");
    expect(contexts).toHaveLength(0);
    // Turning it on from the toggle's click unlocks right away.
    sound.setEnabled(true);
    expect(contexts).toHaveLength(1);
    sound.setEnabled(false);
    const before = contexts[0].nodes.length;
    sound.play("milestone");
    expect(contexts[0].nodes.length).toBe(before);
  });

  it("is silent while the tab is hidden", () => {
    const { sound, fresh } = ready();
    vi.stubGlobal("document", { hidden: true });
    sound.play("jump");
    expect(fresh()).toHaveLength(0);
    vi.stubGlobal("document", { hidden: false });
    sound.play("jump");
    expect(fresh().length).toBeGreaterThan(0);
  });

  it.each([
    ["jump", 1, 0.09],
    ["crash", 2, 0.25],
    ["milestone", 2, 0.22],
    ["fanfare", 4, 0.75],
  ] as [SoundName, number, number][])("schedules %s within the gain cap and disconnects it afterwards", (name, layers, duration) => {
    const { sound, context, fresh } = ready();
    sound.play(name);
    const sources = fresh().filter((node): node is FakeSource => node instanceof FakeSource);
    const gains = fresh().filter((node): node is FakeGain => node instanceof FakeGain);
    expect(sources).toHaveLength(layers);
    expect(gains).toHaveLength(layers);
    const ends = sources.map((source) => source.stopAt ?? Number.NaN);
    expect(Math.max(...ends) - context.currentTime).toBeGreaterThanOrEqual(duration);
    expect(Math.max(...ends) - context.currentTime).toBeLessThan(duration + 0.05);
    for (const [index, source] of sources.entries()) {
      expect(source.startAt).toBeGreaterThanOrEqual(context.currentTime);
      expect(source.stopAt).toBeGreaterThan(source.startAt ?? Infinity);
      expect(source.outputs).toHaveLength(1);
      expect(source.outputs[0]).toBe(gains[index]);
      expect(gains[index].outputs).toHaveLength(1);
      expect(gains[index].outputs[0]).toBe(context.destination);
    }
    for (const gain of gains) {
      expect(peak(gain)).toBeLessThanOrEqual(0.12);
      expect(gain.gain.ramps.at(-1)?.[0]).toBe("exp"); // fades out rather than clicking off
    }
    expect(gains.reduce((sum, gain) => sum + peak(gain), 0)).toBeLessThanOrEqual(0.12 + 1e-9);
    for (const source of sources) source.end();
    for (const node of [...sources, ...gains]) expect(node.disconnects).toBeGreaterThan(0);
  });

  it("gives each sound its shape", () => {
    const { sound, context, fresh } = ready();
    const tones = (name: SoundName) => {
      const seen = new Set(fresh());
      sound.play(name);
      return fresh().filter((node): node is FakeOscillator => node instanceof FakeOscillator && seen.has(node) === false);
    };
    const pitches = (osc: FakeOscillator) => osc.frequency.ramps.map(([, value]) => value);
    const [jump] = tones("jump");
    expect(jump.type).toBe("square");
    expect(pitches(jump)[1]).toBeGreaterThan(pitches(jump)[0]);
    const [crash] = tones("crash");
    expect(pitches(crash)[1]).toBeLessThan(pitches(crash)[0]);
    const noise = fresh().find((node): node is FakeBufferSource => node instanceof FakeBufferSource && node.buffer !== null && node.buffer.length > 1);
    expect(noise?.buffer?.data.some((value) => value !== 0)).toBe(true);
    expect(noise?.buffer?.data.every((value) => value >= -1 && value <= 1)).toBe(true);
    context.currentTime += 1; // after the crash has finished
    const [low, high] = tones("milestone");
    expect(pitches(high)[0]).toBeGreaterThan(pitches(low)[0]);
    expect(high.startAt).toBeGreaterThan(low.startAt ?? Infinity);
  });

  it("cuts sounds that are still playing when muted", () => {
    const { sound, fresh } = ready();
    sound.play("crash");
    const sources = fresh().filter((node): node is FakeSource => node instanceof FakeSource);
    sound.setEnabled(false);
    for (const node of fresh()) expect(node.disconnects).toBeGreaterThan(0);
    expect(sources.every((source) => source.stopAt === 0)).toBe(true);
  });

  it("lets the crash cut ringing sounds and keep the speaker to itself", () => {
    const { sound, context, fresh } = ready();
    sound.play("jump");
    const [jump] = fresh();
    sound.play("crash");
    expect(jump.disconnects).toBeGreaterThan(0);
    const during = fresh().length;
    context.currentTime += 0.1;
    sound.play("milestone");
    sound.play("jump");
    expect(fresh()).toHaveLength(during);
    context.currentTime += 0.2;
    sound.play("jump");
    expect(fresh().length).toBeGreaterThan(during);
  });

  it("disposes the context, and later calls are no-ops", () => {
    const { sound, context, contexts, fresh } = ready();
    sound.play("milestone");
    sound.dispose();
    sound.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
    for (const node of fresh()) expect(node.disconnects).toBeGreaterThan(0);
    sound.unlock();
    sound.play("jump");
    expect(contexts).toHaveLength(1);
  });

  it("recreates a context the browser closed, on a fresh clock", () => {
    const { sound, context, contexts } = ready();
    context.currentTime = 500;
    sound.play("crash");
    context.state = "closed";
    sound.play("jump");
    sound.unlock();
    expect(contexts).toHaveLength(2);
    const before = contexts[1].nodes.length;
    sound.play("jump"); // the old context's crash window must not mute the new one
    expect(contexts[1].nodes.length).toBeGreaterThan(before);
  });

  it("swallows a broken audio stack", async () => {
    installStorage();
    vi.stubGlobal("AudioContext", class { constructor() { throw new Error("no audio device"); } });
    expect(() => createSound().unlock()).not.toThrow();

    const contexts = installAudio("AudioContext", (context) => {
      context.resume = vi.fn(() => { context.state = "running"; return Promise.reject(new Error("not allowed")); });
      context.close = vi.fn(() => Promise.reject(new Error("already closed")));
      context.createOscillator = () => { throw new Error("oscillators unavailable"); };
      context.createBufferSource = () => { throw new Error("buffers unavailable"); };
    });
    const sound = createSound();
    expect(() => { sound.unlock(); sound.play("jump"); sound.play("crash"); sound.dispose(); }).not.toThrow();
    expect(contexts).toHaveLength(1);
    await Promise.resolve(); // an unhandled resume/close rejection would fail the run here
  });
});
