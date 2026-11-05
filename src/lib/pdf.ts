// A small PDF 1.7 writer for the member card print file (#159): pages with RGB images, lines and text in Helvetica.
// Images are compressed losslessly with the browser's own deflate, so a QR or pixel art keeps every pixel, and nothing
// is added to the bundle. Coordinates are PDF points from the bottom-left corner, as in the spec.

/** Bytes for a string the PDF reads as WinAnsi (Latin-1 here); anything outside it becomes "?". */
function latin1(text: string) {
  return Uint8Array.from(text, (char) => { const code = char.charCodeAt(0); return code < 256 ? code : 63; });
}

/** A string literal for a content stream. */
export function pdfString(text: string) {
  return `(${text.replace(/[\\()]/g, (char) => `\\${char}`).replace(/[\r\n]+/g, " ")})`;
}

/** Deflate (zlib) with the browser's CompressionStream, which is PDF's FlateDecode. */
export async function deflate(bytes: Uint8Array<ArrayBuffer>) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * RGBA pixels as RGB rows for a PNG predictor: each row starts with filter 2 ("Up") and holds each byte's difference
 * from the byte above it, which deflate packs far better than raw pixels on flat art. Alpha is dropped.
 */
export function upFiltered(rgba: Uint8ClampedArray, width: number, height: number) {
  const stride = width * 3, out = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    out[row] = 2;
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4, target = row + 1 + x * 3;
      for (let channel = 0; channel < 3; channel++) {
        const value = rgba[source + channel], above = y ? rgba[source - width * 4 + channel] : 0;
        out[target + channel] = (value - above) & 255;
      }
    }
  }
  return out;
}

export type PdfImage = { id: number; name: string };

/**
 * Writes a PDF as it goes: images first, then each page that shows them, then the catalog and cross-reference table
 * in `finish`. Every part stays a separate chunk of the final Blob, so a file of a few hundred cards is never copied
 * into one buffer.
 */
export function createPdf({ duplex = false }: { duplex?: boolean } = {}) {
  const chunks: Uint8Array<ArrayBuffer>[] = [], offsets: number[] = [];
  const pages: number[] = [];
  let length = 0, nextId = 4;
  const write = (part: string | Uint8Array<ArrayBuffer>) => { const bytes = typeof part === "string" ? latin1(part) : part; chunks.push(bytes); length += bytes.length; };
  const object = (id: number, ...body: (string | Uint8Array<ArrayBuffer>)[]) => {
    offsets[id] = length;
    write(`${id} 0 obj\n`); for (const part of body) write(part); write("\nendobj\n");
  };
  const stream = (id: number, dictionary: string, data: Uint8Array<ArrayBuffer>) => object(id, `<< ${dictionary} /Length ${data.length} >>\nstream\n`, data, "\nendstream");

  // A binary comment marks the file as binary for transfer tools. Objects 1 to 3 are the catalog, the page tree and the font.
  write("%PDF-1.7\n"); write(new Uint8Array([37, 226, 227, 207, 211, 10]));
  object(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  return {
    /** An RGB image from `upFiltered` rows, already deflated. */
    image(width: number, height: number, flate: Uint8Array<ArrayBuffer>): PdfImage {
      const id = nextId++;
      stream(id, `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${width} >>`, flate);
      return { id, name: `Im${id}` };
    },
    /** One page of `width` × `height` points drawing `content`, which may show the given images and font `/F1`. */
    page(width: number, height: number, content: string, images: PdfImage[]) {
      const contentId = nextId++, pageId = nextId++;
      stream(contentId, "", latin1(content));
      const xobjects = images.map((image) => `/${image.name} ${image.id} 0 R`).join(" ");
      object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> /XObject << ${xobjects} >> >> >>`);
      pages.push(pageId);
    },
    /** The file. Viewers are asked to print at actual size, and double-sided on the long edge when `duplex`. */
    finish() {
      object(2, `<< /Type /Pages /Kids [${pages.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
      object(1, `<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None${duplex ? " /Duplex /DuplexFlipLongEdge" : ""} >> >>`);
      const xref = length, size = nextId;
      write(`xref\n0 ${size}\n0000000000 65535 f \n`);
      for (let id = 1; id < size; id++) write(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
      write(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
      return new Blob(chunks, { type: "application/pdf" });
    },
  };
}
