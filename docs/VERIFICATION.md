# Verification — 22 September 2026

## Initial and perspective revision checks

The interaction checks in this section document earlier revisions. The latest revision below removes greeting and manual pause controls while preserving automatic reduced motion.

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

## Scene cleanup and foreground revision

- Removed the scene greeting buttons/status, manual motion toggles, location/curiosity caption, and community Dino's click hint. The ordinary Instagram community CTA remains.
- Replaced the dark courtyard line grid with narrow warm tile joints. Added western canopy/understory and aligned the upper pointed window with the central-core emblem in the selected camera view.
- Added near garden geometry with an isolated two-pass blur. Production canvas reports `foreground=blurred-3d-garden`, 16,179 campus/foliage solids, 24 draw calls and 463,387 submitted triangles during idle. Only the foreground plants are blurred.
- Reviewed the updated production scene at 1440 × 810, landing at 1440 × 900, and both routes at 390 × 844. The requested hero UI is absent, corner vegetation is visible, the architecture remains sharp, and no horizontal overflow was observed. The mobile full-scene back link remains at the top.
- Emulated system reduced motion: the production scene reported `motion=paused` and held frame 465 across successive reads. Reset emulation and confirmed animation resumed on the landing. There is no hidden saved manual preference.
- The final production-origin console returned no warnings or errors; the landing had no broken images.
- `pnpm check`, `pnpm build`, and `git diff --check` passed. Restarted the production preview on `127.0.0.1:3105` with the new build.

## Community profile / Salak / light footer — 23 September

- Replaced the generic high horizon ridges with the authored double-summit Salak profile on the left and two low misty foothill layers. Reviewed the silhouette, copy clearance, repositioned clouds, and retained sharp AHN against the reference photograph and local scene.
- Desktop copy retains its original 11% left margin and maximum 740px block. The final headline stays on two lines with no horizontal overflow; body text is 16px on desktop and 14px on mobile. Reviewed desktop at 1440px and 1024px, the 761px desktop breakpoint, mobile at 390px, and narrow mobile at 320px. The final production preview also passed at the user's 504px viewport.
- Header, hero, and closing CTA all use “Gabung member” and the same official GDG chapter URL. Inspected the destination live and confirmed its “Join us” button. No membership action or external form was submitted.
- The invitation and footer are one warm-paper surface (`rgb(250, 249, 242)`). Reviewed the full composition at 1440 × 1000 and the complete mobile footer at 390px. Navigation, contact, and the small pixel garden share that surface; the rejected dark variation is absent.
- Sticky navigation remains at `top: 0`. In the final production app, a menu-to-Program click closed the menu and placed the target at 99.5px below the viewport top while motion and the fine-pointer Lenis path were enabled. The native still-mode path placed it at approximately 100px.
- Re-ran `pnpm check`, `pnpm build`, and `git diff --check` after the final source change. Restarted local production on `127.0.0.1:3105`.
- Final production inspection: `data-backdrop=gunung-salak`, scene ready, 23 idle draw calls, 463,731 submitted triangles, no broken images or heading/page overflow, and no console warnings or errors.

## Evidence boundaries

The scene is an original geometric illustration guided by the selected generated image and the supplied building photographs. It is not a measured digital twin or a pixel-identical rendering of the generated artwork.

Responsive testing used browser viewport emulation, not physical phones. Browser reduced motion and the forced fallback were tested; actual GPU context-loss recovery is implemented but was not fault-injected. No public deployment, GitHub remote, registration backend, or external form submission was performed.
