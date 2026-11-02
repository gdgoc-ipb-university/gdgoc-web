/** CRC-32 as PNG chunks use it (ISO 3309, reflected 0xedb88320). */
function crc32(bytes: Uint8Array) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return ~crc >>> 0;
}

/**
 * The PNG with a `pHYs` chunk saying it is `dpi` dots per inch, right after the header, so a print shop or a photo app
 * sizes it in millimetres without asking. A canvas never writes one.
 */
export function withDpi(png: Uint8Array, dpi: number) {
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  const perMetre = Math.round(dpi / .0254), chunk = new Uint8Array(4 + 4 + 9 + 4), view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([...("pHYs")].map((char) => char.charCodeAt(0)), 4);
  view.setUint32(8, perMetre); view.setUint32(12, perMetre); chunk[16] = 1; // unit: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, ihdrEnd)); out.set(chunk, ihdrEnd); out.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return out;
}
