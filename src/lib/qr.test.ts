import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { qrMatrix, qrPath } from "./qr";

/** Renders the matrix at `scale` pixels per module, as a screen would, and reads it back with a QR decoder. */
function decode(matrix: boolean[][], scale = 4) {
  const size = matrix.length * scale, pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = matrix[Math.floor(y / scale)][Math.floor(x / scale)] ? 0 : 255, at = (y * size + x) * 4;
    pixels.set([value, value, value, 255], at);
  }
  return jsQR(pixels, size, size)?.data;
}

describe("QR codes", () => {
  const link = "https://www.gdgocipb.com/k/abcdefghijklmnopqrst_-";

  it("encodes a card link that a decoder reads back", () => {
    expect(decode(qrMatrix(link))).toBe(link);
  });

  it("keeps a card link at version 4 with a four-module quiet zone", () => {
    const matrix = qrMatrix(link);
    expect(matrix.length).toBe(33 + 8);
    for (const edge of [matrix[0], matrix[3], matrix.at(-1)!, matrix.map((row) => row[0])]) expect(edge.every((dark) => !dark)).toBe(true);
    expect(matrix[4][4]).toBe(true); // the finder pattern starts inside the quiet zone
  });

  it("draws one rectangle per run of dark modules", () => {
    expect(qrPath([[false, true, true, false, true], [true, false, false, false, false]])).toBe("M1 0h2v1h-2zM4 0h1v1h-1zM0 1h1v1h-1z");
    expect(qrPath([[false]])).toBe("");
  });
});
