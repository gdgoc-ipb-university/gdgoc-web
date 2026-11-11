/**
 * Flag tasks (#240): the member finds a flag, for example in the chapter's Discord, and the site grades it. Points are
 * locked when a member solves the task and drop with each solve, down to a floor.
 */

/** Points as stored on a flag task: what the first solver gets, the floor, and how much each solve lowers the value. */
export type FlagPoints = { maxPoints: number; minPoints: number; decrement: number };
/** The flag and points as typed in Kelola tugas; numbers become numbers on the server. */
export type FlagInput = { flag: string; maxPoints: string; minPoints: string; decrement: string };
export type FlagErrors = Partial<Record<keyof FlagInput, string>>;

export const flagLimits = { flag: 200, points: 10_000 } as const;
export const defaultFlagInput: FlagInput = { flag: "", maxPoints: "100", minPoints: "20", decrement: "10" };

/**
 * Wrong flags per member and task: a bucket of 5 tries that refills one try a minute, so a member who mistypes has room
 * and a script gets at most one guess a minute after its first five.
 */
export const wrongFlagLimit = { tries: 5, refillMs: 60_000 } as const;
export type TryBucket = { tokens: number; tokensAt: number };

const points = new Intl.NumberFormat("id-ID");
const whole = (value: string) => /^\d+$/.test(value) && Number(value) <= flagLimits.points;

export function normalizeFlag(input: FlagInput): FlagInput {
  return { flag: input.flag.trim(), maxPoints: input.maxPoints.trim(), minPoints: input.minPoints.trim(), decrement: input.decrement.trim() };
}

/** Max ≥ min ≥ 0 and decrement ≥ 0, all whole numbers up to 10,000, and a flag on one line. */
export function validateFlag(input: FlagInput): FlagErrors {
  const v = normalizeFlag(input);
  const errors: FlagErrors = {};
  const range = `Isi bilangan bulat 0 sampai ${points.format(flagLimits.points)}.`;
  if (!v.flag) errors.flag = "Isi flag yang harus ditemukan member.";
  else if (v.flag.length > flagLimits.flag) errors.flag = `Maksimal ${flagLimits.flag} karakter.`;
  else if (/[\r\n]/.test(v.flag)) errors.flag = "Flag harus satu baris.";
  if (!whole(v.maxPoints)) errors.maxPoints = range;
  if (!whole(v.minPoints)) errors.minPoints = range;
  else if (!errors.maxPoints && Number(v.minPoints) > Number(v.maxPoints)) errors.minPoints = "Poin minimal tidak boleh melebihi poin maksimal.";
  if (!whole(v.decrement)) errors.decrement = range;
  return errors;
}

export function parseFlagPoints(input: FlagInput): FlagPoints {
  const v = normalizeFlag(input);
  return { maxPoints: Number(v.maxPoints), minPoints: Number(v.minPoints), decrement: Number(v.decrement) };
}

/** A stored flag task's points. */
export function flagPointsOf(task: { maxPoints?: number; minPoints?: number; decrement?: number }): FlagPoints {
  return { maxPoints: task.maxPoints ?? 0, minPoints: task.minPoints ?? 0, decrement: task.decrement ?? 0 };
}

/** What the n-th solver (1-based) gets: max(min, max − decrement × (n − 1)). */
export function flagPointsFor(value: FlagPoints, place: number) {
  return Math.max(value.minPoints, value.maxPoints - value.decrement * (place - 1));
}

/** The first solver who gets only the minimum, or null when the value never drops. */
export function floorPlace(value: FlagPoints) {
  if (!value.decrement || value.maxPoints <= value.minPoints) return null;
  return Math.ceil((value.maxPoints - value.minPoints) / value.decrement) + 1;
}

/** The form's live preview, e.g. "Solver ke-1: 100, ke-2: 90, ke-5: 60, minimum 20 mulai solver ke-9." */
export function flagPreview(value: FlagPoints) {
  const floor = floorPlace(value);
  if (floor === null) return `Setiap solver mendapat ${points.format(value.maxPoints)} poin.`;
  const parts = [`Solver ke-1: ${points.format(value.maxPoints)}`];
  if (floor > 2) parts.push(`ke-2: ${points.format(flagPointsFor(value, 2))}`);
  if (floor > 5) parts.push(`ke-5: ${points.format(flagPointsFor(value, 5))}`);
  return `${parts.join(", ")}, minimum ${points.format(value.minPoints)} mulai solver ke-${floor}.`;
}

/** Spaces at the ends are trimmed; then the match is exact and case-sensitive. */
export function flagMatches(input: string, flag: string) {
  return input.trim() === flag;
}

/** Tries available now from the stored bucket; a member who never missed has the full bucket. Fractional while refilling. */
export function triesAvailable(bucket: TryBucket | null, now: number) {
  if (!bucket) return wrongFlagLimit.tries;
  return Math.min(wrongFlagLimit.tries, bucket.tokens + Math.max(0, now - bucket.tokensAt) / wrongFlagLimit.refillMs);
}

/** When the next try opens, for a bucket with less than one try left. */
export function nextTryAt(available: number, now: number) {
  return now + Math.ceil((1 - available) * wrongFlagLimit.refillMs);
}
