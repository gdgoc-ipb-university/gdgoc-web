import { describe, expect, it } from "vitest";
import { clampPlacement, friendTags, isInAppBrowser, isMobileBrowser, photoRect, twibbon, twibbonCaption } from "./twibbon";

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

const agents = {
  chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36",
  instagramIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.25.88 (iPhone15,2; iOS 18_6; id_ID; id; scale=3.00; 1179x2556; 789012345)",
  instagramAndroid: "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.0.0 Mobile Safari/537.36 Instagram 400.0.0.25.88 Android",
  facebook: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/500.0.0.40.100;FBBV/1;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.6;FBSS/3;FBID/phone;FBLC/id_ID;FBOP/5]",
  tiktok: "Mozilla/5.0 (Linux; Android 13; 2201117TG Build/TKQ1.221114.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.0.0 Mobile Safari/537.36 trill_380000 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/38.0.0 ByteLocale/id ByteFullLocale/id Region/ID BytedanceWebview/d8a21c6",
  line: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/15.0.0",
  webView: "Mozilla/5.0 (Linux; Android 12; Redmi Note 11 Build/SKQ1.211103.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.0.0 Mobile Safari/537.36",
};

describe("the browser saving the twibbon", () => {
  it("spots the in-app browsers that drop downloads", () => {
    for (const agent of [agents.instagramIphone, agents.instagramAndroid, agents.facebook, agents.tiktok, agents.line, agents.webView]) {
      expect(isInAppBrowser(agent), agent).toBe(true);
    }
    for (const agent of [agents.chrome, agents.safariIphone, agents.chromeAndroid]) expect(isInAppBrowser(agent), agent).toBe(false);
    // "Online/" is not LINE.
    expect(isInAppBrowser(`${agents.chrome} Online/1.0`)).toBe(false);
  });

  it("tells phones from desktops", () => {
    expect(isMobileBrowser(agents.safariIphone)).toBe(true);
    expect(isMobileBrowser(agents.chromeAndroid)).toBe(true);
    expect(isMobileBrowser(agents.chrome)).toBe(false);
  });
});
