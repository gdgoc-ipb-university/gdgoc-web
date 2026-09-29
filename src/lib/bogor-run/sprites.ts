/**
 * Frame rectangles inside the Bogor Run sprite sheets, in sheet pixels (one pixel = one world unit, so a frame's
 * w/h is the actor's world size). Every dino frame has its feet on the frame's bottom row; the duck frames sit at
 * the bottom of the 47px-tall sheet. `duckCrash` is the first duck frame with the crash's X eyes, for a crash while
 * ducking (the duck hitbox reaches further forward than the standing crash frame). The elang faces left and its body
 * spans y 8..32 of its frame (its hitbox).
 */
export type Frame = { x: number; y: number; w: number; h: number };
type Sheet<F> = { src: string; width: number; height: number; frames: F };

export const DINO_SHEET = {
  src: "/games/bogor-run/dino.svg",
  width: 353,
  height: 47,
  frames: {
    idle: { x: 0, y: 0, w: 44, h: 47 },
    run: [{ x: 44, y: 0, w: 44, h: 47 }, { x: 88, y: 0, w: 44, h: 47 }],
    crash: { x: 132, y: 0, w: 44, h: 47 },
    duck: [{ x: 176, y: 22, w: 59, h: 25 }, { x: 235, y: 22, w: 59, h: 25 }],
    duckCrash: { x: 294, y: 22, w: 59, h: 25 },
  },
} as const satisfies Sheet<{ idle: Frame; run: readonly [Frame, Frame]; crash: Frame; duck: readonly [Frame, Frame]; duckCrash: Frame }>;

export const ELANG_SHEET = {
  src: "/games/bogor-run/elang.svg",
  width: 92,
  height: 40,
  /** Wings up, then wings down. */
  frames: { flap: [{ x: 0, y: 0, w: 46, h: 40 }, { x: 46, y: 0, w: 46, h: 40 }] },
} as const satisfies Sheet<{ flap: readonly [Frame, Frame] }>;
