import { afterEach, describe, expect, it, vi } from "vitest";
import { imageMaxEdge, optimizeImage } from "./image-optimize";

const image = (size: number, type = "image/png", name = "foto.png") => new File([new Uint8Array(size)], name, { type });

function stubBrowser({ width = 4000, height = 3000, output = { size: 1000, type: "image/webp" } } = {}) {
  const drawn: number[][] = [];
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width, height, close: vi.fn() })));
  vi.stubGlobal("OffscreenCanvas", class {
    constructor(public width: number, public height: number) {}
    getContext() { return { drawImage: (_bitmap: unknown, x: number, y: number, w: number, h: number) => drawn.push([x, y, w, h]) }; }
    async convertToBlob() { return new Blob([new Uint8Array(output.size)], { type: output.type }); }
  });
  return drawn;
}
afterEach(() => vi.unstubAllGlobals());

describe("image optimisation", () => {
  it("downscales to the maximum edge and returns a smaller WebP", async () => {
    const drawn = stubBrowser();
    const result = await optimizeImage(image(5_000_000, "image/jpeg", "Foto Lomba.JPG"));
    expect(drawn).toEqual([[0, 0, imageMaxEdge, 1920]]);
    expect(result.name).toBe("Foto Lomba.webp");
    expect(result.type).toBe("image/webp");
    expect(result.size).toBe(1000);
  });

  it("keeps the original when WebP is not smaller or unsupported", async () => {
    stubBrowser({ output: { size: 9_000, type: "image/webp" } });
    const small = image(5_000);
    expect(await optimizeImage(small)).toBe(small);
    stubBrowser({ output: { size: 10, type: "image/png" } });
    const noWebp = image(5_000);
    expect(await optimizeImage(noWebp)).toBe(noWebp);
  });

  it("passes other files through and survives decoding errors", async () => {
    stubBrowser();
    const pdf = new File(["%PDF"], "laporan.pdf", { type: "application/pdf" });
    expect(await optimizeImage(pdf)).toBe(pdf);
    vi.stubGlobal("createImageBitmap", vi.fn(async () => { throw new Error("corrupt"); }));
    const broken = image(5_000);
    expect(await optimizeImage(broken)).toBe(broken);
  });
});
