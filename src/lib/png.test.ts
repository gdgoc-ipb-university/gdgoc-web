import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { withDpi } from "./png";

// A 1 × 1 white PNG, as a canvas would write it: signature, IHDR, IDAT, IEND, and no pHYs.
const pixel = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC", "base64"));

/** The chunks of a PNG, with whether each one's CRC matches, computed independently of the code under test. */
function chunks(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset), list: { type: string; data: Uint8Array; crcOk: boolean }[] = [];
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1; return c >>> 0; });
  const crc = (bytes: Uint8Array) => (bytes.reduce((c, byte) => table[(c ^ byte) & 0xff] ^ c >>> 8, 0xffffffff) ^ 0xffffffff) >>> 0;
  for (let at = 8; at < png.length;) {
    const length = view.getUint32(at), body = png.subarray(at + 4, at + 8 + length);
    list.push({ type: String.fromCharCode(...body.subarray(0, 4)), data: body.subarray(4), crcOk: crc(body) === view.getUint32(at + 8 + length) });
    at += 12 + length;
  }
  return list;
}

describe("PNG resolution", () => {
  it("adds a valid pHYs chunk of 300 dpi right after the header and keeps the image", () => {
    const out = withDpi(pixel, 300), list = chunks(out);
    expect(list.map((chunk) => chunk.type)).toEqual(["IHDR", "pHYs", "IDAT", "IEND"]);
    expect(list.every((chunk) => chunk.crcOk)).toBe(true);
    const phys = new DataView(list[1].data.buffer, list[1].data.byteOffset);
    // 300 dpi is 11811 pixels per metre, the same on both axes, in metres.
    expect([phys.getUint32(0), phys.getUint32(4), list[1].data[8]]).toEqual([11811, 11811, 1]);
    expect(out.subarray(0, 8)).toEqual(pixel.subarray(0, 8));
    expect(inflateSync(list[2].data)).toEqual(inflateSync(chunks(pixel)[1].data));
  });
});
