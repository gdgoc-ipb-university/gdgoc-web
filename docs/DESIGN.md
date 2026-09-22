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

The real-time model is authored planar geometry with vertex colors and a nearest-filtered toon-lighting ramp. A warm directional sun from the right and a cool hemisphere fill give the architecture flat light bands and real cast shadows. Pixel shapes are strongest in the Dino, foliage, clouds, and objects; AHN retains recognizable architectural planes.

## Perspective, foliage, and atmosphere revision

The corrected camera is lower and offset to the right. AHN is rotated slightly to expose its right facade and the chevron core; its vertical silhouette and the foreground Dino scale were adjusted against the selected illustration. Desktop copy sits in the open sky to the left of the roof.

Leaf crowns and palm fronds are now voxel unions. Shared internal faces and duplicate cells are removed, so coplanar leaf surfaces no longer compete in the depth buffer. Opaque antialiased contours use a small surface depth offset. Leaf canopies and Dino retain directional cel colors and cast shadows but omit self-shadow sampling to avoid tiny unstable shadow seams.

Three separate stepped terrain ridges replace the old low row of blocks. Each has a different silhouette and blue-green palette; distance haze separates the layers, and height-dependent fog becomes denser toward the valleys. The mist is shaded on opaque terrain, without overlapping transparent planes.

A continuous terrain foundation extends beneath the courtyard and meadow. Its bounds cover the visible ground at the camera's parallax extremes, closing the previously exposed white corner beside the left tree.

The western edge now has two additional layers of trees and low understory. Paving uses warm, narrow joints between tiles without a separate ink grid. The pointed window projects above the emblem on the central core; its offset accounts for the upper facade's setback from the lower facet.

Near hedges, tropical leaves, and small flowers frame the lower corners. They are real geometry on a separate camera layer, blurred through two half-resolution passes and alpha-composited over the sharp scene. Their placement adapts to the camera frustum on resize, retaining the framing on mobile. Greeting controls, the manual motion switch, and the Bogor/curiosity caption have been removed from the environment.

## Reference projects

Inspected `/Users/ACERNITRO/Projects/aksesin-web` and `/Users/ACERNITRO/Projects/deliverologi`. Useful principles: large quiet hero-copy space, a world that extends beyond the frame, deliberate toon contours, small purposeful motion, a static fallback, and rendering lifecycle controls. Their product subjects, copy, bridges, and orbit composition were not reused.

## Community profile refinement — 23 September

The left backdrop is now an authored Gunung Salak silhouette, with broad shoulders, an uneven double summit, two low foothill layers, and mist at the base. The [Salak photograph by Diangunawan](https://commons.wikimedia.org/wiki/File:Mount_Salak,_Bogor,_Indonesia.jpg) was inspected as a shape reference; no photographic asset is embedded in the site. Placement is composed for the illustration, not a geographic line-of-sight claim.

Desktop hero text keeps its previous 11% left margin and maximum 740px block width. Only text alignment changes. The headline is capped at 72px and two lines; body copy is 16px on desktop and 14px on mobile. Clouds sit outside the copy area, and the near left canopy is pulled back to keep the text legible. The sticky header uses the existing CSS scroll padding; Lenis no longer adds a second offset.

The copy treats the site as a community profile. It names coding, UI/UX, AI, Study Jam, and the actual programs instead of generic motivational headlines. Local source material: `gdgoc-second-brain/02-divisi/aturan-copywriting.md`, `04-program/gdgoc-catalyst.md`, `04-program/tech-league.md`, and the current lead-authored scope recorded in `04-program/konten-open-knowledge-tech-support.md`. Catalyst roles and capstone, Tech League's three categories, and Tech Support's matching language follow those records. Program CTAs offer information without claiming registration is open.

The primary action is “Gabung member.” Its destination is the [official GDGoC IPB chapter page](https://gdg.community.dev/gdg-on-campus-ipb-university-bogor-indonesia/), inspected live with the “Join us” button present. This is community-platform membership; it does not imply automatic admission to a program or core team.

The closing invitation and footer share the same warm paper background as the landing. A small pixel garden, blue membership button, chapter identity, and navigation form one continuous composition. The dark footer variation was discarded at the user's direction. Internal art-direction review links are omitted from the public profile footer; `/directions` remains available directly.

## Motion and rendering

- Desktop Lenis scrolling only on a fine pointer, with native touch scrolling.
- Motion hover and section reveal; content is visible in SSR and when motion is off.
- Small camera parallax, slowly drifting clouds, and a subtle Dino idle.
- Render loops stop offscreen, when the document is hidden, and when motion is disabled.
- System reduced motion remains automatic; no saved manual preference or scene controls are used.
- Pixel ratio capped at 1.6, with 1.8 million desktop pixels / 0.9 million mobile pixels for the main scene.
- Static geometry is merged. The current scene measures 23 draw calls and about 464k submitted triangles during idle, including the foreground and blur passes, with 16,179 campus/foliage solids plus Salak, two foothill layers, and the foreground garden. The shadow map is cached during idle and refreshed for motion changes and context restoration.
- Responsive camera retains the composition horizontally; mobile copy sits above the scene.

## Technical references

[Next.js App Router](https://nextjs.org/docs/app/getting-started/installation), [Lenis](https://github.com/darkroomengineering/lenis), and [Motion reduced motion](https://motion.dev/docs/react-use-reduced-motion), checked alongside installed package documentation. The installed Next.js 16.3.5 docs were used for current App Router, font, image, and client-component conventions.
