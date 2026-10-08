# GDGoC IPB — Hello, Campus!

GDGoC IPB — Komunitas Mahasiswa Bogor. Community profile with a geometric Three.js campus environment, Next.js App Router, and Lenis.

## Run locally

```sh
pnpm install
pnpm exec convex dev # configure the development backend first
pnpm dev
```

Open [the landing](http://127.0.0.1:3104) or [the full scene](http://127.0.0.1:3104/environment). `/environment` stays in production (`noindex`) because the still-capture scripts in `design/` use it.

The four visual directions and the four CTA + footer concepts (Taman kampus, Meja kolaborasi, Gerbang komunitas, Mosaik karya) are generated design records, not pages: their PNGs and WebPs are in `design/environments/` and `design/footer-directions/`, with prompts in `design/prompts.json` and `design/footer-directions/prompts.json`. The `/directions` and `/footer-directions` galleries were removed (#29) and redirect to the landing.

```sh
pnpm test # backend permissions, onboarding, dashboard, accessibility, autosave, forms, and the Bogor Run engine and score replay
pnpm check # ESLint + Next route types + TypeScript
pnpm build
pnpm start
```

Node 24 and pnpm 11.22.0 are used; `.node-version` pins the major for fnm, nvm, mise and similar tools, matching Vercel. GitHub Actions runs `pnpm check` and `pnpm test` on every pull request and on pushes to `main` (`.github/workflows/ci.yml`); it needs no Convex or Vercel secrets because the suite runs against `convex-test`. The landing renders without a backend; only the Bogor Run leaderboard, loaded once the game scrolls into view, talks to Convex. The Apresiasi workspace uses Convex and Google OAuth; configure the variables in `.env.example` and follow `docs/APRESIASI.md`. The leaderboard adds no environment variables: its run tokens are signed with a key derived from `BETTER_AUTH_SECRET`, and without that secret the game plays unranked.

## Apresiasi

`/dashboard/apresiasi` provides private autosaved drafts, a review-before-submit form, documentation links (no uploads), and submission status. `/dashboard/apresiasi/tinjau` is the review queue for owners (the `APPRECIATION_ADMIN_EMAILS` allowlist), for dashboard admins, and for members an owner has made reviewers from the members page; it is locked until `APPRECIATION_ADMIN_EMAILS` is explicitly configured. The old `/apresiasi` and `/apresiasi/admin` URLs redirect there. Publication is a manual Media & Creative workflow, with the Instagram post URL recorded after publishing.

The first authenticated visit opens a five-screen `/onboarding`: name, campus and study program, Member or Core Team (with a division), optional WhatsApp invitation, and optional GDG Community invitation. Progress is saved per account after each forward action, and completed users do not repeat the flow. Searchable education comboboxes accept unlisted values and support keyboard navigation, mobile input hints, and accessible labels/errors. The resulting profile prefills new appreciation drafts. See `docs/ONBOARDING.md` for persistence, accessibility, and suggestion-source details.

## Tech League

`/tech-league` is the public page for Tech League 2026/27: the three categories, the schedule (registration 2 November 2026 – 8 February 2027, submissions due 15 February, judging 19 February – 16 March, finals 25–27 March 2027), and a short FAQ. Registration, payment and submissions run on Program & Development's forms, not on this site (#33). The page shows the registration state for the current date (WIB) and is revalidated hourly. The form and guidebook links are `registrationUrl` and `guidebookUrl` in `src/lib/tech-league.ts`; until they are set, the page says the links will be published there and on Instagram. The landing's Tech League card opens this page.

## Dashboard

`/dashboard` is the signed-in workspace, with a sidebar (a drawer on phones) using Pixelarticons. Members work on assignments, write a rich-text answer (Tiptap, with a pixel-icon toolbar), drag and drop up to five files (10 MB each) with upload progress, and resubmit until an assignment is closed; work after the deadline is accepted and marked late. Apresiasi and the profile page (community role and division) live here too. Owners, the verified emails in `APPRECIATION_ADMIN_EMAILS`, promote members to admin and review Apresiasi. Owners and admins review Apresiasi, create assignments with editable slugs (`/dashboard/tugas/<slug>`, old slugs keep redirecting), review every submission, and manage members. `/dashboard/papan-skor` shows the Bogor Run top 100 for the week and all time. Staff can hide a player from every board and restore them from a separate hidden list. Hiding follows the member-management hierarchy: admins act only on members, and only an owner can undo an owner's hide. Deactivated members are hidden automatically until they are reactivated, and per-run records are deleted after 30 days. See `docs/DASHBOARD.md`.

## Selected direction

**Hello, Campus!** was selected after reviewing four generated directions. The original AHN illustration was corrected using the user's front and aerial photographs, then rendered in a cel-shaded style. All five original PNGs and optimized WebPs are in `design/environments/`. The current reference is `01-hello-campus-ahn-cel-v2.png`. `public/environments/01-hello-campus-3d.webp` is not concept art: it is a still of the finished Three.js scene, shown when the scene cannot render.

The landing uses actual 3D geometry, without projecting the concept image onto it. The model includes AHN's stepped massing, long white canopies, window bands, large red pyramidal roof, dormers, faceted entrance core, narrow vertical window and stylized circular emblems. It also contains voxel trees, palms, planters and flowers, a pond, paving, lights, Google-color seats, clouds, and an extruded Chrome Dino. It is an illustrated reconstruction from photographs, not a surveyed architectural model.

The landing preloader releases after the renderer completes its first frame, including the foreground blur pass. It never displays a simulated loading percentage. A failed WebGL initialization releases to a still of the same scene (`node design/campus-fallback.mjs` captures it from `/environment?motion=off` in headless Chrome; rerun it after changing the scene); a 12-second watchdog also releases a stalled import/GPU to the static layout. The initial frame is eager even when an anchor puts the hero offscreen. Desktop mouse movement across the hero, including its CTA, gives a gently damped camera parallax inspired by Deliverologi. The camera eases home on pointer exit, leaves the HTML copy fixed, and stays centered on mobile, touch devices, and reduced motion. Softly blurred 3D plants frame the lower corners while the campus stays sharp. Five voxel birds glide above AHN with staggered wingbeats and gentle banking. Their bodies and wings use three instanced draw calls. The hero Dino and smaller community Dino blink naturally, with occasional double blinks. Both the hero and the smaller community scene release GPU resources on unmount and pause when hidden or offscreen. Motion follows the operating system's reduced-motion setting.

The garden uses distinct round, columnar, and umbrella canopies, yellow/coral flowering trees, palms, broad tropical leaves, and a small Google-color direction post on the left. Fresher greens, turquoise water, and a more neutral warm key light keep the cel-shaded scene vibrant without changing the hero composition.

## Footer mini game

The membership CTA and footer share one full-width pixel landscape: misty Salak, Tugu Kujang, tropical trees, a road, and a light garden floor. A chunky cream Dino with navy outlines replaces the old CTA illustration; the directory stays below the same landscape instead of containing a separate game card.

Dino **plays autonomously** while the arena is visible. A separate, silent background run jumps over angkot, taro baskets, and rain puddles, and dodges Javan hawk-eagles, without recording a player score. Choose **Ikut main** to take over the full-width arena; **Kembali ke komunitas** restores the membership copy and returns keyboard focus to its CTA. Use Space or Up to jump and hold Down to duck (Down in mid-air drops fast); on touch screens, tap the upper half of the arena to jump and hold the lower half to duck. P / Escape or the pause button pauses and resumes. A local control can also pause the autonomous scene. While playing, the arena fits the screen under the header; landscape phones and low windows get a compact layout instead of a rotate prompt.

Speed rises for the whole run but stays below a bound, and obstacle spacing is timed to the speed. After five minutes the course keeps tightening, with shorter margins and clusters of two or three obstacles to clear in one jump, so most runs end well before the hour; a run that lasts the full hour ends at a finish line ("Selesai! 1 jam penuh") and is saved like any other. A search solver in the tests clears the generated patterns for 150 seeds at the start, near top speed, and just before the finish line. From 300 points the Elang Jawa flies in at three heights: jump the low one, duck the middle one, and stay on the ground under the high one. Web Audio synthesizes the jump, crash, and a chime every 500 points, when the score blinks; there are no audio files, the mute button is remembered, and the demo is always silent.

The Canvas 2D runtime loads on intersection. Offscreen/hidden-tab states stop animation, personal games pause when focus leaves or the viewport changes width, and personal games resume only through a player action. Reduced motion disables autoplay and decorative movement, while explicit play remains available. The personal best stays in browser storage. Guests can play without signing in; a signed-in player's crashed or finished run is sent to Convex, which replays its recorded inputs on a server-signed seed before saving the score. A guest can choose **Masuk untuk simpan skor** at game over; after Google sign-in returns to the landing, that run is submitted automatically if it ended less than 30 minutes earlier. The pause and game-over panel shows the weekly (reset Monday 00:00 WIB) and all-time top 10. The original Bogor SVG scenery, obstacles, and the cream/navy Dino and Elang sprite sheets live in `public/games/bogor-run/`; their README covers the Codex provenance, controls, and scoring.

## Structure

- `src/lib/campus/builder.ts`: batched toon geometry, exterior-only voxel unions, and antialiased ink contours.
- `src/lib/campus/model.ts`: complete campus model; deterministic geometry and foliage.
- `src/lib/campus/hills.ts`: a stepped Gunung Salak silhouette on the left and two low foothill layers with valley fog.
- `src/lib/campus/foreground.ts`: near garden geometry and an isolated, half-resolution blur pass.
- `src/lib/campus/runtime.ts`: renderer, directional shadow pass, responsive camera, motion, visibility and cleanup.
- `src/components/landing.tsx`: the landing page.
- `src/components/campus-environment.tsx`: progressive enhancement and accessible image fallback. The scene's code starts downloading while the page hydrates, because the preloader waits for it.
- `src/components/scene-preloader.tsx`: first-frame loading gate with native modal focus handling and reduced-motion support.
- `src/components/experience-provider.tsx`: system reduced motion and desktop Lenis scrolling.
- `src/components/join-footer.tsx`: one continuous light section for the membership invitation, shared Bogor landscape, community identity, navigation, and contact.
- `src/components/bogor-run.tsx`: full-width scene composition, autonomous/manual controls, tap zones, the leaderboard panel, focus restoration, and accessible status announcements.
- `src/lib/bogor-run/`: the fixed-tick engine shared with the server replay, the autopilot, responsive projection, Canvas drawing, synthesized sound, sprite frames, leaderboard helpers, and the lazily loaded Convex/auth client (`online.ts`).
- `src/app/rai/` and `src/components/rai/`: an unlinked, noindex easter egg with the Tier Gemini Rising Star badge redrawn as SVG. It unlocks the blue dino skin for Bogor Run (`src/lib/bogor-run/skin.ts`); the landing page's browser console hints at it.
- `convex/bogorRun.ts`: signed run tokens, replay-verified score submission, the public and dashboard leaderboards, moderation, and the 30-day pruning of run records.
- `src/lib/community.ts`: verified official membership and Instagram destinations.
- `src/lib/tech-league.ts` and `src/app/tech-league/page.tsx`: Tech League categories, schedule, registration state, and the public page.
- `src/lib/site.ts`: the canonical origin, shared Open Graph fields, and the per-page canonical helper.
- `docs/DESIGN.md`: Figma evidence, direction choices and implementation rationale.
- `docs/VERIFICATION.md`: checks and evidence boundaries.
- `docs/DASHBOARD.md`: dashboard roles, assignments, submissions, and member management.

`?motion=off` is a deterministic still mode. `?webgl=off` exercises the image fallback. The landing reads no query string on the server, so it is prerendered.

## Typography and content

Fonts were checked directly in the supplied Figma design-system page. Pixelify Sans is used for pixel display type, Space Grotesk for supporting headings, Poppins for body, and JetBrains Mono for small labels. All fonts are self-hosted through Fontsource packages; their licenses ship with those packages. The GDGoC IPB lockup is a transparent SVG (`public/brand/gdgoc-ipb.svg`, rendered by `src/components/brand-logo.tsx`) exported from the GDGOC 26/27 Figma file (node `297:9358`); its white box and trace fringes were removed, and the untouched export is kept in `design/references/gdgoc-ipb-logo-figma.svg`.

Copy introduces a community for students across Bogor, its learning areas, and the 2026/2027 programs. Catalyst explicitly describes Hustler, Hipster, and Hacker, following the user's correction. The main “Gabung member” CTAs open the official GDG chapter page, where “Join us” is available; program updates and contact links use `gdgoc.ipb` on Instagram. The sticky header and desktop hero keep the existing composition while the text aligns left. The header links Tentang kami, Program, and Bogor Run. On the landing it follows the reader: the section in view is underlined in the colour of the scroll-progress quarter being filled. Elsewhere its links lead back to those sections. Its CTA adapts to the session, which it reads from the same-origin `/api/auth/get-session` after hydration, so no auth client ships with the landing. It reads Dashboard before the check, Masuk for guests (via the dashboard's Google sign-in), and a pixel initial with "Hai, <first name>" and Dashboard for members, who also get a one-tap avatar next to the menu on phones. Apresiasi lives inside the dashboard, and "Gabung member" stays in the hero and footer. No event dates, program-registration availability, or unverified metrics are invented.

## Search and sharing

Only the landing and `/privasi` are indexable. Both set a canonical URL, so `?motion=` and `?webgl=` previews count as the landing. The dashboard, onboarding, `/rai`, `/environment`, the two design galleries, and the world previews are `noindex`. `/robots.txt` blocks only `/api/`, so crawlers can still read those `noindex` tags, and `/sitemap.xml` lists the two indexable pages. All absolute URLs come from `NEXT_PUBLIC_SITE_URL`, falling back to `https://www.gdgocipb.com`.

Every page shares one Open Graph and Twitter card image, `public/brand/og-image.jpg` (1200 × 630). Its background is a still of the landing's Three.js campus, not the concept illustration: `node design/og-image.mjs` opens `/environment?motion=off` on a running local site in headless Chrome (through `design/campus-still.mjs`), captures the rendered scene, and adds the lockup and the hero headline. Rerun it after changing the scene, the lockup, or the headline. The landing also carries `Organization` and `WebSite` JSON-LD with the chapter's names, logo, and official GDG and Instagram pages. The landing's title leads with "GDGoC IPB University" and keeps the Komunitas Mahasiswa Bogor positioning; its description opens with the full "Google Developer Group on Campus IPB University". The JSON-LD also lists "GDG on Campus IPB University", the name on the official chapter page, and the earlier "GDSC IPB" recorded there. A page that sets its own `openGraph` must build it with `canonical()` from `src/lib/site.ts`, because Next.js replaces nested metadata instead of merging it.

## Deployment

Live site: [www.gdgocipb.com](https://www.gdgocipb.com/). `gdgocipb.com` and `gdgoc-ipb-web.vercel.app` permanently redirect (308) to it, preserving the path, so sign-in always runs on the one origin Better Auth trusts.

The source repository is `gdgoc-ipb-university/gdgoc-web`. The `gdgoc-ipb-web` Vercel project in `aldio-lisafrons-projects` is connected to it through Vercel's Git integration: every push to `main` deploys production. Vercel runs this build command:

```sh
pnpm exec convex deploy --cmd 'pnpm build'
```

It deploys the Convex backend first, then runs `next build` with `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` set to the production deployment, so the backend always ships before the frontend that depends on it. Vercel stores `CONVEX_DEPLOY_KEY` (a production deploy key, Production environment only, secret) and `NEXT_PUBLIC_SITE_URL=https://www.gdgocipb.com`. Auth secrets live only in Convex.

Only production builds run. The project's Ignored Build Step skips other branches, because the deploy key is production-only and Google OAuth is not registered for preview URLs.

Node.js is pinned to 24.x, matching local validation and a [supported Vercel runtime](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). `.vercel/` is ignored by Git, and `.vercelignore` excludes design sources and internal documentation from CLI uploads. To link a new checkout for CLI commands (environment variables, logs, inspection):

```sh
pnpm dlx --allow-build=esbuild vercel@59.23.2 link --yes --scope aldio-lisafrons-projects --project gdgoc-ipb-web
```

See `docs/APRESIASI.md` for the backend environments and release checks.
