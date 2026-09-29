import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DINO } from "./engine";
import { DINO_SHEET, ELANG_SHEET, type Frame } from "./sprites";

const sheet = (src: string) => readFileSync(new URL(`../../../public${src}`, import.meta.url), "utf8");
const size = (svg: string) => {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  const attr = (name: string) => Number(new RegExp(`\\b${name}="(\\d+)"`).exec(root)?.[1]);
  return { width: attr("width"), height: attr("height"), viewBox: /viewBox="([^"]+)"/.exec(root)?.[1] };
};

describe("sprite sheets", () => {
  it.each([DINO_SHEET, ELANG_SHEET])("matches the size of $src", ({ src, width, height, frames }) => {
    expect(size(sheet(src))).toEqual({ width, height, viewBox: `0 0 ${width} ${height}` });
    for (const frame of Object.values(frames).flat() as Frame[]) {
      expect(frame.x + frame.w).toBeLessThanOrEqual(width);
      expect(frame.y + frame.h).toBeLessThanOrEqual(height);
    }
  });

  it("keeps every dino frame on the ground row, and the duck crash beside the duck frames", () => {
    const { idle, run, crash, duck, duckCrash } = DINO_SHEET.frames;
    for (const frame of [idle, ...run, crash, ...duck, duckCrash]) expect(frame.y + frame.h).toBe(DINO_SHEET.height);
    for (const frame of [idle, ...run, crash]) expect([frame.w, frame.h]).toEqual([DINO.width, DINO.height]);
    for (const frame of [...duck, duckCrash]) expect([frame.w, frame.h]).toEqual([DINO.duckWidth, DINO.duckHeight]);
    expect(duckCrash.x).toBe(duck[1].x + duck[1].w); // the 7th frame, appended to the sheet
  });
});
