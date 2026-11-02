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
 * The name's size in trim pixels and its lines, wrapped word by word across the 568 px column as Figma and the browser
 * wrap it: 54 px on one or two lines, shrinking only when two lines are not enough. Below 30 px it stays at 30 px on
 * one line and the face wraps anywhere.
 */
export function nameFit(name: string, width = 568, size = 54, min = 30) {
  const text = name.trim().toUpperCase(), words = text.split(/\s+/);
  for (let px = size; px >= min; px--) {
    const fits = (line: string) => line.length * nameAdvance * px <= width;
    const lines: string[] = [];
    for (const word of words) {
      const last = lines.at(-1);
      if (last !== undefined && fits(`${last} ${word}`)) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }
    if (lines.length <= 2 && lines.every(fits)) return { px, lines };
  }
  return { px: min, lines: [text] };
}
