import { cr80, divisionAccent, nameFit, photoAt } from "@/lib/member-card";
import { memberTagLabel, type MemberType } from "@/lib/onboarding";
import { withDpi } from "@/lib/png";
import { qrMatrix } from "@/lib/qr";
import { pixelIconPaths } from "../pixel-icons";
import { passArt, passFont, periodLabel, townLayout } from "../member-card-face";

export type CardImage = {
  name: string; photo: string | null; campus: string; studyProgram: string; number: string; period: string;
  memberType: MemberType | null; division: string | null; tagConfirmed: boolean; url: string;
};

/**
 * One sheet for the printer (#142): front and back at CR80 trim size, 638 × 1011 px at 300 dpi each, side by side
 * 10 mm apart on a 5 mm margin, with crop marks outside the trim and a line of text below the marks.
 */
export const sheet = { margin: 59, gap: 118, mark: 30, markGap: 8, caption: 44 };
export const sheetSize = { width: sheet.margin * 2 + cr80.width * 2 + sheet.gap, height: sheet.margin * 2 + cr80.height + sheet.caption };

/**
 * The QR on the back: the 370 px plate interior from the Figma page, cut down to whole pixels per module so no module
 * edge is anti-aliased, and centred in it. A card link is 41 modules with its quiet zone: 9 px each, 369 px, 31.2 mm.
 */
export function qrPlacement(modules: number) {
  const cell = Math.floor(370 / modules), size = cell * modules;
  return { cell, size, offset: Math.floor((370 - size) / 2) };
}

const ink = "#172d43", muted = "#596775", paper = "#faf9f2", line = "#d9dfd7";

/** The family a CSS font variable resolves to, so the saved image uses the site's fonts. */
function fontOf(variable: string, fallback: string) {
  return `${getComputedStyle(document.body).getPropertyValue(variable).trim() || fallback}, ${fallback}`;
}

/** An image, or null when it does not load; a photo without CORS would taint the canvas, so it falls back to the initial. */
async function loadImage(src: string | null, crossOrigin?: "anonymous") {
  if (!src) return null;
  const image = new window.Image();
  if (crossOrigin) image.crossOrigin = crossOrigin;
  image.src = src;
  return image.decode().then(() => image, () => null);
}

/**
 * Both sides of the card drawn for printing and for a poor connection at the venue, with every measure from the "ID
 * Card" page at 1:1. The faces' text, art and strip match the web; the punch slot stays empty, as on the printed card.
 */
export async function drawCardImage(card: CardImage) {
  // The titling falls back to Pixelify Sans for glyphs VCR OSD Mono lacks, as on the face.
  const pixel = fontOf("--font-pixel", "monospace"), vcr = `${passFont.family}, ${pixel}`, space = fontOf("--font-space", "sans-serif"), body = fontOf("--font-body", "sans-serif"), mono = fontOf("--font-mono", "monospace");
  // Load each face first, as some are not preloaded. Only the first family: Next's local() fallback faces can fail to
  // load, which would end the wait early. A face that still fails only falls back.
  await Promise.all([`400 54px ${passFont.family}`, `400 110px ${pixel}`, `500 30px ${space}`, `700 26px ${space}`, `400 17px ${body}`, `500 18px ${body}`, `500 19px ${mono}`]
    .map((font) => document.fonts.load(font.replace(/,.*$/, "")).catch(() => [])));
  const names = Object.keys(passArt) as (keyof typeof passArt)[];
  const [photo, ...loaded] = await Promise.all([loadImage(photoAt(card.photo, 400), "anonymous"), ...names.map((name) => loadImage(passArt[name].src))]);
  const art = Object.fromEntries(names.map((name, index) => [name, loaded[index]])) as Record<keyof typeof passArt, HTMLImageElement | null>;
  if (names.some((name) => !art[name])) throw new Error("art");

  const canvas = document.createElement("canvas");
  canvas.width = sheetSize.width; canvas.height = sheetSize.height;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("canvas");
  g.imageSmoothingEnabled = false;
  const draw = (name: keyof typeof passArt, x: number, y: number, width: number) => g.drawImage(art[name]!, x, y, width, width * passArt[name].height / passArt[name].width);
  // Text centred on its CSS line box. `outline` is a stroke in the text's own colour under the fill, the outlined capitals.
  const text = (value: string, x: number, top: number, lineHeight: number, font: string, color: string, spacing = 0, outline = 0) => {
    g.font = font; g.fillStyle = color; g.letterSpacing = `${spacing}px`; g.textBaseline = "middle";
    if (outline) { g.strokeStyle = color; g.lineWidth = outline; g.lineJoin = "miter"; g.strokeText(value, x, top + lineHeight / 2); }
    g.fillText(value, x, top + lineHeight / 2); g.letterSpacing = "0px";
  };
  const width = (value: string, font: string, spacing = 0) => { g.font = font; g.letterSpacing = `${spacing}px`; const result = g.measureText(value).width; g.letterSpacing = "0px"; return result; };
  const icon = (name: "building" | "calendar" | "check", x: number, y: number, size: number, color: string) => {
    g.save(); g.translate(x, y); g.scale(size / 24, size / 24); g.fillStyle = color;
    for (const path of pixelIconPaths[name]) g.fill(new Path2D(path));
    g.restore();
  };
  const mid = cr80.width / 2;

  /** What both sides share: paper, clouds, confetti, the head, and the strip on grass and road. Returns where the head ends. */
  const side = (which: "front" | "back") => {
    g.fillStyle = paper; g.fillRect(0, 0, cr80.width, cr80.height);
    const clouds = which === "front" ? [[27, 69], [491, 77]] : [[491, 69]];
    for (const [x, y] of clouds) draw("cloud", x, y, 120);
    const confetti = which === "front"
      ? [[75, 115, "#ea4335"], [117, 157, "#fbbc05"], [61, 180, "#4285f4"], [565, 107, "#4285f4"], [593, 197, "#34a853"], [563, 229, "#fbbc05"]] as const
      : [[75, 115, "#ea4335"], [61, 178, "#4285f4"], [569, 115, "#34a853"], [585, 178, "#fbbc05"]] as const;
    for (const [x, y, color] of confetti) { g.fillStyle = color; g.fillRect(x, y, 12, 12); }
    const town = townLayout[which];
    for (const [name, x, y, w] of town.art) draw(name, x, town.top + y, w);
    g.fillStyle = "#4c9a45"; g.fillRect(0, 965, cr80.width, 14);
    g.fillStyle = "#5d6870"; g.fillRect(0, 979, cr80.width, 32);
    g.fillStyle = "#fff"; for (let x = -15; x < cr80.width; x += 72) g.fillRect(x, 992, 36, 6);
    // The head: mark, chapter name and year, 12 px apart on the front and 8 px on the back.
    const [markWidth, org, year, gap] = which === "front" ? [92, 30, 24, 12] : [77, 26, 22, 8];
    let y = 93;
    draw("mark", mid - markWidth / 2, y, markWidth);
    y += markWidth * passArt.mark.height / passArt.mark.width + gap;
    g.textAlign = "center";
    text("GDGoC IPB University", mid, y, org * 1.25, `500 ${org}px ${space}`, ink);
    y += org * 1.25 + gap;
    text(card.period.toUpperCase(), mid, y, year * 1.2, `400 ${year}px ${vcr}`, muted, year * .06, year * .05);
    return y + year * 1.2;
  };

  const front = () => {
    let y = side("front") + 12;
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
    for (const lineText of name.lines) { text(lineText, mid, y, name.px * 1.2, `400 ${name.px}px ${vcr}`, ink, name.px * .02, name.px * .08); y += name.px * 1.2; }
    y += 12;
    text(card.number.toUpperCase(), mid, y, 38 * 1.2, `400 38px ${vcr}`, ink, 38 * .06, 38 * .08);
    y += 38 * 1.2 + 12;
    // The role bar in the division's colour, with the verified mark under the role.
    const tag = card.memberType ? memberTagLabel(card.memberType, card.division) : "";
    if (!tag) return;
    const barHeight = 14 + 26 * 1.3 + (card.tagConfirmed ? 16 * 1.4 : 0) + 14;
    g.fillStyle = divisionAccent(card.division); g.fillRect(35, y, 568, barHeight);
    let size = 26;
    while (size > 18 && width(tag, `700 ${size}px ${space}`) > 528) size--;
    text(tag, mid, y + 14, 26 * 1.3, `700 ${size}px ${space}`, "#fff");
    if (card.tagConfirmed) {
      const label = "TERVERIFIKASI", labelWidth = width(label, `500 16px ${mono}`, 1.6), x = mid - (18 + 8 + labelWidth) / 2, top = y + 14 + 26 * 1.3;
      icon("check", x, top + (16 * 1.4 - 18) / 2, 18, "#fff");
      g.textAlign = "left";
      text(label, x + 26, top, 16 * 1.4, `500 16px ${mono}`, "#fff", 1.6);
      g.textAlign = "center";
    }
  };

  const back = () => {
    // Whole pixels from here, so the modules land on the pixel grid.
    let y = Math.round(side("back") - 5 + 16);
    // The plate: 3 px ink border, white, and the QR on whole pixels per module with its quiet zone.
    g.fillStyle = ink; g.fillRect(123, y, 392, 392);
    g.fillStyle = "#fff"; g.fillRect(126, y + 3, 386, 386);
    const matrix = qrMatrix(card.url), qr = qrPlacement(matrix.length), qx = 134 + qr.offset, qy = y + 11 + qr.offset;
    g.fillStyle = "#000";
    matrix.forEach((cells, my) => cells.forEach((dark, mx) => { if (dark) g.fillRect(qx + mx * qr.cell, qy + my * qr.cell, qr.cell, qr.cell); }));
    y += 392 + 16;
    text(card.number.toUpperCase(), mid, y, 42 * 1.2, `400 42px ${vcr}`, ink, 42 * .06, 42 * .08);
    y += 42 * 1.2 + 16;
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
    y += row + 16;
    g.textAlign = "center";
    text("Tunjukkan QR ini di pintu masuk", mid, y, 18 * 1.5, `500 18px ${body}`, muted);
  };

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
