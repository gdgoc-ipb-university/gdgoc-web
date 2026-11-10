# GDGoC IPB — Hello, Campus!

GDGoC IPB — Komunitas Mahasiswa Bogor. Community profile with a geometric Three.js campus environment, Next.js App Router, and Lenis.

## Tech stack

Versions are the ones in `package.json`.

| Part | Tool | Version |
| --- | --- | --- |
| Framework | Next.js App Router | 16.3.5 |
| UI | React | 19.2.8 |
| Backend and database | Convex | ^1.46.0 |
| Sign-in | Better Auth with Google, through `@convex-dev/better-auth` | ~1.6.33, ^0.12.5 |
| 3D campus | Three.js | 0.186.0 |
| Smooth scrolling | Lenis | 1.3.26 |
| Rich text | Tiptap | 3.31.3 |
| Accessible components | react-aria-components | 1.21.1 |
| Tests | Vitest, with `convex-test` and Testing Library | ^4.1.11 |
| Lint | ESLint with `eslint-config-next` | 9.39.5 |
| Language and runtime | TypeScript on Node.js | ^5, 24.x |
| Package manager | pnpm | 11.22.0 |
| Hosting | Vercel, deploying the `release` branch | |

`docs/ARCHITECTURE.md` shows how these connect.

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

Before you change anything, read `docs/CONTRIBUTING.md`: how work starts on an issue, commits, pull requests, and what never gets committed.

## Environment variables

`.env.example` lists them. The first group goes in `.env.local`; the second is set on each Convex deployment with `pnpm exec convex env set`, never in a `NEXT_PUBLIC_*` variable.

| Name | Where it is set | Purpose | Required |
| --- | --- | --- | --- |
| `CONVEX_DEPLOYMENT` | `.env.local`, written by `pnpm exec convex dev` | The development deployment the Convex CLI pushes to | Locally |
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local`, written by `pnpm exec convex dev`; on Vercel, by `convex deploy` during the build | Convex client URL for queries and mutations | Yes |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | As above | Convex HTTP URL that the Better Auth handler forwards to | Yes |
| `NEXT_PUBLIC_SITE_URL` | `.env.local`; Vercel | Origin for canonical URLs, the sitemap and Open Graph | Optional, falls back to `https://www.gdgocipb.com` |
| `NEXT_PUBLIC_LEAGUE_URL` | `.env.local`; Vercel | Tech League's own origin. Its host is served from `src/app/league` and `/program/tech-league` redirects there; unset, the league is previewed at `/league` | Optional |
| `DEV_ALLOWED_ORIGINS` | `.env.local` | Comma-separated hostnames (for example a Cloudflare tunnel) allowed to reach `next dev` | Optional |
| `BETTER_AUTH_SECRET` | Convex deployment | Signs sessions and Bogor Run tokens; unique per deployment | Yes for sign-in; without it the game plays unranked |
| `SITE_URL` | Convex deployment | The origin Better Auth runs on; Google returns there | Yes for sign-in |
| `LEAGUE_URL` | Convex deployment | Tech League's origin, trusted as an origin and as a sign-in `callbackURL` | With `NEXT_PUBLIC_LEAGUE_URL` |
| `AUTH_COOKIE_DOMAIN` | Convex deployment | Parent domain of both hosts (`gdgocipb.com`); auth cookies go there so one session covers both | With `NEXT_PUBLIC_LEAGUE_URL` |
| `GOOGLE_CLIENT_ID` | Convex deployment | Google OAuth web client | Yes for sign-in; until set, the sign-in button is disabled |
| `GOOGLE_CLIENT_SECRET` | Convex deployment | Its secret | Yes for sign-in |
| `APPRECIATION_ADMIN_EMAILS` | Convex deployment | Comma-separated verified emails of the owners | Optional; the Apresiasi review queue stays locked until set |

Production also needs `CONVEX_DEPLOY_KEY` on Vercel (see Deployment).

## Apresiasi

`/dashboard/apresiasi` provides private autosaved drafts, a review-before-submit form, documentation links (no uploads), and submission status. `/dashboard/apresiasi/tinjau` is the review queue for owners (the `APPRECIATION_ADMIN_EMAILS` allowlist), for dashboard admins, and for members an owner has made reviewers from the members page; it is locked until `APPRECIATION_ADMIN_EMAILS` is explicitly configured. The old `/apresiasi` and `/apresiasi/admin` URLs redirect there. Publication is a manual Media & Creative workflow, with the Instagram post URL recorded after publishing.

The first authenticated visit opens a four-screen `/onboarding`: name, campus and study program, optional WhatsApp invitation, and optional GDG Community invitation. Everyone registers as Member; owners and admins assign Core Team (with a division) and BoD from the members page. Progress is saved per account after each forward action, and completed users do not repeat the flow. Searchable education comboboxes accept unlisted values and support keyboard navigation, mobile input hints, and accessible labels/errors. The resulting profile prefills new appreciation drafts. See `docs/ONBOARDING.md` for persistence, accessibility, and suggestion-source details.

## Tech League

`/tentang` answers what GDGoC IPB is: the 2026/27 vision, the three missions (Structured Learning, Applied Growth, Connected Ecosystem), who it is for, and its history as GDSC IPB. The copy is in `src/lib/about.ts`. It carries `AboutPage` JSON-LD pointing at the landing's `Organization` and `WebSite` (the `Organization` stays on the landing) and a Beranda › Tentang breadcrumb. The header's "Tentang kami" and the footer's "Tentang komunitas" open it.

`/tim` shows who runs the chapter in 2026/27 (#94): the Lead and Co-Lead by name and role, and the five divisions (Program & Development, Community & External, Media & Creative, Technical, Secretary-Treasurer) by purpose, without staff names (#86, decision 1). The content is in `src/lib/team.ts`. Photos and profile links are null until the Lead and Co-Lead approve them, so each card shows a pixel initial. It carries `Person` JSON-LD for both, working for the landing's `Organization`, and a Beranda › Tim breadcrumb. A line under the history on `/tentang` and the footer's "Tim 2026/27" link to it; the header does not.

`/bergabung` tells visitors how to take part: become a member by signing in with Google on this site and join the community WhatsApp group, join GDGoC Catalyst, or compete in Tech League, with who can join and a FAQ (`FAQPage` JSON-LD and a Beranda › Bergabung breadcrumb). The Catalyst and Tech League lines read the same WIB windows as their own pages, so the page is revalidated hourly. It gives no member-intake batch dates while intake versus the Catalyst pivot is open (#86, decision 2). The join footer's note under "Gabung member", the footer's "Cara bergabung", and `/tentang` link to it.

The member intake guidebook (2026/27) is a static PDF, `public/guidebook/member-2026-27.pdf`: five A4 pages exported from Figma (Documents › GUIDEBOOK OPREC MEMBER) as 200 dpi JPEG, about 3.4 MB. `/gb-member` redirects there (307, #201). The intake posts print that link as a QR, so a new edition replaces the file and updates the redirect, never the link.

`/twibbon` is the member intake twibbon maker (#203). It runs in the browser and uploads nothing: an applicant chooses or drops a photo, drags it (or uses the arrow keys) and zooms it under the 2026/27 frame, and downloads a 1080 × 1440 JPEG. It also offers the carousel's second slide and builds a caption from their name, school or campus and three friends to tag, with the required #OprecMemberGDGOCIPB2627 (#205). The frame (`public/twibbon/member-2026-27.png`, with a transparent window) and the second slide are exported from Figma (Feeds › Twibbon, "Member 1" and "Member 2"); `src/lib/twibbon.ts` names both files, the caption and the posting rules' source. The guidebook's twibbon QR points here, and `/bergabung` links to it.

`/program` is the public hub for GDGoC IPB's programs: the three flagships (Catalyst, Tech League, Tech Support) and the regular ones (Study Jam, Google programs such as Build with AI and JuaraGCP, Friday Tech Bulletin), each with who it is for and when it runs. A program with its own page (Catalyst, Tech League, Tech Support) links to it; the rest point to Instagram for updates. The header's "Program", the footer's "Program kami", and a link under the landing's program cards open it. `/program` and every program page carry `BreadcrumbList` JSON-LD (Beranda › Program › {program}) from `src/lib/breadcrumb.ts`, matching the path. Tech League 2026/27 has its own host, `league.gdgocipb.com` ([ADR 0008](docs/decisions/0008-league-subdomain-one-app-shared-login.md), #179). Its landing (`src/app/league/page.tsx`) shows the three categories, the registration state for the current date (WIB, revalidated hourly), the schedule grouped by phase, and a short FAQ, from one component (`src/components/league/content.tsx`) that `/program/tech-league` also renders. The schedule is the main version of Program & Development's timeline of 4 November 2026 (#166): registration 1 December 2026 – 14 January 2027 (early wave 1–7 December, regular 8 December – 12 January, extension 13–14 January), submissions due 14 January, preliminary selection 15–21 January, finalists announced 22 January, the online final 6–8 February (one category per day), and the offline awarding on 13 February 2027, venue to be announced. "Daftar" opens `/daftar` on the league: a visitor signs in with Google and comes back there, a new member goes through `/onboarding?next=league` on the main site first, and a member then creates a team or joins one with an invite code or link (#183, #192; see [Tech League teams](docs/DASHBOARD.md#tech-league-teams)). Submissions follow in #180. The league header links its schedule, its FAQ, the main site and the member dashboard; its footer links back to the main site. Where `NEXT_PUBLIC_LEAGUE_URL` is set, `/program/tech-league` answers 301 to the league root; where it is not (local development, staging until its league host exists), that page stays and the league is previewed at `/league`, `noindex`. Links to the competition use `techLeague.href`, the league root or the old page; `techLeague.path` is the old page. The form and guidebook links are `registrationUrl` and `guidebookUrl` in `src/lib/tech-league.ts`. The landing's Tech League card and timeline track, the `/program` and `/bergabung` cards and the footer open the league. It carries `Event` JSON-LD for the competition (online, 1 December 2026 – 13 February 2027; it becomes a mixed event with a `Place` once the awarding venue is known) with the league root as its `url`, `FAQPage` JSON-LD built from the same FAQ items the page renders, and a Beranda › Program › Tech League breadcrumb ending on the league URL. Program pages live under `/program/<slug>`, without a year; the page moved from `/tech-league` on 13 October with no redirect, since nothing printed or posted used the old URL.

`/program/catalyst` is the public page for GDGoC Catalyst 2026/27, a free Software Development bootcamp with three roles (Hacker, Hipster, Hustler) for SMK and university students from any campus: oprec 2–22 November 2026, participants announced 29 November, nine online Sunday sessions 6 December 2026 – 18 April 2027, and the showcase on 2 May 2027. Oprec runs on Program & Development's Google Form (#32). The page shows the oprec state for the current date (WIB: upcoming, open, closed, then announced) and is revalidated hourly; set `oprecUrl` in `src/lib/catalyst.ts` and it shows "Daftar" while oprec is open (#90). It carries `Course` JSON-LD (free, online, with the sessions as its `CourseInstance`), an `Event` for the sessions (the showcase is left out until its venue is confirmed), `FAQPage`, and a breadcrumb. The landing's Catalyst card and the `/program` hub open it. Date labels and the WIB window check both program pages use are in `src/lib/schedule.ts`.

`/program/tech-support` is the public page for Tech Support, the Competition Support Hub: mentor facilitation for members preparing for competitions outside the chapter, all year round (#91). It walks through the five steps (request, share the competition and progress, GDGoC finds a mentor, first consultation, mentor and team agree the scope), says a request is answered within 3 working days, lists the eight kinds of help (finding teammates, ideation, technical consultation, UI/UX review, proposal feedback, pitch-deck review, mock judging, presentation practice), names the three confirmed mentors with a role line each, and ends with a FAQ. Its button opens the request form at `/dashboard/tech-support` (#92), set by `requestPath` in `src/lib/tech-support.ts`, while visitors are sent to `/bergabung`. It carries `Service` JSON-LD (provided by the landing's `Organization`, with the kinds of help as its offer catalog), `FAQPage`, and a breadcrumb. The landing's Tech Support card and the `/program` hub open it.

## Dashboard

`/dashboard` is the signed-in workspace, with a sidebar (a drawer on phones) using Pixelarticons. The overview shows a member their open and pending tasks and nearest deadlines; a Catalyst participant also sees a card with their cohort, role, team and teammates, and the open tasks for their role. Members work on assignments, write a rich-text answer (Tiptap, with a pixel-icon toolbar), drag and drop up to five files (10 MB each) with upload progress, and resubmit until an assignment is closed; work after the deadline is accepted and marked late. Apresiasi and the profile page (the community tag, read-only, and the member's own photo, cropped to a square in the browser and printed on the member card) live here too. Every member has a two-sided CR80 member card (54 × 85.6 mm) at `/dashboard/kartu`, with a QR for checking in at gatherings and a print-ready PNG to save. Staff print cards for many members at once from **Cetak kartu** on the members page (`/dashboard/anggota/cetak`): everyone matching the table's filters or a hand-picked set, a summary of who has no number or no uploaded photo, issuing missing numbers, then one A4 PDF drawn in the browser, nine cards per sheet with bleed and crop marks, each fronts page followed by its backs mirrored for long-edge duplex, and a CSV manifest of page and slot per card. Owners, the verified emails in `APPRECIATION_ADMIN_EMAILS`, promote members to admin and review Apresiasi. Owners and admins review Apresiasi, create assignments with editable slugs (`/dashboard/tugas/<slug>`, old slugs keep redirecting), review every submission, and manage members. `/dashboard/papan-skor` shows the Bogor Run top 100 for the week and all time. Staff can hide a player from every board and restore them from a separate hidden list. Hiding follows the member-management hierarchy: admins act only on members, and only an owner can undo an owner's hide. Deactivated members are hidden automatically until they are reactivated, and per-run records are deleted after 30 days. Members request a competition mentor at `/dashboard/tech-support` and follow its status; owners, admins, and members an owner makes Tech Support handlers match a mentor and close requests from `/dashboard/tech-support/antrean`, which shows the response time against the 3 working day target and the counts of requests facilitated and teams supported. Staff see every Tech League team at `/dashboard/tech-league`, with a CSV, and import Program & Development's registration results there. See `docs/DASHBOARD.md`.

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

## Repository layout

A single Next.js App Router frontend (`src/`) on a Convex backend (`convex/`), managed with pnpm. There is no monorepo split.

```text
.
├── src/
│   ├── app/            Next.js routes and layouts (pages stay thin)
│   ├── components/     React components, grouped by feature
│   └── lib/            Framework-free logic, shared by pages and tests
├── convex/             Backend: schema, queries and mutations, auth, crons
├── public/             Static assets served as-is
├── design/             Design records and still-capture scripts (not shipped)
├── docs/               Written documentation (not shipped)
├── .github/            CI, project-board workflow, issue and PR templates
└── *.config.*, package.json, .env.example, .node-version
```

### `src/app/`: routes

| Path | Purpose |
| --- | --- |
| `page.tsx`, `layout.tsx` | The landing and the root layout |
| `dashboard/` | Signed-in workspace: `tugas` (assignments), `anggota` (members, the access log, and bulk card printing at `anggota/cetak`), `apresiasi`, `papan-skor` (Bogor Run leaderboard), `program` (cohorts with their rosters, teams and role mentors), `kartu` (the member card), `kehadiran` (gatherings and check-in), `tech-support` (mentor requests and the handlers' queue), `profil` (profile and photo) |
| `onboarding/` | Four-screen first-visit flow |
| `tentang/`, `tim/`, `bergabung/`, `program/` (the hub, `catalyst/`, `tech-league/`, `tech-support/`), `privasi/` | Public pages, each listed in `indexablePaths` |
| `league/` (the landing and `daftar/`) | Tech League, served at its own host by the rewrite in `next.config.ts`; `src/proxy.ts` keeps it off the main host |
| `environment/` | Full Three.js scene; `noindex`, used by the still-capture scripts |
| `rai/` | Unlinked easter egg that unlocks the blue dino skin |
| `k/[token]/` | The page a member card's QR opens: whether the card is valid, and the whole card for staff and its holder; `noindex`, rendered per request |
| `api/auth/[...all]/` | Better Auth route handler |
| `robots.ts`, `sitemap.ts`, `icon.svg`, `globals.css` | Search, icon and global styles |

Each of `dashboard/` and `onboarding/` keeps its own `layout.tsx`, `error.tsx` and CSS next to its pages.

### `src/components/`: UI

- Top level: landing sections (`landing.tsx`, `hero.tsx`, `header.tsx`, `join-footer.tsx`), the 3D scene and preloader (`campus-environment.tsx`, `scene-preloader.tsx`, `dino-playground.tsx`), the Bogor Run game (`bogor-run.tsx`), providers (`experience-provider.tsx`, `member-provider.tsx`), the FAQ and JSON-LD blocks, a shared `select.tsx`, the member card face shared by the dashboard and the scan page (`member-card-face.tsx`), the member avatar (`member-avatar.tsx`: the uploaded photo, the Google one, or the pixel initial), and icon sets.
- `dashboard/`, `appreciation/`, `onboarding/`, `rai/`: one folder per feature area.
- Tests sit beside the component as `*.test.tsx` and run in jsdom.

### `src/lib/`: logic

- `campus/`: the Three.js campus model and runtime.
- `bogor-run/`: the game engine, shared with the server replay.
- Domain modules (`assignment.ts`, `appreciation.ts`, `access-log.ts`, `onboarding.ts`, `cohort.ts`, `enrolment-import.ts`, `bevy-export.ts`, `league-team.ts` and `league-import.ts` (Tech League teams and the registration import), `member-card.ts`, `card-print.ts` and `card-sheet.ts` (bulk card printing), `gathering.ts`, `tech-support-request.ts`, `member-table.ts`, `rich-text.ts`), the public pages' content and structured data (`tech-league.ts`, `catalyst.ts`, `about.ts`, `faq.ts`, `breadcrumb.ts`, with program dates in `schedule.ts`), and shared helpers (`chapter.ts` for the chapter year, `site.ts`, `community.ts`, `auth-client.ts`, `auth-server.ts`, `qr.ts`, which draws QR codes on the page, `png.ts`, which marks a PNG as 300 dpi, and `pdf.ts`, a small PDF writer for the card print file).
- Tests sit beside the module as `*.test.ts` and run in the edge runtime.

### `convex/`: backend

- `schema.ts` defines every table: member profiles, appreciations and reviews, assignments with slugs, submissions, reviews and files, Bogor Run runs, bests, players and stats, cohorts with their enrolments, teams and mentors, member cards and their per-year counters, gatherings and check-ins, Tech Support requests, the access log, and account deletions.
- One file per domain: `members`, `access` and `accessLog`, `assignments`, `appreciations`, `dashboard`, `cohorts`, `cards`, `gatherings`, `techSupport`, `bogorRun` and `bogorRunToken`.
- `auth.ts`, `auth.config.ts`, `http.ts` and `convex.config.ts` wire up Better Auth. `crons.ts` schedules upload cleanup (hourly) and run-record pruning (daily).
- `_generated/` is produced by Convex; do not edit it.
- Tests (`*.test.ts`) run against `convex-test`, with no deployment.

### Other folders

- `public/`: `brand/` (logo SVG, Open Graph image), `environments/` (fallback still of the 3D scene) and `games/bogor-run/` (SVG sprites and scenery, with their own README).
- `design/`: generated direction images (`environments/`, `footer-directions/`), reference material, prompts, and the `.mjs` scripts that capture the scene still and the Open Graph image. `.vercelignore` keeps this out of CLI uploads.
- `docs/`: `DASHBOARD.md` (roles and assignments), `APRESIASI.md` (backend, auth, release), `ONBOARDING.md`, `DESIGN.md` (art direction), `VERIFICATION.md` (checks and evidence), `PROJECT_BOARD.md` (roadmap workflow), `CONTRIBUTING.md` (issues, commits and pull requests), `ARCHITECTURE.md` (how the services connect), and `decisions/` (one record per settled decision).
- `.github/`: `ci.yml` (lint, typecheck and test), `project-board.yml`, issue forms (bug, feature, task) and the pull request template.
- Root config: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.mts` (two projects: `backend` and `interface`), `vercel.json`, `pnpm-workspace.yaml`, `.env.example`.

## Key modules

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
- `src/app/program/page.tsx` and `src/lib/breadcrumb.ts`: the public program hub, and the `BreadcrumbList` JSON-LD helper every program page uses.
- `src/app/bergabung/page.tsx`: the ways to join, their current windows, and the join FAQ.
- `src/lib/about.ts` and `src/app/tentang/page.tsx`: the vision, missions, `AboutPage` JSON-LD, and the about page.
- `src/lib/team.ts` and `src/app/tim/page.tsx`: the Lead, Co-Lead and divisions, `Person` JSON-LD, and the team page.
- `src/lib/catalyst.ts` and `src/app/program/catalyst/page.tsx`: Catalyst roles, schedule, oprec state, Course and Event JSON-LD, and the public page.
- `src/lib/schedule.ts`: Indonesian date and range labels, and the WIB sign-up window both program pages use.
- `src/lib/tech-league.ts`, `src/lib/league.ts`, `src/components/league/` and `src/app/league/`: Tech League categories, schedule, registration state, Event JSON-LD, the league host's URLs (`leagueHref`, `mainHref`), its landing, and Daftar with the team page (`src/components/league/team.tsx`); `convex/league.ts` holds the teams; `src/app/program/tech-league/page.tsx` is the old page.
- `src/lib/tech-support.ts` and `src/app/program/tech-support/page.tsx`: the Tech Support steps, kinds of help, mentors, FAQ, request link, Service JSON-LD, and the public page.
- `src/lib/faq.ts`, `src/components/faq.tsx`, and `src/components/json-ld.tsx`: FAQ items rendered on a page and as `FAQPage` JSON-LD from one source, and the escaped JSON-LD script tag.
- `src/lib/site.ts`: the canonical origin, shared Open Graph fields, and the per-page canonical helper.
- `docs/DESIGN.md`: Figma evidence, direction choices and implementation rationale.
- `docs/VERIFICATION.md`: checks and evidence boundaries.
- `docs/DASHBOARD.md`: dashboard roles, assignments, submissions, and member management.

`?motion=off` is a deterministic still mode. `?webgl=off` exercises the image fallback. The landing reads no query string on the server, so it is prerendered.

## Typography and content

Fonts were checked directly in the supplied Figma design-system page. Pixelify Sans is used for pixel display type, Space Grotesk for supporting headings, Poppins for body, and JetBrains Mono for small labels. All fonts are self-hosted through Fontsource packages; their licenses ship with those packages. The member card (#135, #142) also sets its titling (name, number and stamp) in VCR OSD Mono by Riciery Leal ("MrManet"), from https://www.dafont.com/vcr-osd-mono.font, where dafont lists it as "100% Free"; the download has no license file. It is converted to WOFF2 in `src/fonts/vcr-osd-mono.woff2` and loaded with `next/font/local` in `src/components/member-card-face.tsx` only, as `--font-vcr`, falling back to Pixelify Sans for glyphs it lacks (Latin Extended letters and the middle dot). The GDGoC IPB lockup is a transparent SVG (`public/brand/gdgoc-ipb.svg`, rendered by `src/components/brand-logo.tsx`) exported from the GDGOC 26/27 Figma file (node `297:9358`); its white box and trace fringes were removed, and the untouched export is kept in `design/references/gdgoc-ipb-logo-figma.svg`.

Copy introduces a community for students across Bogor, its learning areas, and the 2026/2027 programs. Catalyst explicitly describes Hustler, Hipster, and Hacker, following the user's correction. The main “Gabung member” CTAs open the site's own sign-in at `/dashboard`, which leads new members into onboarding; program updates and contact links use `gdgoc.ipb` on Instagram. The sticky header and desktop hero keep the existing composition while the text aligns left. The header links Tentang kami (`/tentang`), Program (`/program`), and Bogor Run. On the landing it follows the reader: the section in view is underlined in the colour of the scroll-progress quarter being filled, even for the two links that open their own pages. Elsewhere Bogor Run leads back to the landing's game, and the current page's link is marked. Its CTA adapts to the session, which it reads from the same-origin `/api/auth/get-session` after hydration, so no auth client ships with the landing. It reads Dashboard before the check, Masuk for guests (via the dashboard's Google sign-in), and a pixel initial with "Hai, <first name>" and Dashboard for members, who also get a one-tap avatar next to the menu on phones. Apresiasi lives inside the dashboard, and "Gabung member" stays in the hero and footer. No event dates, program-registration availability, or unverified metrics are invented.

## Search and sharing

The landing, `/tentang`, `/tim`, `/bergabung`, `/program`, `/program/catalyst`, `/program/tech-league`, `/program/tech-support`, and `/privasi` are indexable, listed once in `indexablePaths` in `src/lib/site.ts`. Each sets a canonical URL, so `?motion=` and `?webgl=` previews count as the landing. The dashboard, onboarding, `/rai`, `/environment`, the two design galleries, and the world previews are `noindex`. `/robots.txt` blocks only `/api/`, so crawlers can still read those `noindex` tags, and `/sitemap.xml` lists every path in `indexablePaths`. A new public page adds its path there and sets `canonical()` with the same path. All absolute URLs come from `NEXT_PUBLIC_SITE_URL`, falling back to `https://www.gdgocipb.com`. Tech League's root on its own host replaces `/program/tech-league` in that sitemap when `NEXT_PUBLIC_LEAGUE_URL` is set: `robots.txt` is the same file on both hosts and names the main sitemap, which lets it list the league's URL, so there is no second sitemap.

Every page shares one Open Graph and Twitter card image, `public/brand/og-image.jpg` (1200 × 630). Its background is a still of the landing's Three.js campus, not the concept illustration: `node design/og-image.mjs` opens `/environment?motion=off` on a running local site in headless Chrome (through `design/campus-still.mjs`), captures the rendered scene, and adds the lockup and the hero headline. Rerun it after changing the scene, the lockup, or the headline. The landing also carries `Organization` and `WebSite` JSON-LD with the chapter's names, logo, and Instagram page. The landing's title leads with "GDGoC IPB University" and keeps the Komunitas Mahasiswa Bogor positioning; its description opens with the full "Google Developer Group on Campus IPB University". The JSON-LD also lists "GDG on Campus IPB University", the name on the official chapter page, and the earlier "GDSC IPB" recorded there. A page that sets its own `openGraph` must build it with `canonical()` from `src/lib/site.ts`, because Next.js replaces nested metadata instead of merging it.

Google Search shows only part of the site's JSON-LD. It uses the `BreadcrumbList` on every public page, on desktop results only since January 2025, and the landing's `WebSite` and its publisher `Organization` for the site name and logo. Course results ended in September 2025 and FAQ results on 7 May 2026, so `Course` on `/program/catalyst` and `FAQPage` on the Catalyst, Tech League, Tech Support and join pages are not shown. Since June 2025 Google's event results take only events at a physical location that the general public can book: the online Catalyst and Tech League `Event`s are not eligible, and Catalyst, which admits participants through oprec, would not qualify even in person. A Tech League final at a public venue could get its own `Event` with a `Place` and an address. The rest of the markup stays, because it is valid schema.org and Google's notes on retired types say such markup can be left for search engines and other systems to read. Check changes in the [Schema Markup Validator](https://validator.schema.org), which reads every type; Google's [Rich Results Test](https://search.google.com/test/rich-results) reports only the types Google still shows. The dates come from Google's [Search Central documentation updates](https://developers.google.com/search/updates).

## Deployment

Live site: [www.gdgocipb.com](https://www.gdgocipb.com/). `gdgocipb.com` and `gdgoc-ipb-web.vercel.app` permanently redirect (308) to it, preserving the path, so sign-in always runs on the one origin Better Auth trusts.

The source repository is `gdgoc-ipb-university/gdgoc-web`. The `gdgoc-ipb-web` Vercel project in `aldio-lisafrons-projects` is connected to it through Vercel's Git integration, with `release` as its production branch: every push to `release` deploys production. `main` is the integration branch. Pull requests merge there, and the staging VM at [gdgoc-ipb.yorhagarden.xyz](https://gdgoc-ipb.yorhagarden.xyz) follows it as the preview of the next release; a merge to `main` does not go live on its own ([ADR 0006](docs/decisions/0006-production-deploys-from-release.md)). Vercel runs this build command:

```sh
pnpm exec convex deploy --cmd 'pnpm build'
```

It deploys the Convex backend first, then runs `next build` with `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` set to the production deployment, so the backend always ships before the frontend that depends on it. Vercel stores `CONVEX_DEPLOY_KEY` (a production deploy key, Production environment only, secret) and `NEXT_PUBLIC_SITE_URL=https://www.gdgocipb.com`. Auth secrets live only in Convex.

Only production builds run. The project's Ignored Build Step skips every branch but `release`, including `main`, because the deploy key is production-only and Google OAuth is not registered for preview URLs.

Node.js is pinned to 24.x, matching local validation and a [supported Vercel runtime](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). `.vercel/` is ignored by Git, and `.vercelignore` excludes design sources and internal documentation from CLI uploads. To link a new checkout for CLI commands (environment variables, logs, inspection):

```sh
pnpm dlx --allow-build=esbuild vercel@59.23.2 link --yes --scope aldio-lisafrons-projects --project gdgoc-ipb-web
```

See `docs/APRESIASI.md` for the backend environments and release checks.

### Releasing

1. Run **Actions → Release → Run workflow**. It opens a pull request from `main` into `release`, titled `chore(release): YYYY-MM-DD WIB`, that lists every commit, pull request and closed issue it ships. It stops with a notice when `main` has nothing new, and refuses when a release pull request is already open.
2. Check those changes on staging, and note any Convex schema change, deleted or renamed function, or new environment variable in the pull request: the build deploys Convex production before the frontend.
3. Merge the pull request with a **merge commit**, not squash. The "Protect release" ruleset allows only merge commits, requires resolved threads and the "Lint, typecheck and test" check (already on `main`'s tip), and blocks force pushes and deletion.
4. After the Vercel deployment is ready, check the shipped changes on [www.gdgocipb.com](https://www.gdgocipb.com/).

A hotfix takes the same path: fix it on `main` by pull request, then release. Org admins can bypass the ruleset only during an incident.
