import { encode } from "uqr";

/**
 * The modules of a QR code, quiet zone included. Medium error correction keeps a card link at version 4 (33 modules
 * plus the border), sparse enough to scan from a phone screen at about 30 cm in a dim room, and the four-module border
 * is the quiet zone the standard asks for.
 */
export function qrMatrix(text: string) {
  return encode(text, { ecc: "M", border: 4 }).data;
}

/** One SVG path for the dark modules, a rectangle per run of dark modules in a row. */
export function qrPath(matrix: boolean[][]) {
  let path = "";
  matrix.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      if (!row[x]) { x++; continue; }
      let end = x;
      while (row[end]) end++;
      path += `M${x} ${y}h${end - x}v1h-${end - x}z`;
      x = end;
    }
  });
  return path;
}
