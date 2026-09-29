// Bogor Run sound effects, synthesized with Web Audio so the game ships no audio files.
// Nothing here reads browser globals at import time: the landing page renders on the server too.

export type SoundName = "jump" | "crash" | "milestone";
export type Sound = { play(name: SoundName): void; unlock(): void; setEnabled(on: boolean): void; readonly enabled: boolean; dispose(): void };
export const SOUND_KEY = "gdgoc:bogor-run:sound:v1";
export const MILESTONE_EVERY = 500;

type Layer = { at: number; length: number; peak: number };
type Tone = Layer & { wave: OscillatorType; from: number; to: number };
// Layer peaks within one sound add up to at most 0.12, so a sound never gets louder than that.
const TONES: Record<SoundName, readonly Tone[]> = {
  jump: [{ wave: "square", from: 420, to: 880, at: 0, length: 0.09, peak: 0.05 }],
  crash: [{ wave: "square", from: 360, to: 70, at: 0, length: 0.25, peak: 0.07 }],
  // B5 then E6: the familiar 8-bit "coin" interval.
  milestone: [{ wave: "square", from: 988, to: 988, at: 0, length: 0.08, peak: 0.06 }, { wave: "square", from: 1319, to: 1319, at: 0.07, length: 0.15, peak: 0.06 }],
};
const BURSTS: Partial<Record<SoundName, Layer>> = { crash: { at: 0, length: 0.12, peak: 0.045 } };
const FLOOR = 0.0001; // exponential ramps cannot reach 0
const ATTACK = 0.004; // a short fade-in avoids clicks
const HOLD = 0.35; // share of each layer held at full volume, so it sounds as long as it is
const TAIL = 0.02; // lets the fade finish before the source stops

type AudioScope = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

/** True when the score reached or passed a positive multiple of 500; a jump over several bands still counts once. */
export function milestoneCrossed(previousScore: number, score: number) {
  if (!Number.isFinite(previousScore) || !Number.isFinite(score) || score < MILESTONE_EVERY) return false;
  return Math.floor(score / MILESTONE_EVERY) > Math.floor(Math.max(0, previousScore) / MILESTONE_EVERY);
}

export function readSoundEnabled() {
  try { return globalThis.localStorage?.getItem(SOUND_KEY) !== "0"; } catch { return true; } // blocked storage keeps the default
}

function noiseBuffer(ctx: AudioContext) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.15), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Sample-and-hold noise sounds like a console's crunchy noise channel rather than hiss.
  const hold = Math.max(1, Math.round(ctx.sampleRate / 6000));
  let value = 0;
  for (let i = 0; i < data.length; i += 1) { if (i % hold === 0) value = Math.random() * 2 - 1; data[i] = value; }
  return buffer;
}

export function createSound(): Sound {
  let enabled = readSoundEnabled();
  let ctx: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  let disposed = false;
  let crashUntil = 0; // context time until which the crash owns the speaker
  const live = new Map<AudioScheduledSourceNode, AudioNode[]>();
  const hidden = () => typeof document !== "undefined" && document.hidden === true;

  function open() {
    const scope = globalThis as AudioScope;
    const Context = scope.AudioContext ?? scope.webkitAudioContext;
    if (!Context) return null;
    const context = new Context();
    try {
      // Older iOS only opens the output once something actually starts inside the gesture.
      const blank = context.createBufferSource();
      blank.buffer = context.createBuffer(1, 1, context.sampleRate);
      blank.connect(context.destination);
      blank.onended = () => { try { blank.disconnect(); } catch { /* already detached */ } };
      blank.start(0);
    } catch { /* resume() is enough for current browsers */ }
    noise = null;
    crashUntil = 0; // a new context's clock starts again at 0
    return context;
  }

  function release(source: AudioScheduledSourceNode) {
    const chain = live.get(source) ?? [];
    live.delete(source);
    for (const node of [source, ...chain]) try { node.disconnect(); } catch { /* already detached */ }
  }

  function silence() {
    for (const source of [...live.keys()]) { try { source.stop(); } catch { /* never started or already ended */ } release(source); }
  }

  function schedule(context: AudioContext, source: AudioScheduledSourceNode, at: number, { length, peak }: Layer) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(FLOOR, at);
    gain.gain.linearRampToValueAtTime(peak, at + ATTACK);
    gain.gain.linearRampToValueAtTime(peak, at + length * HOLD);
    gain.gain.exponentialRampToValueAtTime(FLOOR, at + length);
    source.connect(gain);
    gain.connect(context.destination);
    live.set(source, [gain]);
    source.onended = () => release(source);
    try { source.start(at); source.stop(at + length + TAIL); } catch { release(source); }
  }

  function play(name: SoundName) {
    try {
      if (!enabled || disposed || !ctx || ctx.state !== "running" || hidden()) return;
      const at = ctx.currentTime;
      // Nothing plays over the crash, and the crash cuts whatever still rings, so overlaps stay under the 0.12 cap too.
      if (name !== "crash" && at < crashUntil) return;
      if (name === "crash") { silence(); crashUntil = at + TONES.crash[0].length; }
      for (const tone of TONES[name]) {
        const osc = ctx.createOscillator();
        osc.type = tone.wave;
        osc.frequency.setValueAtTime(tone.from, at + tone.at);
        if (tone.to !== tone.from) osc.frequency.exponentialRampToValueAtTime(tone.to, at + tone.at + tone.length);
        schedule(ctx, osc, at + tone.at, tone);
      }
      const burst = BURSTS[name];
      if (!burst) return;
      const source = ctx.createBufferSource();
      source.buffer = noise ??= noiseBuffer(ctx);
      schedule(ctx, source, at + burst.at, burst);
    } catch { /* a broken audio stack must never break the game */ }
  }

  // Call from a user gesture (keydown, click, pointerup): browsers only start audio inside one.
  function unlock() {
    if (disposed || !enabled) return;
    try {
      if (ctx?.state === "closed") ctx = null;
      ctx ??= open();
      if (ctx && ctx.state !== "running") void Promise.resolve(ctx.resume()).catch(() => undefined);
    } catch { /* stays silent until the next gesture */ }
  }

  function setEnabled(on: boolean) {
    enabled = on === true;
    try { globalThis.localStorage?.setItem(SOUND_KEY, enabled ? "1" : "0"); } catch { /* the toggle still works for this visit */ }
    // The mute toggle is a click, so turning sound on is also the gesture that unlocks it.
    if (enabled) unlock(); else silence();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    silence();
    const context = ctx;
    ctx = null;
    noise = null;
    try { if (context) void Promise.resolve(context.close()).catch(() => undefined); } catch { /* already closed */ }
  }

  return { play, unlock, setEnabled, dispose, get enabled() { return enabled; } };
}
