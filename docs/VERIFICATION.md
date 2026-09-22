# Verification — 22 September 2026

## Completed checks

- `pnpm install`: completed with an explicit allowlist for the normal `unrs-resolver` native dependency build. ESLint 9 is pinned because the installed Next ESLint plugins declare compatibility through v9.
- `pnpm check`: ESLint, generated Next route types, and TypeScript passed.
- `pnpm build`: production build passed for `/`, `/directions`, `/environment`, and `/icon.svg`.
- Production app served locally on `127.0.0.1:3105`; the development server runs on `127.0.0.1:3104`.
- The production browser loaded the geometric campus: Three.js r186, 8,127 static solids, 15 draw calls including the shadow pass, and 258,506 submitted triangles. No broken images or horizontal overflow were observed in that check. The production-origin console had no warnings or errors.
- All four direction cards and their artwork loaded. Each PNG download corresponds to a real local asset. The four originals plus the selected AHN revision are 1672 × 941 PNGs, with WebP counterparts.
- Responsive viewport reviews: desktop 1440 × 900, mobile 390 × 844, and narrow mobile 320 × 740. Mobile uses separate copy and environment regions; the full scene composition remains visible.
- Hero Dino greeting changes the live status text. A finite jump accompanies it while motion is enabled. A separate keyboard-operable control exposes the same action.
- Pause stops the render loop: the observed frame counter remained at 379 across successive reads while paused.
- Mobile menu opens, Escape closes it and restores focus to its trigger, and the main CTA navigates to the exploration section.
- Pausing mid-reveal leaves all content visible. A specific repair cancels the reveal animation and guarantees full opacity in the paused and reduced-motion modes.
- System reduced motion was emulated in the browser and reset afterward. The main scene rendered a still frame, `data-motion` became `off`, and every reveal remained visible.
- `?webgl=off&motion=off` produced zero hero canvases, a successfully loaded reference image, readable content, and working native links.

## Evidence boundaries

The scene is an original geometric illustration guided by the selected generated image and the supplied building photographs. It is not a measured digital twin or a pixel-identical rendering of the generated artwork.

Responsive testing used browser viewport emulation, not physical phones. Browser reduced motion and the forced fallback were tested; actual GPU context-loss recovery is implemented but was not fault-injected. No public deployment, GitHub remote, registration backend, or external form submission was performed.
