// Bulk card printing for staff (#159): what the "Cetak kartu" page prints, and the summary it shows first.
// The members come from `cards.printSelection`; the PDF layout is in `card-sheet.ts`.

import type { MemberType } from "./onboarding";

/** Where a printed card's photo comes from: the member's upload, else the Google photo, else the pixel initial. */
export type PhotoSource = "uploaded" | "google" | "initial";
export const photoSourceLabels: Record<PhotoSource, string> = { uploaded: "Foto unggahan", google: "Foto Google", initial: "Inisial" };

/** One member as `cards.printSelection` returns them: never the QR token. */
export type PrintCandidate = {
  ownerId: string; name: string; memberType: MemberType | null; division: string | null;
  active: boolean; number: string | null; blocked: boolean; photo: PhotoSource;
};

/** Who to print: everyone matching the members table's search and filters, or the members staff ticked. */
export const PICKED_KEY = "dashboard:anggota:cetak";
export const PICKED_PARAM = "pilihan";

/** Cards per A4 sheet, 3 × 3. */
export const CARDS_PER_SHEET = 9;
/** Members per call of `cards.issueFor` and `cards.printCards`, as the server allows. */
export const PRINT_BATCH = 50;

const collator = new Intl.Collator("id-ID", { sensitivity: "base", numeric: true });
export const byName = (a: { name: string }, b: { name: string }) => collator.compare(a.name.trim(), b.name.trim());
/** Print order: by member number, which is the order of the manifest too. Numbers of one year share a prefix. */
export const byNumber = (a: { number: string | null }, b: { number: string | null }) => (a.number ?? "").localeCompare(b.number ?? "");

/** Blocked cards and inactive members scan as invalid, so they are left out unless staff include them. */
export const excluded = (row: Pick<PrintCandidate, "active" | "blocked">) => row.blocked || !row.active;

/**
 * What the page says before printing. `printing` are the cards that print, in print order: every chosen member with this
 * year's number, without the blocked and inactive ones unless `includeExcluded`. `missing` have no number yet and can
 * have one issued (blocked and inactive members cannot). `noUpload` print with the Google photo or the initial.
 */
export function printSummary(rows: PrintCandidate[], { includeExcluded = false } = {}) {
  const printing = rows.filter((row) => row.number && (includeExcluded || !excluded(row))).sort(byNumber);
  const sheets = Math.ceil(printing.length / CARDS_PER_SHEET);
  return {
    printing, sheets, pages: sheets * 2,
    missing: rows.filter((row) => !row.number && !excluded(row)).sort(byName),
    noUpload: printing.filter((row) => row.photo !== "uploaded").sort(byName),
    excluded: rows.filter(excluded).sort(byName),
  };
}

/** Splits a list into batches the server takes. */
export function batches<T>(items: T[], size = PRINT_BATCH) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}
