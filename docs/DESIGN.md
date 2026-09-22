# Art direction and source evidence

## Primary source

[GDGoC 26/27 Figma design system](https://www.figma.com/design/YiFizWhGfLSUAlP5o64uVk/GDGOC-26-27?node-id=2-87148), inspected 22 September 2026 via Figma MCP without editing the design.

- Design-system page: `2:87148`.
- Typeface section: `23:26016`.
- Color section: `23:26023`.
- Existing AHN pixel illustration: `686:8998`.
- Pixel GDG IPB logo group: `297:9359` (inside `297:9358`).
- Confirmed fonts: Poppins, Space Grotesk, JetBrains Mono, Pixelify Sans, Minecraft, EAS VHS, Upheaval TT (BRK), VCR OSD Mono. The web uses the four openly distributed Fontsource families; other display fonts remain references.
- Confirmed Google accents: green `#34A853`, red `#EA4335`, yellow `#FBBC05`, blue `#4285F4`; dark ink appears as `#172D43` / `#243645` in the source. The website uses a darker blue for white text contrast.

Reference screenshots and the two user-supplied AHN photos live in `design/references/`. They are not exposed from the website's public directory.

## Four directions

| Direction | Subject and atmosphere | Current implementation |
| --- | --- | --- |
| Hello, Campus! | Recognizable IPB campus, AHN, Chrome Dino, tropical voxel garden | Selected, revised from photographs, reconstructed in live Three.js |
| Dino Playground | Grass terraces, code blocks, playful giant Dino | Generated artwork and landing preview |
| Cloud Club | Retro terminal workshop on cubic clouds | Generated artwork and landing preview |
| After Hours | Warm nighttime developer clubhouse | Generated artwork and landing preview |

Original prompts are in `design/prompts.json`. The selected-direction correction prompt is in `design/ahn-revision-prompt.txt`. Originals are preserved alongside the revised asset.

## Architectural correction

The first generated building was a generic rectangular campus block with an invented portico. The user's two photos replace that interpretation. AHN is distinguished by the terraced mass widening toward ground, long white canopy bands, continuous windows, the large red pyramidal roof, triangular dormer peaks, and a projecting brown chevron-shaped core. The central pointed window belongs on a facet, not on the core ridge. Emblems are treated as stylized marks, not clock faces.

The real-time model is authored planar geometry with discrete cel face colors. It uses a real directional shadow pass and navy geometric outlines. Pixel shapes are strongest in the Dino, foliage, clouds, and objects; AHN retains recognizable architectural planes.

## Reference projects

Inspected `/Users/ACERNITRO/Projects/aksesin-web` and `/Users/ACERNITRO/Projects/deliverologi`. Useful principles: large quiet hero-copy space, a world that extends beyond the frame, deliberate toon contours, small purposeful motion, a static fallback, and rendering lifecycle controls. Their product subjects, copy, bridges, and orbit composition were not reused.

## Motion and rendering

- Desktop Lenis scrolling only on a fine pointer, with native touch scrolling.
- Motion hover and section reveal; content is visible in SSR and when motion is off.
- Small camera parallax, slowly drifting clouds, a subtle Dino idle and one finite greeting jump.
- Render loops stop offscreen, when the document is hidden, and when motion is disabled.
- Pixel ratio capped at 1.6, with 1.8 million desktop pixels / 0.9 million mobile pixels for the main scene.
- Static geometry is merged; measured main-scene rendering is 15 draw calls including its shadow pass, about 259k submitted triangles, and over 8,000 authored solids.
- Responsive camera retains the composition horizontally; mobile copy sits above the scene.

## Technical references

[Next.js App Router](https://nextjs.org/docs/app/getting-started/installation), [Lenis](https://github.com/darkroomengineering/lenis), and [Motion reduced motion](https://motion.dev/docs/react-use-reduced-motion), checked alongside installed package documentation. The installed Next.js 16.3.5 docs were used for current App Router, font, image, and client-component conventions.
