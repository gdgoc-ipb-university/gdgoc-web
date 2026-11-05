// The print sheet for member cards in bulk (#159): nine CR80 cards with bleed on A4 portrait, each fronts page followed
// by its backs page mirrored for long-edge duplex, the crop marks and footer, and the CSV manifest. Measures are in mm
// from the page's top-left corner; `card-pdf.ts` turns them into PDF points.

import { toCsv } from "./assignment-export";
import { toJakartaInput } from "./assignment";
import { CARDS_PER_SHEET, photoSourceLabels, type PhotoSource } from "./card-print";
import { cr80 } from "./member-card";
import { memberTagLabel, type MemberType } from "./onboarding";

export const a4 = { width: 210, height: 297 };
const pxToMm = (px: number) => px / cr80.dpi * 25.4;

/**
 * Three columns and three rows of 60 × 91.6 mm slots, CR80 trim plus 3 mm of bleed, touching each other. The grid is
 * centred left to right, so a slot mirrored across the page lands on another slot; the top margin is smaller than the
 * bottom one, which holds the footer.
 */
export const grid = { columns: 3, rows: 3, slot: { width: 60, height: 91.6 }, left: 15, top: 8 };
/**
 * Each card is one image at 300 dpi: the 638 × 1011 px trim and 35 px (2.96 mm) of bleed on every side, centred in its
 * slot. 35.4 px would be 3 mm; whole pixels keep the pixel art and QR modules sharp.
 */
export const bleed = 35;
export const cardImage = { width: cr80.width + bleed * 2, height: cr80.height + bleed * 2 };
/** Crop marks: this far outside the grid's bleed edge, this long, and this thick (0.25 pt). */
export const marks = { gap: 1, length: 3, weight: .25 / 72 * 25.4 };

export type Side = "front" | "back";
export type Box = { x: number; y: number; width: number; height: number };

/**
 * Where slot `index` (0 to 8, in reading order on the fronts page) prints on a page. On the backs page the columns are
 * reversed: printed double-sided and flipped on the long edge, the back of a card lands behind its front.
 */
export function slotBox(index: number, side: Side): Box {
  const at = side === "front" ? index : backSlot(index), row = Math.floor(at / grid.columns), column = at % grid.columns;
  return { x: grid.left + column * grid.slot.width, y: grid.top + row * grid.slot.height, width: grid.slot.width, height: grid.slot.height };
}

/** The slot on the backs page (0 to 8, reading order) that holds the back of the card in front slot `index`. */
export function backSlot(index: number) {
  const row = Math.floor(index / grid.columns), column = index % grid.columns;
  return row * grid.columns + grid.columns - 1 - column;
}

/** The card image in slot `index`, at exactly 300 dpi in the slot's centre. */
export function imageBox(index: number, side: Side): Box {
  const slot = slotBox(index, side), width = pxToMm(cardImage.width), height = pxToMm(cardImage.height);
  return { x: slot.x + (slot.width - width) / 2, y: slot.y + (slot.height - height) / 2, width, height };
}

/** The trim of the card in slot `index`: where it is cut. */
export function trimBox(index: number, side: Side): Box {
  const image = imageBox(index, side), inset = pxToMm(bleed);
  return { x: image.x + inset, y: image.y + inset, width: image.width - inset * 2, height: image.height - inset * 2 };
}

const gridBox: Box = { x: grid.left, y: grid.top, width: grid.columns * grid.slot.width, height: grid.rows * grid.slot.height };

/**
 * The crop marks as line segments `[x1, y1, x2, y2]`: one at each end of every trim line, outside the grid, so no mark
 * prints on a card's bleed. The same marks serve the backs page, since the grid is symmetric left to right.
 */
export function cropMarks() {
  const xs = Array.from({ length: grid.columns }, (_, column) => trimBox(column, "front")).flatMap((box) => [box.x, box.x + box.width]);
  const ys = Array.from({ length: grid.rows }, (_, row) => trimBox(row * grid.columns, "front")).flatMap((box) => [box.y, box.y + box.height]);
  const top = gridBox.y - marks.gap, bottom = gridBox.y + gridBox.height + marks.gap, left = gridBox.x - marks.gap, right = gridBox.x + gridBox.width + marks.gap;
  return [
    ...xs.flatMap((x) => [[x, top - marks.length, x, top], [x, bottom, x, bottom + marks.length]]),
    ...ys.flatMap((y) => [[left - marks.length, y, left, y], [right, y, right + marks.length, y]]),
  ] as [number, number, number, number][];
}

/** One page of the file: its sheet, side, and the card in each slot (in reading order of the fronts page). */
export type SheetPage<T> = { page: number; sheet: number; side: Side; cards: T[] };

/** The pages for `cards` in print order: sheet 1 fronts, sheet 1 backs, sheet 2 fronts, and so on. */
export function sheetPages<T>(cards: T[]): SheetPage<T>[] {
  const sheets = Math.ceil(cards.length / CARDS_PER_SHEET);
  return Array.from({ length: sheets }, (_, index) => cards.slice(index * CARDS_PER_SHEET, (index + 1) * CARDS_PER_SHEET))
    .flatMap((sheet, index) => (["front", "back"] as const).map((side) => ({ page: index * 2 + (side === "front" ? 1 : 2), sheet: index + 1, side, cards: sheet })));
}

/** The numbers on a page in the order they read on it, left to right and top to bottom. */
export function readingOrder<T>(page: SheetPage<T>) {
  return page.cards.map((card, index) => ({ card, box: slotBox(index, page.side) })).sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x).map(({ card }) => card);
}

/** The footer's two lines: the page and side, then the member numbers on it. */
export function footerLines(page: SheetPage<{ number: string }>, pages: number) {
  return [
    `GDGoC IPB · Kartu anggota · Halaman ${page.page} dari ${pages} · Lembar ${page.sheet} · ${page.side === "front" ? "Depan" : "Belakang"} · Cetak bolak-balik, balik di sisi panjang, skala 100%`,
    `Nomor: ${readingOrder(page).map((card) => card.number).join("  ")}`,
  ];
}

/** One card as the manifest lists it; `photoSource` is the photo actually drawn. */
export type ManifestCard = { number: string; name: string; memberType: MemberType | null; division: string | null; photoSource: PhotoSource };

/** The print manifest: each card's number, name, tag, photo source, and its page and slot (1 to 9, reading order) on each side. */
export function manifestCsv(cards: ManifestCard[]) {
  const header = ["Nomor anggota", "Nama", "Peran komunitas", "Foto", "Halaman depan", "Slot depan", "Halaman belakang", "Slot belakang"];
  const rows = sheetPages(cards).filter((page) => page.side === "front").flatMap((page) => page.cards.map((card, index) => [
    card.number, card.name, card.memberType ? memberTagLabel(card.memberType, card.division) : "", photoSourceLabels[card.photoSource], page.page, index + 1, page.page + 1, backSlot(index) + 1,
  ]));
  return toCsv([header, ...rows]);
}

export function printFileName(now: number, extension: "pdf" | "csv") {
  return `kartu-anggota-gdgoc-ipb-${toJakartaInput(now).slice(0, 10)}${extension === "csv" ? "-manifes" : ""}.${extension}`;
}
