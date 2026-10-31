import { describe, expect, it } from "vitest";
import { indexablePaths } from "./site";

describe("indexable pages", () => {
  it("lists each public page once, as a root-relative path", () => {
    expect(new Set(indexablePaths).size).toBe(indexablePaths.length);
    for (const path of indexablePaths) expect(path).toMatch(/^\/[a-z0-9/-]*$/);
  });

  it("includes the about and join pages", () => {
    expect(indexablePaths).toEqual(expect.arrayContaining(["/tentang", "/bergabung"]));
  });
});
