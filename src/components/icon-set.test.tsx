import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Every icon on the site comes from Pixelarticons through <PixelIcon> (or <Arrow>, which wraps it). Only these files
// may draw their own SVG, and each one is an illustration or a brand mark, not an icon.
const ILLUSTRATIONS = new Set([
  "components/pixel-icons.tsx", // the icon set itself
  "components/icons.tsx", // the pixel Dino mascot
  "components/appreciation/shared.tsx", // the Apresiasi trophy illustration and Google's official G mark
  "components/onboarding/artwork.tsx", // the onboarding campus illustration
  "components/rai/badge.tsx", // the Rising Star badge
  "components/rai/rising-star.tsx", // the /rai sky and its gate star
]);
const root = join(process.cwd(), "src"); // vitest runs from the repo root; jsdom has no file: import.meta.url
const sources = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return sources(path);
  return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
});
const code = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("icon set", () => {
  const files = sources(root).map((path) => ({ path, name: relative(root, path) }));

  it("draws icons only with Pixelarticons", () => {
    const drawing = files.filter(({ path, name }) => !ILLUSTRATIONS.has(name) && /<svg\b/.test(code(path))).map(({ name }) => name);
    expect(drawing).toEqual([]);
  });

  it("uses no arrow or check characters as icons", () => {
    const glyphs = files.flatMap(({ path, name }) => [...code(path).matchAll(/[←→↗↘✓✔]/g)].map((match) => `${name}: ${match[0]}`));
    expect(glyphs).toEqual([]);
  });

  it("keeps every PixelIcon on the 24-unit grid", () => {
    const table = readFileSync(join(root, "components/pixel-icons.tsx"), "utf8");
    const numbers = [...table.matchAll(/"(M[^"]+)"/g)].flatMap((match) => match[1].match(/-?\d+(\.\d+)?/g)!.map(Number));
    expect(numbers.length).toBeGreaterThan(500);
    expect(numbers.every((value) => Math.abs(value) <= 24)).toBe(true);
  });
});
