import { describe, expect, it } from "vitest";
import { createPdf, deflate, pdfString, upFiltered } from "./pdf";

// The print file's PDF writer (#159), read back the way a viewer reads it: header, objects, cross-references, images.
const latin1 = (bytes: Uint8Array) => Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
async function inflate(bytes: Uint8Array<ArrayBuffer>) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer());
}
/** Undoes the PNG "Up" predictor rows back to RGB. */
function unfilter(rows: Uint8Array, width: number, height: number) {
  const stride = width * 3, out = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    expect(rows[y * (stride + 1)]).toBe(2);
    for (let i = 0; i < stride; i++) out[y * stride + i] = (rows[y * (stride + 1) + 1 + i] + (y ? out[(y - 1) * stride + i] : 0)) & 255;
  }
  return out;
}

describe("PDF writer", () => {
  it("filters RGBA rows for the PNG Up predictor, dropping alpha", () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 0, 15, 20, 25, 255, 0, 255, 1, 255]);
    expect([...upFiltered(rgba, 2, 2)]).toEqual([2, 10, 20, 30, 40, 50, 60, 2, 5, 0, 251, 216, 205, 197]);
    expect(unfilter(upFiltered(rgba, 2, 2), 2, 2)).toEqual(new Uint8Array([10, 20, 30, 40, 50, 60, 15, 20, 25, 0, 255, 1]));
  });

  it("escapes text for a content stream", () => {
    expect(pdfString("Nomor (baru) \\ 2627-0001")).toBe("(Nomor \\(baru\\) \\\\ 2627-0001)");
  });

  it("writes pages, a lossless image and a cross-reference table that points at every object", async () => {
    const width = 3, height = 2, rgba = new Uint8ClampedArray(width * height * 4).map((_, index) => (index * 37) % 256);
    const pdf = createPdf({ duplex: true });
    const image = pdf.image(width, height, await deflate(upFiltered(rgba, width, height)));
    pdf.page(595.276, 841.89, `q 10 0 0 10 0 0 cm /${image.name} Do Q\nBT /F1 7 Tf 10 10 Td ${pdfString("Halaman 1 · Depan")} Tj ET`, [image]);
    pdf.page(595.276, 841.89, "0 G 1 w 0 0 m 10 10 l S", []);
    const bytes = new Uint8Array(await pdf.finish().arrayBuffer()), text = latin1(bytes);

    expect(text.startsWith("%PDF-1.7\n%")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    const xref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe("xref");
    const [, first, count] = /^xref\n(\d+) (\d+)\n/.exec(text.slice(xref))!;
    expect([Number(first), Number(count)]).toEqual([0, 9]);
    expect(text).toContain(`/Size ${count} /Root 1 0 R`);
    const entries = text.slice(xref).split("\n").slice(2, 2 + Number(count));
    expect(entries.every((entry) => entry.length === 19)).toBe(true); // 20 bytes with the newline
    entries.slice(1).forEach((entry, index) => expect(text.slice(Number(entry.slice(0, 10))).startsWith(`${index + 1} 0 obj\n`)).toBe(true));

    expect(text).toContain("/ViewerPreferences << /PrintScaling /None /Duplex /DuplexFlipLongEdge >>");
    expect(text).toContain("/Type /Pages /Kids [6 0 R 8 0 R] /Count 2");
    expect(text).toContain("/MediaBox [0 0 595.276 841.89]");
    expect(text).toContain(`/XObject << /${image.name} ${image.id} 0 R >>`);
    // "·" is one WinAnsi byte, as Helvetica reads it.
    expect(text).toContain("(Halaman 1 \xB7 Depan) Tj");

    const header = new RegExp(`${image.id} 0 obj\\n<< /Type /XObject /Subtype /Image /Width 3 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns 3 >> /Length (\\d+) >>\\nstream\\n`).exec(text)!;
    const start = header.index + header[0].length, length = Number(header[1]);
    expect(text.slice(start + length, start + length + 10)).toBe("\nendstream");
    const pixels = unfilter(await inflate(bytes.slice(start, start + length)), width, height);
    expect(pixels).toEqual(new Uint8Array(Array.from(rgba).filter((_, index) => index % 4 !== 3)));
  });
});
