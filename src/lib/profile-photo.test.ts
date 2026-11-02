import { describe, expect, it } from "vitest";
import { imageFacts, photoLimits, photoProblem } from "./profile-photo";

/** The first bytes of real files, cut after the size: enough for the reader, and small enough to write by hand. */
function pngHead(width: number, height: number) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

/** A JPEG with an APP0 segment before the baseline frame header, as browsers write them. */
function jpegHead(width: number, height: number, marker = 0xc0) {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, marker, 0, 17, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0,
  ]);
}

const riff = (chunk: string, body: number[]) => new Uint8Array([...Array.from("RIFF", (c) => c.charCodeAt(0)), 0, 0, 0, 0, ...Array.from(`WEBP${chunk}`, (c) => c.charCodeAt(0)), 0, 0, 0, 0, ...body, ...new Array(16).fill(0)]);

describe("profile photo files", () => {
  it("reads the format and size from PNG, JPEG and WebP headers", () => {
    expect(imageFacts(pngHead(1200, 900))).toEqual({ type: "image/png", width: 1200, height: 900 });
    expect(imageFacts(jpegHead(800, 800))).toEqual({ type: "image/jpeg", width: 800, height: 800 });
    // Progressive JPEG (SOF2) as phones save them.
    expect(imageFacts(jpegHead(3024, 4032, 0xc2))).toEqual({ type: "image/jpeg", width: 3024, height: 4032 });
    // Lossy: a key frame start code, then 14-bit width and height.
    expect(imageFacts(riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, 0x20, 0x03, 0x58, 0x02]))).toEqual({ type: "image/webp", width: 800, height: 600 });
    // Extended: 24-bit width and height minus one.
    expect(imageFacts(riff("VP8X", [0, 0, 0, 0, 0x1f, 0x03, 0, 0x1f, 0x03, 0]))).toEqual({ type: "image/webp", width: 800, height: 800 });
    // Lossless: the 0x2f signature, then 14-bit width and height minus one.
    expect(imageFacts(riff("VP8L", [0x2f, 0x1f, 0xc3, 0xc7, 0x00]))).toEqual({ type: "image/webp", width: 800, height: 800 });
  });

  it("does not take a file's word for being an image", () => {
    expect(imageFacts(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(imageFacts(new TextEncoder().encode("GIF89a\x20\x03\x20\x03"))).toBeNull();
    expect(imageFacts(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
    expect(imageFacts(new Uint8Array())).toBeNull();
  });

  it("refuses other formats, large files and small images", () => {
    const jpeg = (width: number, height: number) => ({ type: "image/jpeg" as const, width, height });
    expect(photoProblem(200_000, jpeg(800, 800), "image/jpeg")).toBeNull();
    expect(photoProblem(200_000, jpeg(400, 1200), "IMAGE/JPEG; charset=binary")).toBeNull();
    // Stored without a type: the bytes decide.
    expect(photoProblem(200_000, jpeg(800, 800))).toBeNull();
    expect(photoProblem(200_000, jpeg(800, 800), "text/html")).toContain("tidak sesuai dengan isinya");
    expect(photoProblem(200_000, jpeg(800, 800), "image/png")).toContain("tidak sesuai dengan isinya");
    expect(photoProblem(200_000, null, "image/jpeg")).toContain("JPG, PNG, atau WebP");
    expect(photoProblem(photoLimits.maxBytes + 1, jpeg(800, 800))).toContain("5 MB");
    expect(photoProblem(200_000, jpeg(399, 1200))).toBe("Foto terlalu kecil (399 × 1200 piksel). Pakai foto minimal 400 × 400 piksel agar tetap tajam saat kartu dicetak.");
  });
});
