# Bogor Run sprites: provenance and cleanup

`public/games/bogor-run/dino.svg` (353 × 47) and `elang.svg` (92 × 40) were drawn from a Codex image generation. The generation was then cleaned up by hand on a pixel grid. The frame table lives in `src/lib/bogor-run/sprites.ts`.

| Frame | Sheet x, y, w, h | Notes |
| --- | --- | --- |
| idle | 0, 0, 44, 47 | Also used in the air and at the one-hour finish line |
| run 1 / run 2 | 44, 0 / 88, 0, 44 × 47 | Same upper body as idle; the back leg, then the front leg, lifts |
| crash | 132, 0, 44, 47 | Idle with X eyes, like the old frame 3 |
| duck 1 / duck 2 | 176, 22 / 235, 22, 59 × 25 | Art is 58 px wide; the last column is empty |
| duck crash | 294, 22, 59 × 25 | Duck 1 with the crash's X eye, for a crash while ducking; added in the review fixes (see the end) |
| elang wings up / down | 0, 0 / 46, 0, 46 × 40 | Faces left; head and body sit within y 8–32 |

## Generation

- **Tool:** the `codex` CLI 0.154 with its built-in `image_gen` tool. The runs are listed in `prompts.json`. Each entry holds the instruction given to `codex exec`, the input images, and the exact prompt that Codex passed to `image_gen`.
- **Chosen output:** `codex-sheet-03.webp`, stored lossless with the same pixels as the original PNG. Its inputs were:
  - `input-layout-guide.webp`: a 6× canvas with one box per frame at the contract sizes, with today's idle dino already placed in box 1.
  - `input-style-reference.webp`: today's dino with the angkot, talas and genangan, at 6×.
  - `codex-sheet-02.webp`: used for the poses and the eagle design.
- **Rejected drafts:** runs 01 and 02 drew the dino about twice as coarse as the eagle. The layout guide is what brought both to one size and scale.

## Cleanup pipeline

1. **Detect.** The background is the median colour of the border (#ecf0df). A pixel is foreground when its L1 distance from the background is over 40. The mask is dilated by 12 px, and connected components give the 8 sprite boxes.
2. **Find the grid.** For each sprite, an edge-energy profile per axis is fitted to the pitch and phase that line up best. The standing dino fits 12.7–12.8 px for each 2-px art cell. The duck fits 10.3 × 11.1 px. The eagle was sampled into a fixed 23 × 20-cell box at 13.4 px.
3. **Sample.** Each source pixel is quantized to the locked palette by weighted RGB distance. Each cell then takes the majority colour of the inner half of the cell. On the eagle, navy votes count 1.6× so that thin outlines survive.
4. **Clean up by hand** on the 2-px cell grid; the result is in `grids.txt`.
   - The old dino, the generation, and the angkot, talas and genangan all use a chunky 2-px pixel, so the new art keeps a 2-px navy outline instead of thinning it to 1 px.
   - The run and crash frames reuse the idle upper body row for row, and the two duck frames share one body; only the legs change.
   - Feet sit on the bottom row of every dino frame. The crash frame uses the old 3 × 3-cell X eye.
   - The duck is low and long, with its head forward and its top at y 1. It fills its hitbox of x 5–54 and y 3–23.
   - The standing dino fills its hitbox of x 9–39 and y 3–44. Only the snout, the tail and the toes stick out, as before.
   - **Eagle:** chestnut head, a black crest tipped with white, a yellow hooked beak, a cream throat, a cream belly with brown bars, and a dark-brown back and wings. The tail is barred and the feet are yellow. The head, body and tail are the same in both frames; only the wing changes.
5. **Emit the SVGs.**
   - Each colour becomes one path made of greedy maximal rectangles. Both row-first and column-first merging are tried, and the shorter result is kept.
   - In `dino.svg`, the shared upper bodies sit in `<defs>`: `#b` is used 4 times and `#d` 3 times. The frames are identical by construction, and the file is about 3.2 KB. The crash eyes are painted over the fourth `#b` and the third `#d`.
6. **Verify.**
   - Rendering each SVG back with librsvg (sharp), and drawing it into a headless-Chromium canvas as the game does, matches the grid pixel for pixel.
   - The previews were checked at 8×: each frame labelled, a lineup with the obstacles, and the hitbox overlays.

## Palette (8 colours or fewer per sheet)

- **Dino:** navy `#172d43`, cream `#f3e6b8`, highlight `#fff3ce`, shade `#e3d099`.
- **Elang:** the navy, cream, highlight and shade above, plus:
  - dark brown `#5b4034`
  - brown `#7a5642`
  - chestnut `#a85d3a`
  - yellow `#f2c64a`, the same as the angkot's headlamp

## Duck and crest redraw (29 September 2026)

After reviewing the first sheet, the user asked for a better duck pose and crest. Two competing drafts were drawn by hand on the grid; the user chose Draft A for both.

- **Duck:** modelled on Chrome's crouch.
  - A long, level back. The standing head moves forward with the same eye, mouth line and shading, one plain row shorter. The tail tip lifts at the rear, and the small arm hangs behind the jaw.
  - The legs are the standing legs at full height, striding like run1 and run2.
  - The body (rows 0–8) is identical in both frames. It fills 86% of the duck hitbox.
  - Grid: `duck-redraw-grid.txt`.
- **Crest:** two bold navy feathers, 2 cells wide, joined into a solid base on the crown.
  - They sweep back and up, the rear one longer, each with a navy-enclosed `#fff3ce` tip.
  - It is identical in both flap frames and keeps a 2-cell gap from the raised wing.
  - Grid: `crest-redraw-grid.txt`.
- **Verification:** a librsvg pixel diff against the previous sheets changed only pixels inside the duck frames (x 176–292, y 23–46) and the crest area (the top 10 rows of each elang frame). Headless-Chromium canvas rendering matched librsvg exactly.

## Duck crash frame (29 September 2026, review fixes)

The review found that a crash while ducking drew the standing crash frame. The duck hitbox reaches 15 units further forward than the standing one, so the X-eyed Dino died short of what hit it: up to about 28 CSS px before a genangan at 1440 px.

- **Frame:** a seventh frame, `duckCrash`, at 294, 22, 59 × 25, which widens the sheet to 353 × 47. It is a third `<use>` of the shared duck body `#d`, with duck 1's legs and the crash frame's 3 × 3-cell X eye. The X sits at frame x 36–41 and y 5–10, over the duck's eye. No new colours.
- **Use:** `runtime.ts` draws it when a run ends in a crash with the Dino ducking on the ground. A crash while running or in the air uses the standing crash frame. A run that reaches the one-hour finish line ends standing, on the idle frame.
- **Code:** `DINO_SHEET.width` in `sprites.ts` is 353, and the poster in `bogor-run.module.css` scales the sheet by 353 / 44. `sprites.test.ts` checks the sheet size and frames against the SVG.
- **Verification:** a librsvg (sharp) render of the new sheet is identical, pixel for pixel, to the chosen Draft A sheet in its first 294 columns, so the six existing frames did not change. The duck crash frame differs from duck 1 in 20 pixels, all inside the eye box, and nothing is drawn above it in rows 0–21.
