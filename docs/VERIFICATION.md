# Verification — 22 September 2026

## Completed checks

- `pnpm install`: completed with an explicit allowlist for the normal `unrs-resolver` native dependency build. ESLint 9 is pinned because the installed Next ESLint plugins declare compatibility through v9.
- `pnpm check`: ESLint, generated Next route types, and TypeScript passed.
- `pnpm build`: production build passed for `/`, `/directions`, `/environment`, and `/icon.svg`.
- Production app served locally on `127.0.0.1:3105`; the development server runs on `127.0.0.1:3104`.
- The revised production browser loaded the geometric campus: Three.js r186, 12,313 campus/foliage solids plus three terrain ridges and 18 idle draw calls. No broken images or horizontal overflow were observed in that check. The production-origin console had no warnings or errors.
- All four direction cards and their artwork loaded. Each PNG download corresponds to a real local asset. The four originals plus the selected AHN revision are 1672 × 941 PNGs, with WebP counterparts.
- Responsive viewport reviews: desktop 1440 × 900, mobile 390 × 844, and narrow mobile 320 × 740. Mobile uses separate copy and environment regions; the full scene composition remains visible.
- Hero Dino greeting changes the live status text. A finite jump accompanies it while motion is enabled. A separate keyboard-operable control exposes the same action.
- Pause stops the render loop: the observed frame counter remained at 379 across successive reads while paused.
- Mobile menu opens, Escape closes it and restores focus to its trigger, and the main CTA navigates to the exploration section.
- Pausing mid-reveal leaves all content visible. A specific repair cancels the reveal animation and guarantees full opacity in the paused and reduced-motion modes.
- System reduced motion was emulated in the browser and reset afterward. The main scene rendered a still frame, `data-motion` became `off`, and every reveal remained visible.
- `?webgl=off&motion=off` produced zero hero canvases, a successfully loaded reference image, readable content, and working native links.

## Perspective / lighting / foliage / horizon revision

- Compared the revised low three-quarter camera, AHN silhouette, Dino scale, directional lighting, and horizon against the selected `01-hello-campus-ahn-cel-v2.png` illustration.
- Reviewed the production scene at a confirmed 1440 × 810 viewport and the mobile landing at 390 × 844. The heading clears the roof; mobile keeps the complete scene visible below the copy.
- Exercised camera parallax with pointer movement across the scene. A 65 × 65 canopy sample was byte-identical at frames 1,720 and 3,195 while the scene continued animating, after the camera settled. The previous triangular self-shadow artifacts were absent in the inspected foliage.
- Ran topology assertions for a single voxel, adjacent voxels, duplicate cells, an elbow arrangement, and a solid 2 × 2 × 2 block. Exterior face counts and flat normals all passed; shared and duplicate faces are removed.
- The user's cropped screenshot identified a white gap between the left edge of the courtyard and the distant meadow. Added a continuous terrain foundation beneath both. A camera/ground intersection sweep covered 119,313 visible sample points across four desktop/mobile aspect ratios and nine parallax positions; all lie within the corrected foundation bounds.
- Dino greeting still updates the live status; motion pause held the frame counter at 4,201 across successive reads, and resume restarted rendering.
- Re-ran `pnpm check`, `pnpm build`, and `git diff --check` after the final source changes. The local production server was restarted with the updated build.

## Evidence boundaries

The scene is an original geometric illustration guided by the selected generated image and the supplied building photographs. It is not a measured digital twin or a pixel-identical rendering of the generated artwork.

Responsive testing used browser viewport emulation, not physical phones. Browser reduced motion and the forced fallback were tested; actual GPU context-loss recovery is implemented but was not fault-injected. No public deployment, GitHub remote, registration backend, or external form submission was performed.
