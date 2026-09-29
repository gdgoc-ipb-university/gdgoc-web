import { afterEach, describe, expect, it, vi } from "vitest";
import { readSkin, SKIN_KEY, SKIN_SHEETS, writeSkin } from "./skin";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), removeItem: (key: string) => void values.delete(key), values };
}
afterEach(() => vi.unstubAllGlobals());

describe("dino skins", () => {
  it("defaults to the classic dino and remembers the Rising Star skin", () => {
    const store = storage();
    vi.stubGlobal("localStorage", store);
    expect(readSkin()).toBe("classic");
    writeSkin("rising-star");
    expect(store.values.get(SKIN_KEY)).toBe("rising-star");
    expect(readSkin()).toBe("rising-star");
    writeSkin("classic");
    expect(store.values.has(SKIN_KEY)).toBe(false);
    expect(readSkin()).toBe("classic");
  });

  it("ignores unknown values and blocked storage", () => {
    vi.stubGlobal("localStorage", { getItem: () => "gold" });
    expect(readSkin()).toBe("classic");
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(readSkin()).toBe("classic");
    expect(() => writeSkin("rising-star")).not.toThrow();
  });

  it("points every skin at a sheet in the game folder", () => {
    for (const src of Object.values(SKIN_SHEETS)) expect(src).toMatch(/^\/games\/bogor-run\/dino[\w-]*\.svg$/);
  });
});
