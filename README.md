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
pnpm test # backend permissions, validation, autosave and form interactions
pnpm check # ESLint + Next route types + TypeScript
pnpm build
pnpm start
```

Node 24 and pnpm 11.22.0 are used. The landing has no backend dependency. The Apresiasi workspace uses Convex and Google OAuth; configure the variables in `.env.example` and follow `docs/APRESIASI.md`.

## Apresiasi

`/apresiasi` provides Google sign-in, private autosaved drafts, a review-before-submit form, documentation links (no uploads), and submission status. `/apresiasi/admin` is a verified-email allowlist review queue; it is locked until `APPRECIATION_ADMIN_EMAILS` is explicitly configured. Publication is a manual Media & Creative workflow, with the Instagram post URL recorded after publishing.

## Selected direction

**Hello, Campus!** was selected after reviewing four generated directions. The original AHN illustration was corrected using the user's front and aerial photographs, then rendered in a cel-shaded style. All five original PNGs and optimized WebPs are in `public/environments/`. The current reference is `01-hello-campus-ahn-cel-v2.png`.

The landing uses actual 3D geometry, without projecting the concept image onto it. The model includes AHN's stepped massing, long white canopies, window bands, large red pyramidal roof, dormers, faceted entrance core, narrow vertical window and stylized circular emblems. It also contains voxel trees, palms, planters and flowers, a pond, paving, lights, Google-color seats, clouds, and an extruded Chrome Dino. It is an illustrated reconstruction from photographs, not a surveyed architectural model.

The landing preloader releases after the renderer completes its first frame, including the foreground blur pass. It never displays a simulated loading percentage. A failed WebGL initialization releases to the loaded reference image; a 12-second watchdog also releases a stalled import/GPU to the static layout. The initial frame is eager even when an anchor puts the hero offscreen. Pointer movement gives a small camera parallax. Softly blurred 3D plants frame the lower corners while the campus stays sharp. Both the hero and the smaller community scene release GPU resources on unmount and pause when hidden or offscreen. Motion follows the operating system's reduced-motion setting.

The garden uses distinct round, columnar, and umbrella canopies, yellow/coral flowering trees, palms, broad tropical leaves, and a small Google-color direction post on the left. Fresher greens, turquoise water, and a more neutral warm key light keep the cel-shaded scene vibrant without changing the hero composition.

## Structure

- `src/lib/campus/builder.ts`: batched toon geometry, exterior-only voxel unions, and antialiased ink contours.
- `src/lib/campus/model.ts`: complete campus model; deterministic geometry and foliage.
- `src/lib/campus/hills.ts`: a stepped Gunung Salak silhouette on the left and two low foothill layers with valley fog.
- `src/lib/campus/foreground.ts`: near garden geometry and an isolated, half-resolution blur pass.
- `src/lib/campus/runtime.ts`: renderer, directional shadow pass, responsive camera, motion, visibility and cleanup.
- `src/components/campus-environment.tsx`: progressive enhancement and accessible image fallback.
- `src/components/scene-preloader.tsx`: first-frame loading gate with native modal focus handling and reduced-motion support.
- `src/components/experience-provider.tsx`: system reduced motion and desktop Lenis scrolling.
- `src/components/join-footer.tsx`: one continuous light section for the membership invitation, pixel garden, community identity, navigation, and contact.
- `src/lib/community.ts`: verified official membership and Instagram destinations.
- `src/lib/directions.ts`: visual directions and art asset paths.
- `docs/DESIGN.md`: Figma evidence, direction choices and implementation rationale.
- `docs/VERIFICATION.md`: checks and evidence boundaries.

`?motion=off` is a deterministic still mode. `?webgl=off` exercises the image fallback. `?world=cloud-club`, `?world=dino-playground`, and `?world=after-hours` preview alternate artwork in the landing layout.

## Typography and content

Fonts were checked directly in the supplied Figma design-system page. Pixelify Sans is used for pixel display type, Space Grotesk for supporting headings, Poppins for body, and JetBrains Mono for small labels. All fonts are self-hosted through Fontsource packages; their licenses ship with those packages. The GDGoC IPB lockup was exported from the user's Figma file.

Copy introduces a community for students across Bogor, its learning areas, and the 2026/2027 programs. Catalyst explicitly describes Hustler, Hipster, and Hacker, following the user's correction. The main “Gabung member” CTAs open the official GDG chapter page, where “Join us” is available; program updates and contact links use `gdgoc.ipb` on Instagram. The sticky header and desktop hero keep the existing composition while the text aligns left. No event dates, program-registration availability, or unverified metrics are invented.

## Deployment

Live site: [gdgoc-web.vercel.app](https://gdgoc-web.vercel.app/).

The private source repository is `dikaprilio/gdgoc-web`. Production deploys use Vercel CLI with the `gdgoc-web` project in `bibobaggins-projects`:

```sh
pnpm dlx vercel@59.23.2 link --yes --scope bibobaggins-projects --project gdgoc-web
pnpm dlx vercel@59.23.2 deploy --prod --yes --scope bibobaggins-projects
```

Node.js is pinned to 24.x, matching local validation and a [supported Vercel runtime](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). `.vercel/` is ignored by Git, and `.vercelignore` excludes design sources and internal documentation from CLI uploads. Production requires `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, and `NEXT_PUBLIC_SITE_URL` in Vercel. Auth secrets live only in Convex. Deploy the Convex backend before deploying the frontend; see `docs/APRESIASI.md`.
