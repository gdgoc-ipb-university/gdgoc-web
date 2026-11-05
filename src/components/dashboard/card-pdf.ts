// The bulk print file (#159), drawn in the browser. Loaded with a dynamic import from the "Cetak kartu" page only.

import { a4, cropMarks, footerLines, imageBox, marks, sheetPages, type ManifestCard } from "@/lib/card-sheet";
import { createPdf, deflate, pdfString, upFiltered, type PdfImage } from "@/lib/pdf";
import { cardSideRenderer, type CardImage } from "./card-image";

export type PrintCard = CardImage & ManifestCard;

const pt = (mm: number) => +(mm * 72 / 25.4).toFixed(3);
/** Lets the page paint and take input between cards. */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function embed(pdf: ReturnType<typeof createPdf>, pixels: ImageData) {
  return pdf.image(pixels.width, pixels.height, await deflate(upFiltered(pixels.data, pixels.width, pixels.height)));
}

/** What a page draws: each card image at 300 dpi in its slot, the crop marks, and the two footer lines. */
function pageContent(placed: { image: PdfImage; box: ReturnType<typeof imageBox> }[], footer: string[]) {
  const height = pt(a4.height);
  const images = placed.map(({ image, box }) => `q ${pt(box.width)} 0 0 ${pt(box.height)} ${pt(box.x)} ${+(height - pt(box.y + box.height)).toFixed(3)} cm /${image.name} Do Q`);
  const lines = cropMarks().map(([x1, y1, x2, y2]) => `${pt(x1)} ${+(height - pt(y1)).toFixed(3)} m ${pt(x2)} ${+(height - pt(y2)).toFixed(3)} l`);
  const text = footer.map((line, index) => `BT /F1 6.5 Tf ${pt(15)} ${pt(7.6 - index * 2.7)} Td ${pdfString(line)} Tj ET`);
  return [...images, `0 G ${pt(marks.weight)} w 0 J`, ...lines, "S", "0.35 0.4 0.46 rg", ...text].join("\n");
}

/**
 * The PDF and the manifest rows for `cards` in print order. Each card is drawn, compressed and written before the next,
 * with a pause between cards, so the tab stays responsive and `onProgress` can move a progress bar.
 */
export async function buildCardPdf(cards: PrintCard[], onProgress: (done: number, total: number) => void) {
  const draw = await cardSideRenderer();
  const pdf = createPdf({ duplex: true });
  const pages = sheetPages(cards), manifest: ManifestCard[] = [];
  let done = 0;
  onProgress(0, cards.length);
  for (const front of pages.filter((page) => page.side === "front")) {
    const back = pages.find((page) => page.sheet === front.sheet && page.side === "back")!;
    const fronts: PdfImage[] = [], backs: PdfImage[] = [];
    for (const card of front.cards) {
      const sides = await draw(card);
      fronts.push(await embed(pdf, sides.front));
      backs.push(await embed(pdf, sides.back));
      manifest.push({ number: card.number, name: card.name, memberType: card.memberType, division: card.division, photoSource: sides.photo ? card.photoSource : "initial" });
      onProgress(++done, cards.length);
      await breathe();
    }
    for (const [page, images] of [[front, fronts], [back, backs]] as const) {
      pdf.page(pt(a4.width), pt(a4.height), pageContent(images.map((image, index) => ({ image, box: imageBox(index, page.side) })), footerLines(page, pages.length)), images);
    }
  }
  return { pdf: pdf.finish(), manifest };
}
