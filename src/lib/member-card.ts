import { chapterPeriod } from "./chapter";
import type { divisions } from "./onboarding";

/** What a member card verifies as. Guests see every status but `valid` as one "invalid", so a token never confirms an account. */
export type CardStatus = "valid" | "revoked" | "inactive" | "expired" | "unknown";

/** "2627" for 2026/27: the two-digit years that open every member number of that chapter year. */
export function cardPrefix(period: { start: string; end: string } = chapterPeriod) {
  return period.start.slice(2, 4) + period.end.slice(2, 4);
}

/** "2627-0042", the 42nd card opened in 2026/27. */
export function cardNumber(prefix: string, sequence: number) {
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

/** A card token: 128 random bits as 22 URL-safe base64 characters. Anything else is never looked up. */
export const cardTokenPattern = /^[A-Za-z0-9_-]{22}$/;

/** The short path a card's QR opens; short so the QR stays sparse and scans quickly. */
export const cardPath = (token: string) => `/k/${token}`;

/** A Google profile photo at the given pixel size. Google photo URLs end in a size such as `=s96-c`. */
export function photoAt(image: string | null | undefined, size: number) {
  if (!image) return null;
  return /=s\d+-c$/.test(image) ? image.replace(/=s\d+-c$/, `=s${size}-c`) : image;
}

export const cardStatusLabels: Record<CardStatus, string> = {
  valid: "Kartu anggota aktif",
  revoked: "Kartu diblokir pengurus",
  inactive: "Akun anggota dinonaktifkan",
  expired: "Kartu dari tahun chapter sebelumnya",
  unknown: "Kartu tidak dikenal atau QR sudah diganti",
};

/**
 * The role bar's colour on the member pass (#135): one Google colour per division, darkened until white text on it
 * passes WCAG AA. Five divisions and four colours, so Secretary Treasurer shares the navy ink with BoD without a
 * division and members. Hex, not CSS variables, because the saved image draws with it too.
 */
export const divisionAccents: Record<(typeof divisions)[number], string> = {
  "Program & Development": "#a35b00",
  "Media & Creative": "#c5221f",
  "Technical": "#1967d2",
  "Community & External": "#188038",
  "Secretary Treasurer": "#172d43",
};

export function divisionAccent(division: string | null | undefined) {
  return division && Object.hasOwn(divisionAccents, division) ? divisionAccents[division as keyof typeof divisionAccents] : "#172d43";
}

/**
 * The printed card (#142): CR80, 54 × 85.6 mm portrait, and its trim size in pixels at 300 dpi, the unit of every
 * measure on the "ID Card" page of the GDGOC 26/27 Figma file. The web draws the trim at any width and scales by
 * width / 638; the saved image draws it at 1:1.
 */
export const cr80 = { width: 638, height: 1011, dpi: 300 };

/** VCR OSD Mono is monospaced: every glyph advances .59 em, and the name is tracked .02 em. */
const nameAdvance = .59 + .02;

/**
 * Where the front's name wraps, in trim pixels: the clear middle between Tugu Kujang and Gedung AHN, 440 px centred in
 * the 568 px column (99 to 539 px across the trim), so a long name never runs into the landmarks. The name starts at
 * 54 px and steps down to no less than 40 px; `column` and `floor` are only for names that cannot fit otherwise.
 */
export const nameArea = { width: 440, column: 568, size: 54, min: 40, floor: 30 };

/**
 * Greedy word wrap at `px`: each line takes as many words as fit `width`, as Figma and the browser wrap. A word longer
 * than a line fails, unless `split`, which breaks it anywhere. Null past `maxLines`.
 */
function wrapName(words: string[], px: number, width: number, split: boolean, maxLines = 2) {
  const room = Math.floor(width / (nameAdvance * px)), length = (text: string) => text.toUpperCase().length;
  const lines: string[] = [];
  for (let word of words) {
    if (length(word) > room && !split) return null;
    const last = lines.at(-1);
    if (last !== undefined && length(`${last} ${word}`) <= room) { lines[lines.length - 1] = `${last} ${word}`; continue; }
    while (length(word) > room) { lines.push(word.slice(0, room)); word = word.slice(room); }
    lines.push(word);
  }
  return lines.length <= maxLines ? lines : null;
}

/**
 * The name's size in trim pixels, its wrap width and its lines (in the name's own case; both faces set capitals), the
 * one layout the web face and the canvas share (#159):
 * 1. 54 px on one or two lines within the 440 px clear area, stepping down a pixel at a time to 40 px.
 * 2. Still too long at 40 px: whole words across the 568 px column, over the art's edge, rather than smaller type. A
 *    word longer than that breaks anywhere, within the clear area if two lines of it fit there (36 characters).
 * 3. Past two full lines at 40 px (over 46 characters): smaller type down to 30 px, the only case below 40 px.
 */
export function nameFit(name: string) {
  const { width, column, size, min, floor } = nameArea, words = name.trim().split(/\s+/).filter(Boolean);
  for (let px = size; px >= min; px--) {
    const lines = wrapName(words, px, width, false);
    if (lines) return { px, width, lines };
  }
  // Whole words across the column first; then a word broken anywhere, kept within the clear area if it fits there.
  for (const [width, split] of [[column, false], [nameArea.width, true], [column, true]] as const) {
    const lines = wrapName(words, min, width, split);
    if (lines) return { px: min, width, lines };
  }
  for (let px = min - 1; px > floor; px--) {
    const lines = wrapName(words, px, column, true);
    if (lines) return { px, width: column, lines };
  }
  return { px: floor, width: column, lines: wrapName(words, floor, column, true, Infinity)! };
}
