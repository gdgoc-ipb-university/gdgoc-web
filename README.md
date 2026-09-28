# GDGoC IPB — Hello, Campus!

GDGoC IPB — Komunitas Mahasiswa Bogor. Community profile with a geometric Three.js campus environment, Next.js App Router, Lenis, and Motion for React.

## Run locally

```sh
pnpm install
pnpm exec convex dev # configure the development backend first
pnpm dev
```

Open [the landing](http://127.0.0.1:3104), [the full scene](http://127.0.0.1:3104/environment), or [four visual directions](http://127.0.0.1:3104/directions).

The [CTA + footer concept gallery](http://127.0.0.1:3104/footer-directions) contains four new light concepts: Taman kampus, Meja kolaborasi, Gerbang komunitas, and Mosaik karya. Original PNGs and WebPs are in `public/footer-directions/`; the complete prompts and reference are recorded in `design/footer-directions/prompts.json`. These are generated design options, not four implemented footer components.

```sh
pnpm test # backend permissions, onboarding, dashboard, accessibility, autosave and forms
pnpm check # ESLint + Next route types + TypeScript
pnpm build
pnpm start
```

Node 24 and pnpm 11.22.0 are used. The landing has no backend dependency. The Apresiasi workspace uses Convex and Google OAuth; configure the variables in `.env.example` and follow `docs/APRESIASI.md`.

## Apresiasi

`/dashboard/apresiasi` provides private autosaved drafts, a review-before-submit form, documentation links (no uploads), and submission status. `/dashboard/apresiasi/tinjau` is a verified-email allowlist review queue; it is locked until `APPRECIATION_ADMIN_EMAILS` is explicitly configured. The old `/apresiasi` and `/apresiasi/admin` URLs redirect there. Publication is a manual Media & Creative workflow, with the Instagram post URL recorded after publishing.

The first authenticated visit opens a five-screen `/onboarding`: name, campus and study program, Member or Core Team (with a division), optional WhatsApp invitation, and optional GDG Community invitation. Progress is saved per account after each forward action, and completed users do not repeat the flow. Searchable education comboboxes accept unlisted values and support keyboard navigation, mobile input hints, and accessible labels/errors. The resulting profile prefills new appreciation drafts. See `docs/ONBOARDING.md` for persistence, accessibility, and suggestion-source details.

## Dashboard

`/dashboard` is the signed-in workspace, with a sidebar (a drawer on phones) using Pixelarticons. Members work on assignments, write an answer, attach up to five files (10 MB each), and resubmit until an assignment is closed; work after the deadline is accepted and marked late. Apresiasi and the profile page (community role and division) live here too. Owners, the verified emails in `APPRECIATION_ADMIN_EMAILS`, promote members to admin and review Apresiasi. Owners and admins create assignments with editable slugs (`/dashboard/tugas/<slug>`, old slugs keep redirecting), review every submission, and manage members. See `docs/DASHBOARD.md`.

## Selected direction

**Hello, Campus!** was selected after reviewing four generated directions. The original AHN illustration was corrected using the user's front and aerial photographs, then rendered in a cel-shaded style. All five original PNGs and optimized WebPs are in `public/environments/`. The current reference is `01-hello-campus-ahn-cel-v2.png`.

The landing uses actual 3D geometry, without projecting the concept image onto it. The model includes AHN's stepped massing, long white canopies, window bands, large red pyramidal roof, dormers, faceted entrance core, narrow vertical window and stylized circular emblems. It also contains voxel trees, palms, planters and flowers, a pond, paving, lights, Google-color seats, clouds, and an extruded Chrome Dino. It is an illustrated reconstruction from photographs, not a surveyed architectural model.

The landing preloader releases after the renderer completes its first frame, including the foreground blur pass. It never displays a simulated loading percentage. A failed WebGL initialization releases to the loaded reference image; a 12-second watchdog also releases a stalled import/GPU to the static layout. The initial frame is eager even when an anchor puts the hero offscreen. Desktop mouse movement across the hero, including its CTA, gives a gently damped camera parallax inspired by Deliverologi. The camera eases home on pointer exit, leaves the HTML copy fixed, and stays centered on mobile, touch devices, and reduced motion. Softly blurred 3D plants frame the lower corners while the campus stays sharp. Five voxel birds glide above AHN with staggered wingbeats and gentle banking. Their bodies and wings use three instanced draw calls. The hero Dino and smaller community Dino blink naturally, with occasional double blinks. Both the hero and the smaller community scene release GPU resources on unmount and pause when hidden or offscreen. Motion follows the operating system's reduced-motion setting.

The garden uses distinct round, columnar, and umbrella canopies, yellow/coral flowering trees, palms, broad tropical leaves, and a small Google-color direction post on the left. Fresher greens, turquoise water, and a more neutral warm key light keep the cel-shaded scene vibrant without changing the hero composition.

## Footer mini game

The membership CTA and footer share one full-width pixel landscape: misty Salak, Tugu Kujang, tropical trees, a road, and a light garden floor. A chunky cream Dino with navy outlines replaces the old CTA illustration; the directory stays below the same landscape instead of containing a separate game card.

Dino **plays autonomously** while the arena is visible. A separate background run jumps over angkot, taro baskets, and rain puddles without recording a player score. Choose **Ikut main** to take over the full-width arena; **Kembali ke komunitas** restores the membership copy and returns keyboard focus to its CTA. Use Space, Up, or tap to jump, and P / Escape or the pause button to pause/resume. A local control can also pause the autonomous scene.

The Canvas 2D runtime loads on intersection. Offscreen/hidden-tab states stop animation, personal games pause when focus leaves or the viewport changes width, and personal games resume only through a player action. Reduced motion disables autoplay and decorative movement, while explicit play remains available. High scores stay in browser storage; no login or backend is needed. The original Bogor SVG scenery, obstacles, and cream/navy Dino sprite sheet live in `public/games/bogor-run/`.

## Structure

- `src/lib/campus/builder.ts`: batched toon geometry, exterior-only voxel unions, and antialiased ink contours.
- `src/lib/campus/model.ts`: complete campus model; deterministic geometry and foliage.
- `src/lib/campus/hills.ts`: a stepped Gunung Salak silhouette on the left and two low foothill layers with valley fog.
- `src/lib/campus/foreground.ts`: near garden geometry and an isolated, half-resolution blur pass.
- `src/lib/campus/runtime.ts`: renderer, directional shadow pass, responsive camera, motion, visibility and cleanup.
- `src/components/campus-environment.tsx`: progressive enhancement and accessible image fallback.
- `src/components/scene-preloader.tsx`: first-frame loading gate with native modal focus handling and reduced-motion support.
- `src/components/experience-provider.tsx`: system reduced motion and desktop Lenis scrolling.
- `src/components/join-footer.tsx`: one continuous light section for the membership invitation, shared Bogor landscape, community identity, navigation, and contact.
- `src/components/bogor-run.tsx`: full-width scene composition, autonomous/manual controls, focus restoration, and accessible status announcements.
- `src/lib/bogor-run/`: deterministic-step gameplay, autonomous jumping, responsive projection, Canvas drawing, and browser-local best score.
- `src/lib/community.ts`: verified official membership and Instagram destinations.
- `src/lib/directions.ts`: visual directions and art asset paths.
- `docs/DESIGN.md`: Figma evidence, direction choices and implementation rationale.
- `docs/VERIFICATION.md`: checks and evidence boundaries.
- `docs/DASHBOARD.md`: dashboard roles, assignments, submissions, and member management.

`?motion=off` is a deterministic still mode. `?webgl=off` exercises the image fallback. `?world=cloud-club`, `?world=dino-playground`, and `?world=after-hours` preview alternate artwork in the landing layout.

## Typography and content

Fonts were checked directly in the supplied Figma design-system page. Pixelify Sans is used for pixel display type, Space Grotesk for supporting headings, Poppins for body, and JetBrains Mono for small labels. All fonts are self-hosted through Fontsource packages; their licenses ship with those packages. The GDGoC IPB lockup was exported from the user's Figma file.

Copy introduces a community for students across Bogor, its learning areas, and the 2026/2027 programs. Catalyst explicitly describes Hustler, Hipster, and Hacker, following the user's correction. The main “Gabung member” CTAs open the official GDG chapter page, where “Join us” is available; program updates and contact links use `gdgoc.ipb` on Instagram. The sticky header and desktop hero keep the existing composition while the text aligns left. No event dates, program-registration availability, or unverified metrics are invented.

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
