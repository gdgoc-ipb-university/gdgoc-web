// Cosmetic dino skins for Bogor Run. The Rising Star skin is unlocked on the hidden /rai page; the choice lives in
// this browser only and never reaches the server, so replays and the leaderboard are unaffected.

export type DinoSkin = "classic" | "rising-star";
export const SKIN_KEY = "gdgoc:bogor-run:skin:v1";
/** Same frame table as DINO_SHEET, recoloured: only the fills differ. */
export const SKIN_SHEETS: Record<DinoSkin, string> = {
  classic: "/games/bogor-run/dino.svg",
  "rising-star": "/games/bogor-run/dino-rising-star.svg",
};

export function readSkin(): DinoSkin {
  try { return globalThis.localStorage?.getItem(SKIN_KEY) === "rising-star" ? "rising-star" : "classic"; } catch { return "classic"; }
}

export function writeSkin(skin: DinoSkin) {
  try {
    if (skin === "classic") globalThis.localStorage?.removeItem(SKIN_KEY);
    else globalThis.localStorage?.setItem(SKIN_KEY, skin);
  } catch { /* blocked storage: the skin just lasts until the page closes */ }
}
