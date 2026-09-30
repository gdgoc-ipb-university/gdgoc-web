# Verification — 28 September 2026

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

## Mouse camera parallax — 25 September

- Inspected Deliverologi's local Three.js scenes and reused their time-based damping approach. Mouse movement now drives a bounded camera dolly across the entire hero, including the membership link, while the HTML copy stays fixed. Leaving the hero or losing focus returns the target to the resting composition.
- Reviewed opposite desktop camera positions with the near blurred plants, Dino, AHN, Salak and clouds in view. The camera offset changed from `0.775,0.693` to `-0.961,-0.841`; the hero copy retained exactly the same bounding rectangle. Hovering the CTA produced `-0.637,0.080` and pointer exit settled to `0.000,0.000`.
- Emulated reduced motion, moved the mouse, and confirmed a centered camera and paused render loop. Frame 3,532 stayed unchanged across reads. Narrow mobile layout remained centered, rendered the full campus, and scrolled without horizontal overflow. These were browser viewport and input-capability checks; synthetic touch dispatch is unsupported by the in-app browser, so a physical touch gesture was not tested.
- No console warnings or errors were reported. Normal rendering remains at 25 draw calls and 439,061 triangles. `pnpm check`, `pnpm build`, and `git diff --check` passed.

## First-time member onboarding — 26 September

- Implemented four screens for name, campus/program, WhatsApp invitation, and GDG Community invitation. Inspected the Ngonlenin combobox primitive and followed its searchable, labeled, keyboard-operated pattern using React Aria Components.
- `pnpm test`: 34 tests across 5 files passed. Coverage includes active verified sessions, owner isolation, required fields and ordering, custom education values, revision conflicts/retries, completion, new-draft prefill without modifying older drafts, focus/error handling, selection without premature submit, mobile Next behavior, pointer submission with input focus retained, Back navigation, and optional invitations.
- Axe-core found no applicable A/AA semantic violations across all four screen fixtures. Rendered contrast was checked separately because JSDOM has no pixel layout. Normal body/hint/placeholder text ratios exceed 4.5:1, the input border exceeds 3:1, and the primary button is 5.17:1. This is scoped verification, not a full WCAG certification.
- Completed real Google sign-in against the development backend, observed automatic onboarding, saved an explicitly labeled development name and education values, and reloaded to confirm the saved invitation screen resumed. Completed the flow without joining either external service, reached the authenticated appreciation workspace, then opened `/onboarding` again and was returned to the workspace without repeating the introduction.
- Reviewed the desktop form and mobile layout at 390 × 844. Text inputs were 16px and exposed the expected `next`/`done` hints. In a 390 × 480 viewport representing reduced keyboard space, the focused program input and dropdown remained visible and the page had no horizontal overflow. This was a viewport/keyboard interaction check, not a physical phone test.
- The WhatsApp destination displayed the expected **Members GDGOC 26/27** invitation. Both invitation links use a new tab, and no membership was submitted or claimed. The development browser reported no warnings or errors after completion.
- The 320px first screen had no horizontal overflow and retained 16px input text. After the authenticated checks, the single clearly labeled onboarding QA profile was removed from development; the temporary internal cleanup function was also removed. No production profile or older appreciation draft was changed by this cleanup.
- The official GDG chapter loaded with its **Join us** button. Production Convex deployment completed with the additive `memberProfiles.by_owner` index and no index deletions, before releasing the new frontend.
- Application commit `69e195b` was pushed to the verified private `dikaprilio/gdgoc-web` repository. Vercel deployment `dpl_AFwSqEz7pj1CHMqrrbGQho62LCT7` passed its production build, reached **READY**, and was aliased to `https://gdgoc-web.vercel.app/`.
- Reloaded the existing signed-in production appreciation workspace and observed its automatic redirect to `/onboarding`, with the four-step indicator and Google-prefilled name. At the 864px browser viewport, the page had no horizontal overflow, the name input was 16px with `enterkeyhint=next`, and the viewport meta included `interactive-widget=resizes-content`. The live form and illustration rendered without console warnings or errors. No production onboarding values were submitted, and the pre-existing production draft was untouched. Temporary browser emulations were reset and QA tabs closed.

## Git-connected deployment on new projects — 27 September

- Created the Convex project `lisafronaldio123/gdgoc-ipb-web` with production deployment `adamant-lobster-969`, and set its own `BETTER_AUTH_SECRET` and `SITE_URL`. A development push created all schema indexes and installed the Better Auth component without errors.
- Created the Vercel project `aldio-lisafrons-projects/gdgoc-ipb-web` (Next.js, Node 24.x), connected it to `gdgoc-ipb-university/gdgoc-web`, set the build command to `pnpm exec convex deploy --cmd 'pnpm build'`, and restricted builds to production with an Ignored Build Step. The production deploy key was piped from Convex into a Vercel secret without being printed or written to the repository.
- Git-sourced deployment `dpl_DHc1qbpmsxx6xgWbte7yGE5AFzp9` of `main` (`8bba65c`) reached **Ready** and was aliased to `https://gdgoc-ipb-web.vercel.app`. The build log shows pnpm 11.22.0, a successful Next.js build, and Convex functions deployed to `adamant-lobster-969`.
- `/`, `/apresiasi`, `/onboarding`, `/privasi`, `/environment`, `/api/auth/get-session` (signed out: `null`), and `/api/auth/convex/jwks` returned HTTP 200. The client bundle references only the production Convex URL.
- Google credentials were not yet configured, so `auth:configuration` reported `googleEnabled: false`. Production Google sign-in was not tested.

## Production domain — 28 September

- The Vercel project `gdgoc-ipb-web` serves the custom domain `gdgocipb.com`. `https://www.gdgocipb.com` is canonical; `gdgocipb.com` already redirected there with a 308.
- Set production Convex `SITE_URL` and Vercel production `NEXT_PUBLIC_SITE_URL` to `https://www.gdgocipb.com`, replacing `https://gdgoc-ipb-web.vercel.app`. Set production `APPRECIATION_ADMIN_EMAILS` to the project owner's verified Google email.
- Configured `gdgoc-ipb-web.vercel.app` as a 308 redirect to `www.gdgocipb.com` in the project's domain settings. `https://gdgoc-ipb-web.vercel.app/dashboard?x=1` and `https://gdgocipb.com/apresiasi` returned 308 to the matching `www.gdgocipb.com` path and query.
- `https://www.gdgocipb.com/dashboard` returned 200, the only deployment its client bundle targets is `adamant-lobster-969` (the bundled Convex library also contains its example URL `happy-otter-123`), `/api/auth/get-session` returned `null` while signed out, and production Convex exposes the dashboard functions from `97968b8`.
- Production `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are not configured, so `auth:configuration` still reports `googleEnabled: false`. Production Google sign-in was not tested.

## Bogor Dino footer game — 28 September

- Found the organization repository `gdgoc-ipb-university/gdgoc-web` through GitHub CLI and fast-forwarded the local main branch to `2d507fb`, including the dashboard and canonical-domain changes. Feature work is based on that organization main, rather than the older personal remote. The existing Git integration deploys main; branch/PR previews are disabled in the documented Vercel configuration.
- The light footer now has a game column, a shifted GDGoC identity column, and community navigation. It includes Dashboard and Privacy links. The membership CTA, cream background, campus environment, and authentication/backend code are retained.
- Created five small SVG pixel assets: two-frame Dino, green angkot, taro basket, rain puddle, and a Salak/Tugu Kujang backdrop. Their combined source size is 4,335 bytes. These are original simplified illustrations, not surveyed landmarks or a transport-route map.
- `pnpm test`: **68 tests across 11 files passed**. New coverage checks collisions with every obstacle, successful jumps at initial and maximum speed, held-key handling, paused scoring, frame/spacing bounds, retries, stored-score validation, scoped keyboard controls, offscreen pause, unmount cleanup, asset-load recovery, and accessible control semantics. `pnpm check`, `pnpm build`, and `git diff --check` passed.
- Browser gameplay demonstrated keyboard jumping, a collision and game-over score of 42, restart, P-to-pause, resumption, and automatic pause after scrolling out of view. Reload preserved the best score. With system reduced motion emulated, the game stayed idle until explicitly started; a timed jump cleared the angkot and reached score 52 before pausing.
- Visually reviewed the footer at 1440 × 1000, 1024 × 900, 390 × 844, and 320 × 740. Desktop uses game/identity/navigation columns; tablet keeps the game alongside the directory; mobile stacks the game and identity above two navigation columns. The document did not overflow horizontally at any checked width. Mobile checks used viewport emulation and browser input, not a physical touch device.
- The game control fixture passed applicable axe-core A/AA checks with pixel contrast evaluated separately. Measured contrast was 5.63:1 for HUD text, 4.90:1 for secondary instructions, and 9.96:1 for the start control. Score ticks do not change the live announcement. The development browser reported no warnings/errors, and the existing campus reported `data-ready=true`. Browser viewport and reduced-motion overrides were reset after QA.
- Served the optimized Next build on `127.0.0.1:3106`. The game loaded its runtime and local SVG assets, started on command, reached a collision at score 42, and exposed the retry control. The production-build browser reported no warnings/errors. These are local build checks; publication follows the organization's main-branch deployment workflow after PR merge.

## Full-width autonomous footer — 28 September

- Fast-forwarded organization main to `4d32a24` after PRs #6 and #7 merged. This revision uses the latest dashboard/navigation routes and is proposed on a fresh branch.
- Replaced the isolated game card and decorative CTA garden with one full-width canvas over a continuous light Bogor landscape. The right-side Dino plays autonomously; taking control opens a wide arena, and returning restores the membership invitation and its keyboard focus. The responsive camera keeps jumps below the game header.
- The Dino uses an original cream/navy SVG sheet with a wider head and torso, short legs, and no accessories. Its four 44 × 47 frames retain the existing collision/animation dimensions. Scenery, obstacles, and Dino are editable SVGs; no Chromium assets are bundled.
- `pnpm test`: **87 tests across 13 files passed**. Coverage includes two minutes of autonomous obstacle cycles, separation from player scores/storage, offscreen and reduced-motion suspension, manual takeover/return, focus restoration, resize pause, cleanup, collision/jump behavior, and projection at 320–1920 px. `pnpm check`, `pnpm build`, and `git diff --check` passed.
- Browser QA covered desktop and 320/355 CSS-pixel mobile widths without horizontal overflow. The local optimized build on `127.0.0.1:3106` demonstrated autoplay, its pause control, personal takeover, game over, keyboard pause, return to the membership CTA, and reduced-motion disabling autoplay; the campus still reached `data-ready=true`. These are browser emulation checks, not physical-device tests.
- After the final Dino redraw, the optimized desktop preview visually confirmed the wider cream/navy silhouette running and jumping in the shared landscape. The full 87-test suite, check, and build passed again; the 44 × 47 frame/collision dimensions are unchanged.
- The control fixture passed axe A/AA rules available in jsdom. Separately calculated contrast: instructions 5.93:1, secondary instructions 4.75:1, action label 10.13:1, directory copy 5.01:1. Score ticks remain outside live announcements. No application warnings/errors appeared in the local production browser checks.
- This is a local production-build verification. Publication continues through the organization's main-branch CI/CD after review/merge; branch previews are disabled by its Vercel configuration.

## Segmented scroll indicator — 28 September

- Follow-up to the full-width footer PR: four equal tracks under the sticky navbar, separated by 3 px gaps. Blue fills over 0–25%, red over 25–50%, yellow over 50–75%, and green over 75–100%; earlier quarters stay filled. Reverse scrolling empties them in reverse order. The indicator remains decorative and does not announce scroll ticks.
- `pnpm test`: **89 tests across 14 files passed**. The two new component tests use real Motion values and transforms to exercise each boundary and midpoint, reverse scrolling, and overscroll clamping. `pnpm check`, `pnpm build`, and `git diff --check` passed.
- The optimized local browser showed all four colors with distinct gaps at the footer, and only a partially filled blue quarter after scrolling back to 20.46%. The measured transform matched the page's scroll fraction. At a 320 CSS-pixel viewport, each track measured 77.75 px, and the page had no horizontal overflow. The final cream Dino, shortened tail, and revised running feet were visually checked in the same local preview.
- This PR is stacked on the footer branch. These checks do not publish production; deployment follows review/merge into organization main.

## Bogor Run v2: ducking, Elang Jawa, sound, and leaderboard — 29 September

- `pnpm test` (two workers): **235 tests across 22 files passed**. The Bogor Run and leaderboard files account for 152 of them: engine 53, sound 35, `convex/bogorRun.test.ts` 13, footer controls 14, runtime 9, projection 13, leaderboard helpers 8, and the dashboard page 7. `pnpm lint` and `pnpm typecheck` passed.
- Engine: identical runs from the same seed and inputs, a clone that resumes identically, and `replayRun` matching the live crash. A source scan fails the test on any math outside the deterministic set. The replay rejects odd lengths, decreasing or out-of-range ticks, bad codes, non-integers, oversized logs, and early crashes. The speed curve starts at 174, rises strictly, and stays below 400. Collision tables cover every obstacle, the three bird heights, and running, ducking, and airborne poses.
- Fairness: a depth-first solver trying none, jump, duck, and stand every four ticks cleared 25 obstacles in a row for 150 seeds from the start and 150 at a speed of at least 390. Every solution from the start replayed cleanly through `replayRun`, and the solver found nothing for deliberately packed angkots. Birds appeared only from 300 points, in all three lanes, and no kind appeared three times in a row. The autopilot survived 90 s for 60 seeds from the start and 60 near top speed; a separate run outside the suite survived 300 seeds of ten minutes each and a full hour.
- Replay cost: a one-hour autopilot log (432,000 ticks, 2,828 inputs, score 137,403) replayed in about 82 ms in Node and about 50 ms inside a mutation on the DEV Convex deployment, well under the 1 s mutation limit.
- DEV Convex deployment: pushed the four new tables and the `bogorRun` functions. Inside a DEV mutation, `crypto.subtle` HMAC-SHA256 reproduced RFC 4231 test case 2 and `bogorRun:issueRun` returned signed tokens. An argument array of 8,193 numbers was rejected, so the client always sends packed input strings, which the tests also cover. Production Convex was not touched.
- Sprites: rendering `dino.svg` and `elang.svg` back, with sharp and in a headless-Chromium canvas as the game draws them, matched the cleaned pixel grids exactly. Frames, the lineup with the obstacles, and the hitbox overlays were reviewed at 8×.
- Sound: measured in headless Chromium, the jump, crash, and milestone sounds together peaked at 0.111, under the 0.12 cap. Tests cover the lazy AudioContext and its `webkitAudioContext` fallback, silence before unlock, while muted, and in a hidden tab, the persisted mute, and cleanup. The runtime tests confirm the demo never plays a sound.
- Browser review in headless Chromium at 1440, 1024, 768, 390, and 320 px: autoplay, running, a mid-height Elang, ducking, pause with the board open, and game over as a guest and after saving, on both tabs. The Google return URL was tidied to `/#join`, and the pending run was submitted. Convex and auth code loaded only after the game scrolled into view. Convex and auth responses were mocked for these captures, and audio was muted.
- `/dashboard/papan-skor` was reviewed at 1440 and 390 px through a temporary preview route with mocked member, staff, pending, error, empty, loading, and far-down boards; the route was deleted afterward. The real route returned 200 and showed the sign-in panel to a guest, with no console errors.

### Manual checklist before release

Not yet done with a real account against the DEV deployment:

- [ ] Guest: play until a crash, choose **Masuk untuk simpan skor**, finish Google sign-in, and confirm the landing returns to the game, shows the same crash, and reports "Tersimpan · peringkat #n minggu ini". Repeat after waiting more than 30 minutes and confirm the expiry notice.
- [ ] Signed in: crash a run and confirm it saves automatically, appears in the in-game top 10 and on `/dashboard/papan-skor`, and a lower score keeps the earlier best.
- [ ] Mute: the speaker button silences the game, stays muted after a reload, and the autoplay demo never makes a sound.
- [ ] Duck with the keyboard: holding ↓ ducks, releasing stands, ↓ in mid-air drops fast, and P while ducking pauses without leaving the Dino crouched on resume.
- [ ] Tap zones on a real phone: tapping the upper half jumps, holding the lower half ducks until release, the zone hint shows once, and a scroll swipe over a stopped game does not restart it.
- [ ] Past 300 points, Elang Jawa appears at all three heights: low must be jumped, middle ducked, and high passes over a grounded Dino.
- [ ] Safari on iOS and macOS: sound starts after the first tap or key press, and still plays after switching away from the tab and back.
- [ ] Staff: hide and restore a player on `/dashboard/papan-skor`, and confirm the landing board updates for a guest.
- [ ] After Monday 00:00 WIB, the "Minggu ini" board starts empty while "Sepanjang masa" keeps its scores.

## Bogor Run review fixes — 29 September

Five reviewers checked Bogor Run v2 for integrity, gameplay, the server, the client, and the UI, and a second pass verified each finding. The user then chose how to handle the ones that needed a decision:

- Accept the bot risk and correct the docs.
- Leave the width-based view scale as it is.
- Keep making the course harder after five minutes, and add a one-hour finish line.
- Moderate with the member-management hierarchy, hide deactivated members, and delete run records after 30 days.
- Fix everything else as the review suggested.

Evidence from this round:

- `pnpm exec vitest run --maxWorkers=2`: **289 tests across 24 files passed**. The Bogor Run, leaderboard and dashboard board files account for 206 of them: engine 61, sound 35, projection 23, footer controls 22, `convex/bogorRun.test.ts` 19, runtime 13, the dashboard page 13, the online client 9, leaderboard helpers 8, and sprite sheets 3. `pnpm typecheck` passed, and `pnpm lint` reported no errors; its 8 warnings are all in untracked `.claude/worktrees` copies. An earlier run of the whole suite, with three workers, timed out once in `convex/appreciations.test.ts` while starting cold; it passed on the rerun and has nothing to do with this change.
- **Early game unchanged.** Before the ramp was written, a fingerprint was recorded from the old engine: every obstacle spawned in the first five minutes for 60 seeds, the generator state at five minutes, and 60 five-minute autopilot runs. The new engine still matches it, and `engine.test.ts` asserts it.
- **Late game is still fair.** The search solver cleared 25 obstacles in a row for 150 seeds at each of three points: the start, 28 minutes in (speed ≈ 390, pressure ≈ 0.69), and the last 100 seconds before the finish line (pressure ≈ 0.84). The two late sets included 1,374 and 1,558 cluster followers. A brute-force search tried every takeoff tick over 12 seeds, from five minutes to the hour:
  - the tightest cluster window was 13 ticks (108 ms);
  - single obstacles and low birds left at least 58 ticks;
  - two consecutive jumps always had at least 25 ticks (208 ms) to spare, so none needed a fast-drop.

  The suite's own sample (16 seeds at each of three points, 1,086 clusters and 1,726 back-to-back pairs) found the same 13-tick floor.
- **Tuning.** These runs used the gameplay review's human-like bot: 0.30 s reaction, 0.15 s more for birds, and ±60 ms timing noise. It was made cluster-aware, so it jumps each cluster once, aimed at its middle.
  - At 1440 px, the median run lasted 21.9 and 21.3 minutes on two sets of 100 seeds (p10 about 13.5, p90 about 36.5). None of the 200 runs reached the hour.
  - At 1024 px the median was 20.9 minutes (60 seeds).
  - A sharper bot (0.25 s reaction, 0.1 s more for birds, ±50 ms) had a median of 38.7 minutes and finished 24 of 100 runs.
  - At 390 px the median was 7.6 minutes, against 11.1 on the old engine, or 10.0 if the bot reacts as soon as it first sees a cluster. That gap comes from the width-based view, which was left as is.
  - The reviewer's bot without the cluster change dies at about 5.9 minutes. It plans a separate jump for each obstacle in a cluster, and its retries jump into the next obstacle, so that number reflects the bot, not the course.
- **Finish line.** A run that reaches 432,000 ticks ends finished with no hit, and a crash on that very tick is still a crash. The demo autopilot played four whole hours to the line.
  - Replaying a finished hour (seed 424242, 3,293 inputs, score 137,403) took a median of 127 ms in Node over nine warm runs.
  - The old engine replayed its own hour in a median of 86 ms. The difference comes from the extra obstacles late in the run.
  - The new engine was not timed inside a Convex mutation; the old one took about 50 ms there.
- **Real runtime to the real `submitRun`.** The integrity review's harness drives the browser runtime on a virtual clock with jittered 60–144 Hz frames and pauses. It sends each payload to `submitRun` in convex-test at the earliest moment the pace check allows.
  - **Before the client fixes, 1,500 fuzzed runs:** all 981 ranked runs were accepted, none differed from the local replay, and all 98 sign-in restores worked. Four one-hour runs reached the finish line and were accepted, but the runtime still refused to restore a finished run after sign-in.
  - **After the client fixes, 300 more runs:** all 207 ranked runs were accepted, none differed, and all 22 restores worked. Three one-hour runs (at 60, 90 and 120 Hz) went through the real runtime to the finish line. Each replayed as finished, was restored after the simulated sign-in round trip, and was saved with 137,403 at rank 1.
  - The harness predates the client's one-second ticket wait, so the runtime tests cover that wait instead.
- **Server.** `convex/bogorRun.test.ts` checks the following:
  - Finish line: a finished hour is accepted only after the full hour's pace and only if its replay finishes, and a second finisher ties at rank 1 behind the first.
  - Hidden list: a hidden player below 100 visible ones stays listed for staff and can be restored.
  - Hierarchy: the full owner/admin/member matrix, with `canHide` and `canRestore` agreeing with `setHidden`. An owner's hide survives an admin's attempts to undo it or to hide the player again. The audit fields are kept.
  - Deactivation: deactivating a member hides them, and reactivating brings them back unless staff hid them too. A restore that cannot work returns `INACTIVE`.
  - Pruning: runs older than 30 days are deleted while newer runs, bests, and counters are kept. The pruned run's token stays `EXPIRED`, and a backlog of 1,205 rows is cleared in batches.
- **DEV deployment:** the final Convex code, including the `by_submitted` index, the new `gamePlayers` fields, and the daily cron, was pushed to the DEV deployment. There, `issueRun` returned a signed token, `pruneRuns` ran, a guest's `submitRun` returned `UNAUTHENTICATED`, and `board` refused a guest. Production Convex was not touched.
- **Screens.** Headless Chromium captured the game with Convex and auth mocked at ten sizes: 1440×900, 1280×577, 1024×768, 768×1024, 390×844, 320×568, 844×390, 740×360, 667×375 and 568×320.
  - The captures cover running, ducking, a crash while ducking, an Elang, a finished hour, pause, game over as a guest and after saving, and both return notices.
  - During play the Dino, the ground line and the game buttons were on screen at every landscape size, and at 932×430 in a separate probe.
  - The board showed all 10 rows at 390×844, 375×667 and 360×740, and 4–9 rows at 320×568 depending on the state, with the scroll shadow as a cue.
  - The reviewers' own probes were rerun and now pass: focus and keys, the ground tap area, the notice card, focus rings, forced colours, and Back from Google.
- **Dashboard page.** The real `/dashboard/papan-skor` route was loaded with mocked member, admin and owner boards at 1440, 390 and 320 px. It had no horizontal overflow, and axe found no violations. Hiding and restoring moved focus to the next row that still has a button and announced the result.
- **Sprites.** A sharp (librsvg) render of the new `dino.svg` matches the Draft A sheet chosen before the review, pixel for pixel, in its first 294 columns. The new duck crash frame differs from duck 1 in 20 pixels, all inside the eye box.
- **Privacy page.** `/privasi` from the dev server contains the new wording on retention, one-word names, moderation, and deactivation.

### Additional manual checks

Not yet done with real accounts against the DEV deployment:

- [ ] Owner and admin: an admin sees "Khusus pemilik" instead of a button on owner and admin rows. An owner's hide cannot be undone by the admin, and the "Disembunyikan" list names who hid each player.
- [ ] Deactivate a member with a score on `/dashboard/anggota`: they disappear from the landing board and show "Nonaktif" in the hidden list, and reactivating brings them back.
- [ ] Landscape phone and a low laptop window: the compact layout fits, the Dino and buttons stay on screen with the browser toolbar shown and hidden, and the two-column board scrolls.
- [ ] Sunday night into Monday: a run started before 00:00 WIB and saved after it says "minggu lalu", and the next run starts on a new ticket.
- [ ] Convex dashboard for DEV: the daily "remove Bogor Run run records after 30 days" cron is listed and its runs succeed.

## /rai easter egg — 29 September

`/rai` is unlinked and marked noindex. It opens on a star; pressing it plays a reveal: the star rises and pixels assemble into a blue glass dino inside a Tier Gemini Rising Star badge redrawn in SVG, over a synthesized fanfare. The badge tilts with the pointer, flips to a back face, and its dino jumps on tap or Space. The page can equip a cosmetic Google Blue dino for Bogor Run. The landing page logs a one-time console hint.

- `pnpm exec vitest run src/components/rai src/lib/bogor-run/skin.test.ts src/lib/bogor-run/sprites.test.ts src/lib/bogor-run/sound.test.ts src/components/bogor-run.test.tsx src/components/bogor-run-runtime.test.tsx` passes. The tests cover:
  - the sealed gate and the reduced-motion reveal, with focus moved to the title and the fanfare played;
  - the animated reveal's stage timing;
  - equipping and removing the skin (`localStorage`, `aria-pressed`, the live announcement);
  - jumps from the dino button and Space, and none from a focused control or a held key;
  - the flip, which hides the turned-away face from assistive technology;
  - axe with no violations (colour contrast is not included);
  - the blue sheet matching the classic sheet pixel for pixel, recoloured;
  - the runtime loading the skin's sheet;
  - the footer poster and runner receiving the stored skin.
- Headless Chromium against the dev server at 1440×900 and 390×844 covered the sealed gate, the reveal mid-flight, the open badge, pointer tilt and the back face, with no page or console errors. The footer game then drew the blue dino after the skin was equipped, and the console hint printed exactly once.
- Not verified: iOS Safari's audio unlock for the fanfare, and touch tilt on a real phone.

## No pause in Bogor Run — 30 September

Players can no longer pause a run: the pause button, the P and Esc keys, and the leaderboard toggle during a run are gone, and the toggle now appears only after a run. Interruptions (hidden tab, window blur, focus leaving the game, the game scrolled away, a width change) freeze the run, standing a held duck up first so the replay log stays exact. Once the game has the player's attention again, a 3-2-1 countdown lets the run carry on by itself; a new interruption halts the count, and a jump press neither resumes nor skips it. The idle demo keeps its pause button (WCAG 2.2.2).

- `pnpm exec vitest run src/components/bogor-run.test.tsx src/components/bogor-run-runtime.test.tsx` passes (37 tests). The tests cover:
  - the countdown after the game comes back on screen, after a width change, after window blur and focus, and after the tab is hidden and shown;
  - a halted count, no manual resume, and cancelling on leave;
  - the duck release logged at an interruption;
  - no pause key or button during a run;
  - the board toggle only after a run;
  - the frozen and countdown copy and announcements.
- Headless Chromium against the dev server at 1440×900 and 390×844: during a run the controls are only the back link, the tap area, "Lompat" and mute. A window blur shows "Tertahan sebentar.", and focus coming back shows the centred countdown, which then carries on. P and Esc do nothing, and there were no page errors.

## Evidence boundaries

The scene is an original geometric illustration guided by the selected generated image and the supplied building photographs. It is not a measured digital twin or a pixel-identical rendering of the generated artwork.

Responsive testing used browser viewport emulation, not physical phones; Bogor Run's short and landscape layouts, which depend on `100svh` and the mobile toolbar, were never tried on a real device. Bogor Run's sounds were measured but not yet listened to, and its sign-in, submission, and moderation flows have been exercised only against convex-test and mocked browser responses; the checklists above cover the real round trips. Its late-game tuning comes from simulated players, not people, and no one has played a real hour to the finish line; that path is covered by the engine tests and the runtime harness. Restoring the page from the back/forward cache after Google cannot be triggered headless, so it is covered only by a component test. Browser reduced motion and the forced fallback were tested; actual GPU context-loss recovery is implemented but was not fault-injected. The public deployment and private GitHub remote are verified above. Membership registration still links to the official GDG chapter. The Apresiasi backend and OAuth checks are documented separately above; no Instagram publication was performed.
