/**
 * A member's own profile photo (#146), printed on the member card. The browser crops it to a square and saves
 * `output` × `output` JPEG; the server checks the file itself, whatever the browser said, against these limits.
 */
export const photoLimits = { maxBytes: 5 * 1024 * 1024, minEdge: 400, output: 800, quality: .88 };

export const photoTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoType = typeof photoTypes[number];

export type ImageFacts = { type: PhotoType; width: number; height: number };

const u16 = (bytes: Uint8Array, at: number) => (bytes[at] << 8) | bytes[at + 1];
const u16le = (bytes: Uint8Array, at: number) => bytes[at] | (bytes[at + 1] << 8);
const u24le = (bytes: Uint8Array, at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
const u32 = (bytes: Uint8Array, at: number) => ((bytes[at] << 24) >>> 0) + ((bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]);
const ascii = (bytes: Uint8Array, at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length));

/** JPEG: the first start-of-frame segment carries the size. EXIF rotation may swap them, which a square check ignores. */
function jpeg(bytes: Uint8Array): ImageFacts | null {
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    if (marker === 0xff) { at++; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { type: "image/jpeg", height: u16(bytes, at + 5), width: u16(bytes, at + 7) };
    }
    at += 2 + u16(bytes, at + 2);
  }
  return null;
}

/** WebP: lossy (VP8), lossless (VP8L) and extended (VP8X) files each keep the size in their first chunk. */
function webp(bytes: Uint8Array): ImageFacts | null {
  if (bytes.length < 30) return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8 ") return { type: "image/webp", width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    const [b1, b2, b3, b4] = bytes.subarray(21, 25);
    return { type: "image/webp", width: 1 + (((b2 & 0x3f) << 8) | b1), height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)) };
  }
  if (chunk === "VP8X") return { type: "image/webp", width: 1 + u24le(bytes, 24), height: 1 + u24le(bytes, 27) };
  return null;
}

/** The format and pixel size an image file says it has, read from its first bytes; null for anything else. */
export function imageFacts(bytes: Uint8Array): ImageFacts | null {
  if (bytes.length >= 24 && u32(bytes, 0) === 0x89504e47 && u32(bytes, 4) === 0x0d0a1a0a && ascii(bytes, 12, 4) === "IHDR") {
    return { type: "image/png", width: u32(bytes, 16), height: u32(bytes, 20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return jpeg(bytes);
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return webp(bytes);
  return null;
}

/**
 * Why a stored photo cannot be used, or null. `facts` is null when the file is not a JPEG, PNG or WebP image. A stored
 * type is what the file is served as, so it has to be the format the bytes are.
 */
export function photoProblem(size: number, facts: { type: string; width: number; height: number } | null, contentType?: string) {
  if (size > photoLimits.maxBytes) return "Ukuran foto maksimal 5 MB.";
  if (!facts) return "Gunakan foto JPG, PNG, atau WebP.";
  if (contentType && contentType.split(";")[0].trim().toLowerCase() !== facts.type) return "Jenis file tidak sesuai dengan isinya.";
  return sizeProblem(facts.width, facts.height);
}

/** The minimum size, checked by the browser before cropping and by the server after upload. */
export function sizeProblem(width: number, height: number) {
  if (Math.min(width, height) < photoLimits.minEdge) {
    return `Foto terlalu kecil (${width} × ${height} piksel). Pakai foto minimal ${photoLimits.minEdge} × ${photoLimits.minEdge} piksel agar tetap tajam saat kartu dicetak.`;
  }
  return null;
}

/** A square crop of a source image: `zoom` 1 is the largest square that fits, and `x`, `y` its centre in source pixels. */
export type Crop = { zoom: number; x: number; y: number };
type Size = { width: number; height: number };

/** How far the crop zooms in: up to 4×, and never so far that fewer than `minEdge` source pixels fill the square. */
export const maxZoom = ({ width, height }: Size) => Math.max(1, Math.min(4, Math.min(width, height) / photoLimits.minEdge));

/** The side of the crop square in source pixels. */
export const cropSide = (source: Size, zoom: number) => Math.min(source.width, source.height) / zoom;

/** The crop with its zoom in range and the square inside the image. */
export function clampCrop(source: Size, crop: Crop): Crop {
  const zoom = Math.min(maxZoom(source), Math.max(1, crop.zoom)), half = cropSide(source, zoom) / 2;
  const within = (value: number, length: number) => Math.min(length - half, Math.max(half, value));
  return { zoom, x: within(crop.x, source.width), y: within(crop.y, source.height) };
}

/** The centred crop a new photo starts with. */
export const initialCrop = (source: Size): Crop => ({ zoom: 1, x: source.width / 2, y: source.height / 2 });

/** Where the whole image sits, in CSS pixels, so that the crop fills a square box of `box` pixels. */
export function cropPlacement(source: Size, crop: Crop, box: number) {
  const scale = box / cropSide(source, crop.zoom);
  return { scale, width: source.width * scale, height: source.height * scale, left: box / 2 - crop.x * scale, top: box / 2 - crop.y * scale };
}
