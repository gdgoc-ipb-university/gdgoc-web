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
 * The accent on a card's edge and tag chip: one Google colour per division (#135). Five divisions and four colours, so
 * Secretary Treasurer shares the navy ink with BoD without a division and members. Hex, not CSS variables, because the
 * saved image draws with it too.
 */
export const divisionAccents: Record<(typeof divisions)[number], string> = {
  "Program & Development": "#fbbc05",
  "Media & Creative": "#ea4335",
  "Technical": "#4285f4",
  "Community & External": "#34a853",
  "Secretary Treasurer": "#172d43",
};

export function divisionAccent(division: string | null | undefined) {
  return division && Object.hasOwn(divisionAccents, division) ? divisionAccents[division as keyof typeof divisionAccents] : "#172d43";
}
