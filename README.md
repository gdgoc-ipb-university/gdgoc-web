# GDGoC IPB — Hello, Campus!

Landing page with a complete geometric Three.js campus environment, Next.js App Router, Lenis, and Motion for React.

## Run locally

```sh
pnpm install
pnpm dev
```

Open [the landing](http://127.0.0.1:3104), [the full scene](http://127.0.0.1:3104/environment), or [four visual directions](http://127.0.0.1:3104/directions).

```sh
pnpm check # ESLint + Next route types + TypeScript
pnpm build
pnpm start
```

Node 24 and pnpm 11.22.0 were used. No environment variables or external API services are required.

## Selected direction

**Hello, Campus!** was selected after reviewing four generated directions. The original AHN illustration was corrected using the user's front and aerial photographs, then rendered in a cel-shaded style. All five original PNGs and optimized WebPs are in `public/environments/`. The current reference is `01-hello-campus-ahn-cel-v2.png`.

The landing uses actual 3D geometry, without projecting the concept image onto it. The model includes AHN's stepped massing, long white canopies, window bands, large red pyramidal roof, dormers, faceted entrance core, narrow vertical window and stylized circular emblems. It also contains voxel trees, palms, planters and flowers, a pond, paving, lights, Google-color seats, clouds, and an extruded Chrome Dino. It is an illustrated reconstruction from photographs, not a surveyed architectural model.

The concept image loads immediately as a fallback. When WebGL initializes, the renderer replaces it. Pointer movement gives a small camera parallax. Click Dino or use the accessible “Say hello” button to greet it. Both the hero and the smaller community scene release GPU resources on unmount and pause when hidden or offscreen.

## Structure

- `src/lib/campus/builder.ts`: batched toon geometry, exterior-only voxel unions, and antialiased ink contours.
- `src/lib/campus/model.ts`: complete campus model; deterministic geometry and foliage.
- `src/lib/campus/hills.ts`: three stepped horizon ridges with distance haze and height-dependent valley fog.
- `src/lib/campus/runtime.ts`: renderer, directional shadow pass, responsive camera, raycasting, motion, visibility and cleanup.
- `src/components/campus-environment.tsx`: progressive enhancement, fallback, accessible controls.
- `src/components/experience-provider.tsx`: saved motion preference, system reduced motion, desktop Lenis scrolling.
- `src/lib/directions.ts`: visual directions and art asset paths.
- `docs/DESIGN.md`: Figma evidence, direction choices and implementation rationale.
- `docs/VERIFICATION.md`: checks and evidence boundaries.

`?motion=off` is a deterministic still mode. `?webgl=off` exercises the image fallback. `?world=cloud-club`, `?world=dino-playground`, and `?world=after-hours` preview alternate artwork in the landing layout.

## Typography and content

Fonts were checked directly in the supplied Figma design-system page. Pixelify Sans is used for pixel display type, Space Grotesk for supporting headings, Poppins for body, and JetBrains Mono for small labels. All fonts are self-hosted through Fontsource packages; their licenses ship with those packages. The GDGoC IPB lockup was exported from the user's Figma file.

Copy is an initial public-facing landing draft. The contact CTA points to the `gdgoc.ipb` Instagram handle found in the Figma file. No event dates, membership counts, recruitment availability, or unverified community metrics are invented. This project has not been published or connected to a remote repository.
