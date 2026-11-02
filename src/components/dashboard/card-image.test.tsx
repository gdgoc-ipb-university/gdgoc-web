import jsQR from "jsqr";
import { describe, expect, it, vi } from "vitest";
import { cr80 } from "@/lib/member-card";
import { qrMatrix } from "@/lib/qr";
import { qrPlacement, sheet, sheetSize } from "./card-image";

// next/font runs at build time; in tests it only has to name the font.
vi.mock("next/font/local", () => ({ default: () => ({ className: "font-vcr", variable: "font-vcr", style: { fontFamily: "'vcr'" } }) }));

const link = "https://www.gdgocipb.com/k/abcdefghijklmnopqrst_-";
const mm = (pixels: number) => pixels / cr80.dpi * 25.4;

describe("saved card image", () => {
  it("prints each side at CR80 trim size, 54 × 85.6 mm at 300 dpi, side by side on one sheet", () => {
    expect([cr80.width, cr80.height]).toEqual([638, 1011]);
    expect([mm(cr80.width), mm(cr80.height)].map((value) => Math.round(value * 10) / 10)).toEqual([54, 85.6]);
    expect(sheetSize).toEqual({ width: 59 * 2 + 638 * 2 + 118, height: 59 * 2 + 1011 + 44 });
    // Crop marks stay outside the trim and inside the sheet.
    expect(sheet.markGap).toBeGreaterThan(0);
    expect(sheet.markGap + sheet.mark).toBeLessThanOrEqual(sheet.margin);
    expect(sheet.markGap * 2 + sheet.mark * 2).toBeLessThanOrEqual(sheet.gap);
  });

  it("draws the QR 300 px with its quiet zone, 25.4 mm, every module edge on a whole pixel, and it decodes at that size", () => {
    const matrix = qrMatrix(link), place = qrPlacement(matrix.length), { edges } = place;
    expect(place.size).toBe(300);
    // 25 mm is the floor for the printed code with its quiet zone.
    expect(mm(place.size)).toBeGreaterThanOrEqual(25);
    expect([edges[0], edges.at(-1)]).toEqual([0, 300]);
    const widths = edges.slice(1).map((edge, index) => edge - edges[index]);
    expect(widths.every((width) => Number.isInteger(width) && (width === 7 || width === 8))).toBe(true);
    // The 316 px white plate interior around it, as printed, read back by a decoder.
    const size = 316, pad = 8, pixels = new Uint8ClampedArray(size * size * 4).fill(255);
    matrix.forEach((row, y) => row.forEach((dark, x) => {
      if (!dark) return;
      for (let py = edges[y]; py < edges[y + 1]; py++) for (let px = edges[x]; px < edges[x + 1]; px++) pixels.set([0, 0, 0, 255], ((pad + py) * size + pad + px) * 4);
    }));
    expect(jsQR(pixels, size, size)?.data).toBe(link);
  });
});
