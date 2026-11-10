import { describe, expect, it } from "vitest";
import { clampPlacement, friendTags, photoRect, twibbon, twibbonCaption } from "./twibbon";

const landscape = { width: 4000, height: 3000 };
const portrait = { width: 1080, height: 1920 };

describe("placing a photo under the twibbon frame", () => {
  it("covers the whole canvas at zoom 1, centred", () => {
    // Landscape: the height decides, 1440 / 3000.
    expect(photoRect(landscape, { zoom: 1, x: 0, y: 0 })).toEqual({ left: -420, top: 0, width: 1920, height: 1440 });
    // Taller than 3:4: the width decides.
    expect(photoRect(portrait, { zoom: 1, x: 0, y: 0 })).toEqual({ left: 0, top: -240, width: 1080, height: 1920 });
  });

  it("never moves a photo far enough to leave a gap, and keeps the zoom between 1 and the maximum", () => {
    expect(clampPlacement(landscape, { zoom: 1, x: 900, y: 50 })).toEqual({ zoom: 1, x: 420, y: 0 });
    expect(clampPlacement(landscape, { zoom: 2, x: -5000, y: 5000 })).toEqual({ zoom: 2, x: -1380, y: 720 });
    expect(clampPlacement(landscape, { zoom: 0.1, x: 0, y: 0 }).zoom).toBe(twibbon.minZoom);
    expect(clampPlacement(landscape, { zoom: 99, x: 0, y: 0 }).zoom).toBe(twibbon.maxZoom);
    const moved = photoRect(portrait, { zoom: 1, x: 300, y: -1000 });
    expect(moved.left).toBe(0);
    expect(moved.top + moved.height).toBe(twibbon.height);
  });
});

describe("zooming a photo out", () => {
  it("shrinks it inside the canvas and keeps it there", () => {
    // Landscape at zoom 0.5: 960 × 720, centred with white around it.
    expect(photoRect(landscape, { zoom: 0.5, x: 0, y: 0 })).toEqual({ left: 60, top: 360, width: 960, height: 720 });
    // It can move up to the canvas edges, not past them.
    expect(clampPlacement(landscape, { zoom: 0.5, x: 500, y: -900 })).toEqual({ zoom: 0.5, x: 60, y: -360 });
    // Partly zoomed out: the wider side still covers, so it keeps no gap there; the other side stays inside.
    const portraitHalf = photoRect(portrait, { zoom: 0.9, x: 999, y: 999 });
    expect(portraitHalf.left).toBeCloseTo(108);
    expect(portraitHalf.top + portraitHalf.height).toBeCloseTo(twibbon.height + (1728 - 1440));
  });
});

describe("the twibbon caption", () => {
  it("fills in the name, school or campus and the friends to tag", () => {
    const caption = twibbonCaption({ name: " Teman Uji ", origin: "SMKN 1 Bogor", friends: "@satu, dua  @@tiga" });
    expect(caption).toContain("Halo, aku Teman Uji dari SMKN 1 Bogor.");
    expect(caption).toContain("@gdgoc.ipb @satu @dua @tiga");
    expect(caption).toContain("gdgocipb.com/gb-member");
    expect(caption.split("\n").at(-1)).toMatch(/^#OprecMemberGDGOCIPB2627 /);
  });

  it("keeps placeholders for blank fields", () => {
    const caption = twibbonCaption({ name: "", origin: " ", friends: "" });
    expect(caption).toContain("aku [nama] dari [sekolah/kampus]");
    expect(caption).toContain("@gdgoc.ipb @teman1 @teman2 @teman3");
    expect(friendTags(" , ")).toEqual([]);
  });
});
