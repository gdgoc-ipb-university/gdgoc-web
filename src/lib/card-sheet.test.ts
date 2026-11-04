import { describe, expect, it } from "vitest";
import { a4, backSlot, bleed, cardImage, cropMarks, footerLines, grid, imageBox, manifestCsv, sheetPages, slotBox, trimBox, type ManifestCard } from "./card-sheet";
import { cr80 } from "./member-card";

// The bulk print sheet (#159): nine CR80 cards with bleed per A4 page, backs mirrored for long-edge duplex.
const near = (value: number, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;
const slots = Array.from({ length: 9 }, (_, index) => index);
const card = (number: number): ManifestCard & { id: number } => ({ id: number, number: `2627-${String(number).padStart(4, "0")}`, name: `Anggota ${number}`, memberType: "member", division: null, photoSource: "uploaded" });

describe("card sheet layout", () => {
  it("fits nine 60 × 91.6 mm slots on A4 portrait, centred left to right, with room for the footer below", () => {
    expect(grid.slot).toEqual({ width: 60, height: 91.6 });
    const last = slotBox(8, "front");
    expect([slotBox(0, "front").x, a4.width - (last.x + last.width)]).toEqual([15, 15]);
    expect(near(last.y + last.height)).toBe(282.8);
    expect(a4.height - (last.y + last.height)).toBeGreaterThan(grid.top);
    // Slots touch, so the grid is 180 × 274.8 mm.
    expect(near(slotBox(1, "front").x - slotBox(0, "front").x)).toBe(60);
    expect(near(slotBox(3, "front").y - slotBox(0, "front").y)).toBe(91.6);
  });

  it("places each card image at 300 dpi in its slot, with the CR80 trim and about 3 mm of bleed", () => {
    expect(cardImage).toEqual({ width: cr80.width + 70, height: cr80.height + 70 });
    for (const index of slots) {
      const slot = slotBox(index, "front"), image = imageBox(index, "front"), trim = trimBox(index, "front");
      expect(near(image.width / cardImage.width * 300 / 25.4, 6)).toBe(1);
      expect(image.x).toBeGreaterThanOrEqual(slot.x); expect(image.x + image.width).toBeLessThanOrEqual(slot.x + slot.width);
      expect(image.y).toBeGreaterThanOrEqual(slot.y); expect(image.y + image.height).toBeLessThanOrEqual(slot.y + slot.height);
      expect([near(trim.width, 1), near(trim.height, 1)]).toEqual([54, 85.6]);
      expect(near(trim.x - image.x, 2)).toBe(near(bleed / 300 * 25.4, 2));
      expect(near(trim.x - image.x, 1)).toBe(3);
      // The trim is centred in the slot.
      expect(near(trim.x + trim.width / 2)).toBe(near(slot.x + 30));
    }
  });

  it("mirrors the backs for long-edge duplex, so back N lands behind front N", () => {
    expect(slots.map(backSlot)).toEqual([2, 1, 0, 5, 4, 3, 8, 7, 6]);
    for (const index of slots) {
      // Flipped on the long (vertical) edge, a point at x on the back page sits behind width - x on the front.
      const front = trimBox(index, "front"), back = trimBox(index, "back");
      expect(near(a4.width - (back.x + back.width))).toBe(near(front.x));
      expect(back.y).toBe(front.y);
      expect(slotBox(index, "back")).toEqual(slotBox(backSlot(index), "front"));
    }
  });

  it("draws crop marks at every trim line, outside the bleed and on the page", () => {
    const lines = cropMarks();
    expect(lines).toHaveLength(6 * 2 + 6 * 2);
    const grid = { left: 15, top: 8, right: 195, bottom: 282.8 };
    for (const [x1, y1, x2, y2] of lines) {
      const outside = Math.max(x1, x2) <= grid.left || Math.min(x1, x2) >= grid.right || Math.max(y1, y2) <= grid.top || Math.min(y1, y2) >= grid.bottom;
      expect(outside).toBe(true);
      for (const [x, y] of [[x1, y1], [x2, y2]]) { expect(x).toBeGreaterThanOrEqual(3); expect(x).toBeLessThanOrEqual(a4.width - 3); expect(y).toBeGreaterThanOrEqual(3); expect(y).toBeLessThanOrEqual(a4.height - 3); }
    }
    const xs = [...new Set(lines.filter(([x1, , x2]) => x1 === x2).map(([x]) => near(x)))].sort((a, b) => a - b);
    expect(xs).toEqual(slots.slice(0, 3).flatMap((index) => { const trim = trimBox(index, "front"); return [near(trim.x), near(trim.x + trim.width)]; }));
  });

  it("follows each fronts page with its backs page, and says on each which side and numbers it holds", () => {
    const cards = Array.from({ length: 11 }, (_, index) => card(index + 1));
    const pages = sheetPages(cards);
    expect(pages.map((page) => [page.page, page.sheet, page.side, page.cards.length])).toEqual([[1, 1, "front", 9], [2, 1, "back", 9], [3, 2, "front", 2], [4, 2, "back", 2]]);
    expect(footerLines(pages[0], 4)[0]).toBe("GDGoC IPB · Kartu anggota · Halaman 1 dari 4 · Lembar 1 · Depan · Cetak bolak-balik, balik di sisi panjang, skala 100%");
    expect(footerLines(pages[1], 4)[0]).toContain("Halaman 2 dari 4 · Lembar 1 · Belakang");
    expect(footerLines(pages[0], 4)[1]).toBe("Nomor: 2627-0001  2627-0002  2627-0003  2627-0004  2627-0005  2627-0006  2627-0007  2627-0008  2627-0009");
    // Read left to right on the backs page, each row is reversed.
    expect(footerLines(pages[1], 4)[1]).toBe("Nomor: 2627-0003  2627-0002  2627-0001  2627-0006  2627-0005  2627-0004  2627-0009  2627-0008  2627-0007");
    expect(footerLines(pages[3], 4)[1]).toBe("Nomor: 2627-0011  2627-0010");
  });

  it("lists each card in the manifest with its tag, photo source, and page and slot on both sides", () => {
    const cards = [...Array.from({ length: 9 }, (_, index) => card(index + 1)), { ...card(10), name: "=HYPERLINK(1)", memberType: "core" as const, division: "Technical", photoSource: "initial" as const }];
    const lines = manifestCsv(cards).replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Nomor anggota,Nama,Peran komunitas,Foto,Halaman depan,Slot depan,Halaman belakang,Slot belakang");
    expect(lines[1]).toBe("2627-0001,Anggota 1,Member,Foto unggahan,1,1,2,3");
    expect(lines[9]).toBe("2627-0009,Anggota 9,Member,Foto unggahan,1,9,2,7");
    expect(lines[10]).toBe("2627-0010,'=HYPERLINK(1),Core Team · Technical,Inisial,3,1,4,3");
  });
});
