# Verification — 25 September 2026

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

## Catalyst / preloader / vibrant garden / footer concepts — 23 September

- Catalyst explicitly names Hustler (project management), Hipster (UI/UX), and Hacker (software development). The descriptions were cross-checked against the local Catalyst role table and the user's correction.
- Throttled browser networking to 350ms latency / 220KB per second and CPU to 4× slowdown. Observed the loading screen while `data-ready=false` and no scene frame existed; after frame 1 the scene became ready, the preloader exited, and body scrolling unlocked. Reset both emulations afterward.
- Forced `?webgl=off` and separately blocked the actual campus JavaScript chunks through browser network emulation. Both cases produced zero main-scene canvases, a fully loaded static image, no remaining loader, and restored scrolling. The 12-second stalled-initialization watchdog is implemented; its timeout was not separately fault-injected.
- Opened the page directly at `#explore` with the hero offscreen. The scene still painted and released the loader; the Program target was at 100.3px below the viewport top. The page remained scrollable.
- Emulated system reduced motion at 320 × 740. The scene rendered, the loader exited, `data-motion=off`, and the main scene remained at frame 2 across two reads. Reset emulation afterward.
- Reviewed the scene at 1440 × 900 and 390 × 844, including the varied green crowns, yellow/coral flowering trees, broad tropical leaves, left signpost, turquoise pond, Salak mist, and blurred foreground. Checked 320px page width with no horizontal overflow. The camera, AHN silhouette, and left-aligned desktop copy remain in place.
- All four generated CTA/footer PNGs are 1586 × 992, with WebP review versions. Visually inspected all four original outputs for readable membership copy, distinct compositions, and a continuous light palette. The gallery rendered two columns at desktop and one at 320px; all four images loaded and cards/headline had no horizontal overflow. Each full-size/download link points to its matching local PNG.
- `pnpm check` passed ESLint and TypeScript; the final `pnpm build` and `git diff --check` passed. The build includes `/footer-directions`. Restarted local production at `127.0.0.1:3105`.
- Final production scene: ready with no loader, 23 draw calls, 438,413 submitted triangles, 15,660 main-scene solids, `garden=mixed-canopies-flowering-tropical-wayfinding`, and no page overflow. Footer background remains `rgb(250, 249, 242)`. The production-origin console reported no warnings or errors.

## Private repository and first public deployment — 23 September

- Updated the hero, About copy, footer invitation, page title, and description to **Komunitas Mahasiswa Bogor**, following the user's instruction before deployment.
- `pnpm check`, `pnpm build`, and `git diff --check` passed. Added the Vercel Next.js configuration, pinned Node.js 24.x, and ignored local Vercel linking files in Git.
- Created `https://github.com/dikaprilio/gdgoc-web` as a private repository. GitHub reported `isPrivate=true`; remote `main` matched application commit `4b457157a008b390851e8ddb83d6702a88ef8f05` after push.
- Deployed with Vercel CLI 59.23.2 to `bibobaggins-projects/gdgoc-web`. Deployment `dpl_BNMd7JQu2j1YxAN5U7r2oo1e8mok` reached `READY` with the production alias `https://gdgoc-web.vercel.app/`. The hosted build installed pnpm 11.22.0 dependencies and compiled Next.js 16.3.5 successfully.
- Opened the public production alias in a browser. Confirmed the Bogor title/description and visible copy, successful removal of the preloader after initialization, a live 3D canvas with Salak and the varied garden, zero broken images, no horizontal overflow, and no console warnings or errors. The main scene reported 23 draw calls and 438,413 submitted triangles.
- CLI-created `.env.local` and `.vercel/project.json` are ignored by Git. No account tokens or local environment files were committed.
- This release was deployed through CLI. Git-triggered automatic deployments have not been configured.

## Convex, Google OAuth and Apresiasi — 24 September

- Created a dedicated `dika/gdgoc-web` Convex project with separate development and production deployments. Deployed the Better Auth component, schema, indexes, and owner/reviewer-protected functions to both.
- Created the dedicated Google Cloud project `gdgoc-web-509612` and `GDGoC Web` OAuth client with user approval. Google reported **In production**. Only `openid`, `profile`, and `email` are requested; client secrets are stored only in Convex.
- `pnpm check`, `pnpm test` (20 tests across 3 files), `pnpm build`, and `git diff --check` passed. Tests exercise actual Better Auth component sessions, expired/unverified users, owner isolation, reviewer allowlists, revision conflicts, retries, validation, review transitions, draft limits, autosave races/recovery and form interactions.
- In Chrome, completed a real Google sign-in through the local Next.js callback and authenticated Convex queries. Created an explicitly labeled development draft, changed its content, waited for **Tersimpan di akun**, reloaded the entire page, reopened the saved draft, and verified its fields were restored. This is a development record, not a public submission.
- Reviewed the authenticated editor at 390px and 320px, including conditional team fields. Document width matched viewport width. Text inputs, selects and textareas were 16px. Emulation was reset afterward; these were browser checks, not physical-device tests.
- Verified that the signed-in non-reviewer receives **Akses khusus tim peninjau**. The reviewer allowlist remains empty until the owner specifies the Google emails to authorize.
- Exercised complete form preview and submit interactions using a temporary local UI fixture, then removed the fixture before the final build. The fixture did not submit to the real backend; backend submission and review transitions are covered by `convex-test`.
- The landing retained both 3D canvases, no overflow, and a sticky header at top 0. Its thin horizontal progress bar advanced from 0 to approximately 0.69 while scrolling and reached full width at the document bottom. The new Apresiasi item caused wrapping at 820px, so the compact menu now starts at 960px; checked opening it, closing with Escape, and focus restoration. Desktop checks returned no console warnings or errors.

- The first production release (`a5b6857`, Vercel deployment `dpl_912tpBWW52ZsmwkeioatezsoUsNr`) reached **Ready** and the production alias was assigned even though the CLI output stream ended with a network fetch error. An independent `vercel inspect` confirmed its final state. `/apresiasi`, `/privasi`, and `/api/auth/get-session` all returned HTTP 200.
- Completed Google login directly on `https://gdgoc-web.vercel.app/apresiasi`, returned through its production callback, and observed the authenticated account and empty production workspace from Convex. No warning/error logs were returned. The development QA draft is isolated from production; no appreciation was submitted or published from the production account.

## Birds and Dino blinking — 25 September

- Added five solid voxel birds above AHN, using a bounded looping flight path, banking, individually phased wingbeats, and gliding intervals. Bodies and two hinged wings use three instanced draw calls, do not enter the static shadow map, and release instance buffers on disposal.
- The main campus Dino and the smaller community Dino share a 14-second blink rhythm with short eyelid closure and an occasional double blink. Eye scaling is centered on the eye instead of the character origin.
- Inspected the desktop environment and landing at 1440px and the landing at 390px. Birds remain above the roof and outside the text area; mobile document width matched the viewport. The main campus rendered 25 idle draw calls and 439,061 triangles.
- Observed the main Dino's closed-eye state and captured a close-up showing the thin horizontal eyelid. Independently observed the smaller community Dino entering its closed-eye state.
- Emulated reduced motion: the campus reported paused motion, open Dino eyes, and five stationary birds. Its frame counter stayed at 3,854 across successive reads. Reset motion emulation afterward. No console warnings or errors were observed during the desktop checks.
- `pnpm check`, `pnpm build`, and `git diff --check` passed. The change is scene-only; the appreciation backend and authentication were not modified.

## Evidence boundaries

The scene is an original geometric illustration guided by the selected generated image and the supplied building photographs. It is not a measured digital twin or a pixel-identical rendering of the generated artwork.

Responsive testing used browser viewport emulation, not physical phones. Browser reduced motion and the forced fallback were tested; actual GPU context-loss recovery is implemented but was not fault-injected. The public deployment and private GitHub remote are verified above. Membership registration still links to the official GDG chapter. The Apresiasi backend and OAuth checks are documented separately above; no Instagram publication was performed.
