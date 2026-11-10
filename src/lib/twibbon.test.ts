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
    expect(clampPlacement(landscape, { zoom: 0.2, x: 0, y: 0 }).zoom).toBe(1);
    expect(clampPlacement(landscape, { zoom: 99, x: 0, y: 0 }).zoom).toBe(twibbon.maxZoom);
    const moved = photoRect(portrait, { zoom: 1, x: 300, y: -1000 });
    expect(moved.left).toBe(0);
    expect(moved.top + moved.height).toBe(twibbon.height);
  });
});

describe("the twibbon caption", () => {
  it("fills in the name, school or campus and the friends to tag", () => {
    const caption = twibbonCaption({ name: " Teman Uji ", origin: "SMKN 1 Bogor", friends: "@satu, dua  @@tiga" });
    expect(caption).toContain("Halo, aku Teman Uji dari SMKN 1 Bogor.");
    expect(caption).toContain("@gdgoc.ipb @satu @dua @tiga");
    expect(caption).toContain("gdgocipb.com/gb-member");
  });

  it("keeps placeholders for blank fields", () => {
    const caption = twibbonCaption({ name: "", origin: " ", friends: "" });
    expect(caption).toContain("aku [nama] dari [sekolah/kampus]");
    expect(caption).toContain("@gdgoc.ipb @teman1 @teman2 @teman3");
    expect(friendTags(" , ")).toEqual([]);
  });
});
