/** Leaderboard helpers shared by Convex and the UI. Weeks start on Monday 00:00 WIB (UTC+7, no DST). */
export const LEADERBOARD_SIZE = 10;
export const BOARD_SIZE = 100;
/** Ranks are counted exactly up to here; a rank past it is reported as null ("1000+"), which keeps rank reads bounded. */
export const RANK_CAP = 1000;
/** Convex rejects arrays longer than this, so longer input logs travel as a `packInputs` string. */
export const INPUT_ARRAY_MAX = 8192;

const DAY = 86_400_000, WIB = 7 * 3_600_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** The week containing `ms`, as the WIB date of its Monday ("YYYY-MM-DD"). */
export function weekKey(ms: number) {
  const day = Math.floor((ms + WIB) / DAY); // Days since 1970-01-01, a Thursday, on the WIB calendar.
  return new Date((day - (((day + 3) % 7) + 7) % 7) * DAY).toISOString().slice(0, 10);
}

function mondayUtc(key: unknown) {
  const match = typeof key === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(key) : null;
  if (!match) return NaN;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  return date.toISOString().slice(0, 10) === key && date.getUTCDay() === 1 ? date.getTime() : NaN;
}

export function isWeekKey(value: unknown): value is string { return !Number.isNaN(mondayUtc(value)); }

/** When the week starts, in epoch ms. NaN for anything that is not a week key. */
export function weekStart(key: string) { return mondayUtc(key) - WIB; }

/** "28 Sep – 4 Okt", or "5–11 Okt" within one month. */
export function weekLabel(key: string) {
  const start = mondayUtc(key);
  if (Number.isNaN(start)) return key;
  const from = new Date(start), to = new Date(start + 6 * DAY);
  const month = MONTHS[to.getUTCMonth()];
  return from.getUTCMonth() === to.getUTCMonth()
    ? `${from.getUTCDate()}–${to.getUTCDate()} ${month}`
    : `${from.getUTCDate()} ${MONTHS[from.getUTCMonth()]} – ${to.getUTCDate()} ${month}`;
}

/**
 * The public name: first name plus last initial ("Aldio Lisafron" → "Aldio L."). A leading initial such as the
 * common "M." for Muhammad is skipped for the first name. Invisible characters are dropped and the result is capped.
 */
export function shortName(full: string) {
  const words = full.replace(/\s+/g, " ").replace(/\p{C}/gu, "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "Pemain";
  const first = Math.max(0, words.findIndex((word) => !/^\p{L}\.?$/u.test(word)));
  const last = words[words.length - 1];
  const suffix = words.length - 1 > first ? ` ${(last.match(/[\p{L}\p{N}]/u)?.[0] ?? Array.from(last)[0]).toUpperCase()}.` : "";
  return Array.from(words[first]).slice(0, 24 - suffix.length).join("") + suffix;
}

/** Packs a flat [tick, code, ...] log as base-36 tick deltas with the code appended ("3c1,01"), about 4 chars an input. */
export function packInputs(inputs: readonly number[]) {
  const parts: string[] = [];
  for (let i = 0; i < inputs.length; i += 2) parts.push((inputs[i] - (i ? inputs[i - 2] : 0)).toString(36) + inputs[i + 1]);
  return parts.join(",");
}

/** The inverse of packInputs; null for anything malformed. The engine's replay still checks every tick and code. */
export function unpackInputs(packed: string, maxNumbers: number): number[] | null {
  if (!packed) return [];
  if (packed.length > maxNumbers * 4) return null; // A delta never needs more than 4 base-36 digits (36^4 > 1.6M ticks).
  const parts = packed.split(",");
  if (parts.length * 2 > maxNumbers) return null;
  const inputs: number[] = [];
  let tick = 0;
  for (const part of parts) {
    if (!/^[0-9a-z]{1,4}[123]$/.test(part)) return null;
    tick += parseInt(part.slice(0, -1), 36);
    inputs.push(tick, +part.slice(-1));
  }
  return inputs;
}
