import { bleed, cardImage } from "@/lib/card-sheet";
import { cr80, divisionAccent, nameFit, photoAt } from "@/lib/member-card";
import { memberTagLabel, type MemberType } from "@/lib/onboarding";
import { withDpi } from "@/lib/png";
import { qrMatrix } from "@/lib/qr";
import { pixelIconPaths } from "../pixel-icons";
import { faceLayout, passArt, passFont, periodLabel, townLayout } from "../member-card-face";

export type CardImage = {
  name: string; photo: string | null; campus: string; studyProgram: string; number: string; period: string;
  memberType: MemberType | null; division: string | null; url: string;
};

/**
 * One sheet for the printer (#142): front and back at CR80 trim size, 638 × 1011 px at 300 dpi each, side by side
 * 10 mm apart on a 5 mm margin, with crop marks outside the trim and a line of text below the marks.
 */
export const sheet = { margin: 59, gap: 118, mark: 30, markGap: 8, caption: 44 };
export const sheetSize = { width: sheet.margin * 2 + cr80.width * 2 + sheet.gap, height: sheet.margin * 2 + cr80.height + sheet.caption };

/**
 * The QR on the back: 300 px with its quiet zone, 25.4 mm printed, as on the Figma page. A card link is 41 modules, so
 * a module is 7.3 px: each edge is rounded to a whole pixel, giving modules of 7 or 8 px and no anti-aliased edge.
 */
export function qrPlacement(modules: number, size = 300) {
  return { size, edges: Array.from({ length: modules + 1 }, (_, index) => Math.round(index * size / modules)) };
}

const ink = "#172d43", muted = "#596775", paper = "#faf9f2", line = "#d9dfd7";
/** VCR OSD Mono at Figma's automatic line height, its ascent plus descent. */
const vcrLine = .98;

/** The family a CSS font variable resolves to, so the saved image uses the site's fonts. */
function fontOf(variable: string, fallback: string) {
  return `${getComputedStyle(document.body).getPropertyValue(variable).trim() || fallback}, ${fallback}`;
}

/** An image, or null when it does not load. */
async function loadImage(src: string | null) {
  if (!src) return null;
  const image = new window.Image();
  image.src = src;
  return image.decode().then(() => image, () => null);
}

/**
 * The member's photo (uploaded on Convex storage, or Google's), fetched to a blob first so the canvas is never tainted
 * by another origin, and so a photo that does not load falls back to the initial instead of failing the save.
 */
export async function loadPhoto(src: string | null) {
  if (!src) return null;
  try {
    const response = await fetch(src, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" });
    if (!response.ok) return null;
    const url = URL.createObjectURL(await response.blob());
    try { return await loadImage(url); } finally { URL.revokeObjectURL(url); }
  } catch { return null; }
}

type Art = Record<keyof typeof passArt, HTMLImageElement>;
type Fonts = { pixel: string; vcr: string; space: string; body: string; mono: string };

/** The fonts and art every card draws with, loaded once however many cards are drawn. */
async function loadAssets() {
  // The titling falls back to Pixelify Sans for glyphs VCR OSD Mono lacks, as on the face.
  const pixel = fontOf("--font-pixel", "monospace"), vcr = `${passFont.family}, ${pixel}`, space = fontOf("--font-space", "sans-serif"), body = fontOf("--font-body", "sans-serif"), mono = fontOf("--font-mono", "monospace");
  // Load each face first, as some are not preloaded. Only the first family: Next's local() fallback faces can fail to
  // load, which would end the wait early. A face that still fails only falls back.
  await Promise.all([`400 54px ${passFont.family}`, `400 110px ${pixel}`, `700 24px ${pixel}`, `500 30px ${space}`, `700 26px ${space}`, `400 17px ${body}`, `500 18px ${body}`, `500 19px ${mono}`]
    .map((font) => document.fonts.load(font.replace(/,.*$/, "")).catch(() => [])));
  const names = Object.keys(passArt) as (keyof typeof passArt)[];
  const loaded = await Promise.all(names.map((name) => loadImage(passArt[name].src)));
  if (loaded.some((image) => !image)) throw new Error("art");
  const art = Object.fromEntries(names.map((name, index) => [name, loaded[index]])) as Art;
  const fonts: Fonts = { pixel, vcr, space, body, mono };
  return { art, fonts };
}

/**
 * Both sides of the card drawn for printing and for a poor connection at the venue, with every measure from the "ID
 * Card" page at 1:1. The faces' text, art and strip match the web; the punch slot stays empty, as on the printed card.
 * `front` and `back` draw one side with its trim at the context's origin.
 */
function painter(g: CanvasRenderingContext2D, card: CardImage, { art, fonts }: { art: Art; fonts: Fonts }, photo: HTMLImageElement | null) {
  const { pixel, vcr, space, body, mono } = fonts;
  g.imageSmoothingEnabled = false;
  const draw = (name: keyof typeof passArt, x: number, y: number, width: number) => g.drawImage(art[name], x, y, width, width * passArt[name].height / passArt[name].width);
  // Text centred on its CSS line box. `outline` is a stroke in the text's own colour under the fill, the outlined capitals.
  const text = (value: string, x: number, top: number, lineHeight: number, font: string, color: string, spacing = 0, outline = 0) => {
    g.font = font; g.fillStyle = color; g.letterSpacing = `${spacing}px`; g.textBaseline = "middle";
    if (outline) { g.strokeStyle = color; g.lineWidth = outline; g.lineJoin = "miter"; g.strokeText(value, x, top + lineHeight / 2); }
    g.fillText(value, x, top + lineHeight / 2); g.letterSpacing = "0px";
  };
  const width = (value: string, font: string, spacing = 0) => { g.font = font; g.letterSpacing = `${spacing}px`; const result = g.measureText(value).width; g.letterSpacing = "0px"; return result; };
  const icon = (name: "building" | "calendar", x: number, y: number, size: number, color: string) => {
    g.save(); g.translate(x, y); g.scale(size / 24, size / 24); g.fillStyle = color;
    for (const path of pixelIconPaths[name]) g.fill(new Path2D(path));
    g.restore();
  };
  const mid = cr80.width / 2;

  /**
   * The art of a side, then grass and road over it, from `townLayout`. `BackIllustration` on the page reads the same
   * layout, so a new back illustration changes both.
   */
  const town = (which: "front" | "back") => {
    const { top, ground, art: pieces } = townLayout[which];
    for (const [name, x, y, w] of pieces) draw(name, x, top + y, w);
    if (!ground) return;
    g.fillStyle = "#4c9a45"; g.fillRect(0, 965, cr80.width, 14);
    g.fillStyle = "#5d6870"; g.fillRect(0, 979, cr80.width, 32);
    g.fillStyle = "#fff"; for (let x = -15; x < cr80.width; x += 72) g.fillRect(x, 992, 36, 6);
  };

  /** What both sides share: paper and background, clouds, confetti, the art behind the content, and the head. */
  const side = (which: "front" | "back") => {
    const layout = faceLayout[which];
    g.fillStyle = paper; g.fillRect(0, 0, cr80.width, cr80.height);
    draw("background", 0, 0, cr80.width);
    const clouds = which === "front" ? [[27, 69], [491, 77]] : [[27, 69], [491, 69]];
    for (const [x, y] of clouds) draw("cloud", x, y, 120);
    const confetti = which === "front"
      ? [[75, 115, "#ea4335"], [117, 157, "#fbbc05"], [61, 180, "#4285f4"], [565, 107, "#4285f4"], [593, 197, "#34a853"], [563, 229, "#fbbc05"]] as const
      : [[75, 115, "#ea4335"], [61, 178, "#4285f4"], [569, 115, "#34a853"], [585, 178, "#fbbc05"]] as const;
    for (const [x, y, color] of confetti) { g.fillStyle = color; g.fillRect(x, y, 12, 12); }
    town(which);
    // The head: mark, chapter name and year.
    draw("mark", mid - 46, layout.mark, 92);
    g.textAlign = "center";
    text("GDGoC IPB University", mid, layout.org, 30 * 1.4, `500 30px ${body}`, ink);
    text(card.period.toUpperCase(), mid, layout.year, 24 * 1.2, `700 24px ${pixel}`, muted, 24 * .06);
  };

  const front = () => {
    side("front");
    // Photo, name and number in one group, 12 px apart, as Figma's "ID": a two-line name pushes the number down.
    let y = faceLayout.front.id;
    // The photo or pixel initial in a 4 px ink frame with a hard shadow.
    g.fillStyle = ink; g.fillRect(mid - 100 + 6, y + 6, 200, 200); g.fillRect(mid - 100, y, 200, 200);
    g.fillStyle = "#e6eddc"; g.fillRect(mid - 96, y + 4, 192, 192);
    if (photo) {
      const crop = Math.min(photo.naturalWidth, photo.naturalHeight);
      g.imageSmoothingEnabled = true;
      g.drawImage(photo, (photo.naturalWidth - crop) / 2, (photo.naturalHeight - crop) / 2, crop, crop, mid - 96, y + 4, 192, 192);
      g.imageSmoothingEnabled = false;
    } else text(card.name.trim().slice(0, 1).toUpperCase(), mid, y + 4, 192, `400 110px ${pixel}`, ink);
    y += 200 + 12;
    const name = nameFit(card.name);
    for (const lineText of name.lines) { text(lineText.toUpperCase(), mid, y, name.px * vcrLine, `400 ${name.px}px ${vcr}`, ink, name.px * .02, name.px * .08); y += name.px * vcrLine; }
    y += 12;
    text(card.number.toUpperCase(), mid, y, 38 * vcrLine, `400 38px ${vcr}`, ink, 38 * .06, 38 * .08);
    // The role bar near the bottom, over the landmarks: the division's colour, the role line only, and a hard shadow
    // cut at the column's right edge.
    const tag = card.memberType ? memberTagLabel(card.memberType, card.division) : "", top = faceLayout.front.role;
    if (!tag) return;
    g.fillStyle = ink; g.fillRect(35 + 6, top + 6, 568 - 6, 61);
    g.fillStyle = divisionAccent(card.division); g.fillRect(35, top, 568, 61);
    let size = 26;
    while (size > 18 && width(tag, `700 ${size}px ${space}`) > 528) size--;
    text(tag, mid, top + (61 - 26 * 1.3) / 2, 26 * 1.3, `700 ${size}px ${space}`, "#fff");
  };

  const back = () => {
    const layout = faceLayout.back;
    side("back");
    // The 322 px plate: a 3 px ink border, 8 px of white, and the 300 px QR with its quiet zone, every module edge on a
    // whole pixel.
    g.fillStyle = ink; g.fillRect(158, layout.plate, 322, 322);
    g.fillStyle = "#fff"; g.fillRect(161, layout.plate + 3, 316, 316);
    const matrix = qrMatrix(card.url), { edges } = qrPlacement(matrix.length), qx = 169, qy = layout.plate + 11;
    g.fillStyle = "#000";
    matrix.forEach((cells, my) => cells.forEach((dark, mx) => {
      if (dark) g.fillRect(qx + edges[mx], qy + edges[my], edges[mx + 1] - edges[mx], edges[my + 1] - edges[my]);
    }));
    text(card.number.toUpperCase(), mid, layout.number, 42 * vcrLine, `400 42px ${vcr}`, ink, 42 * .06, 42 * .08);
    let y = layout.facts;
    // Campus, a 2 px rule, then validity, each with its icon, in a 520 px block.
    g.textAlign = "left";
    const campus = [card.campus, card.studyProgram].filter(Boolean).join(" · ");
    if (campus) {
      let size = 17;
      while (size > 12 && width(campus, `400 ${size}px ${body}`) > 520 - 38) size--;
      icon("building", 59, y + (17 * 1.45 - 22) / 2, 22, ink);
      text(campus, 97, y, 17 * 1.45, `400 ${size}px ${body}`, ink);
      y += 17 * 1.45 + 12;
      g.fillStyle = line; g.fillRect(59, y, 520, 2);
      y += 2 + 12;
    }
    const row = 19 * 1.3, labelWidth = width("BERLAKU", `500 15px ${mono}`, 1.8);
    icon("calendar", 59, y + (row - 22) / 2, 22, ink);
    text("BERLAKU", 97, y, row, `500 15px ${mono}`, muted, 1.8);
    text(periodLabel(card.period), 97 + labelWidth + 16, y, row, `500 19px ${mono}`, ink);
    g.textAlign = "center";
  };

  return { front, back, text, body };
}

/** One member's print sheet (#142): front and back side by side with crop marks and a line under them. */
export async function drawCardImage(card: CardImage) {
  const [assets, photo] = await Promise.all([loadAssets(), loadPhoto(photoAt(card.photo, 400))]);
  const canvas = document.createElement("canvas");
  canvas.width = sheetSize.width; canvas.height = sheetSize.height;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("canvas");
  const { front, back, text, body } = painter(g, card, assets, photo);
  g.fillStyle = "#fff"; g.fillRect(0, 0, canvas.width, canvas.height);
  for (const [index, drawSide] of [front, back].entries()) {
    const x = sheet.margin + index * (cr80.width + sheet.gap), y = sheet.margin;
    g.save(); g.translate(x, y);
    g.beginPath(); g.rect(0, 0, cr80.width, cr80.height); g.clip();
    drawSide();
    g.restore();
    // Crop marks at each corner, outside the trim.
    g.fillStyle = "#000";
    for (const [cx, cy] of [[x, y], [x + cr80.width, y], [x, y + cr80.height], [x + cr80.width, y + cr80.height]]) {
      const out = (cx === x ? -1 : 1), down = (cy === y ? -1 : 1);
      g.fillRect(out < 0 ? cx - sheet.markGap - sheet.mark : cx + sheet.markGap, cy - 1, sheet.mark, 2);
      g.fillRect(cx - 1, down < 0 ? cy - sheet.markGap - sheet.mark : cy + sheet.markGap, 2, sheet.mark);
    }
  }
  g.textAlign = "left";
  text("Kartu anggota GDGoC IPB · CR80 54 × 85,6 mm · 300 dpi. Tidak berlaku lagi jika QR diganti.", sheet.margin, sheet.margin * 2 + cr80.height, 30, `400 18px ${body}`, muted);
  return canvas;
}

/** The sheet as a PNG that says it is 300 dpi, so it prints at card size. */
export async function cardImagePng(card: CardImage) {
  const canvas = await drawCardImage(card);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("png");
  return new Blob([withDpi(new Uint8Array(await blob.arrayBuffer()), cr80.dpi)], { type: "image/png" });
}

/**
 * Draws cards one by one for the bulk print file (#159), with the same painter as the saved card: fonts and art load
 * once, then each call fetches one member's photo and returns both sides as pixels with bleed (`cardImage` in
 * `src/lib/card-sheet.ts`), and whether the photo loaded. The bleed repeats the trim's edge pixels outward, so a cut a
 * little off shows the card's own colours rather than white.
 */
export async function cardSideRenderer() {
  const assets = await loadAssets();
  const canvas = document.createElement("canvas");
  canvas.width = cardImage.width; canvas.height = cardImage.height;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("canvas");
  const side = (drawSide: () => void) => {
    g.fillStyle = "#fff"; g.fillRect(0, 0, canvas.width, canvas.height);
    g.save(); g.translate(bleed, bleed);
    g.beginPath(); g.rect(0, 0, cr80.width, cr80.height); g.clip();
    drawSide();
    g.restore();
    // Stretch the outermost column and row of the trim across the bleed, the sides first so the corners fill too.
    g.imageSmoothingEnabled = false;
    const right = bleed + cr80.width, bottom = bleed + cr80.height;
    g.drawImage(canvas, bleed, bleed, 1, cr80.height, 0, bleed, bleed, cr80.height);
    g.drawImage(canvas, right - 1, bleed, 1, cr80.height, right, bleed, bleed, cr80.height);
    g.drawImage(canvas, 0, bleed, canvas.width, 1, 0, 0, canvas.width, bleed);
    g.drawImage(canvas, 0, bottom - 1, canvas.width, 1, 0, bottom, canvas.width, bleed);
    return g.getImageData(0, 0, canvas.width, canvas.height);
  };
  return async (card: CardImage) => {
    const photo = await loadPhoto(photoAt(card.photo, 400));
    const { front, back } = painter(g, card, assets, photo);
    return { front: side(front), back: side(back), photo: Boolean(photo) };
  };
}
