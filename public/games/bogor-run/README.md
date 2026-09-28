# Bogor Run pixel assets

Original, editable SVG pixel artwork created for the GDGoC IPB footer. The cream Dino shares the site's navy outlines and warm highlights, with a broad head, full body, short legs, and no accessories. The SVG shapes sit on an integer grid and use `shape-rendering="crispEdges"`. All assets are served locally; no new rendering packages are required.

| Angkot | Talas | Genangan |
| --- | --- | --- |
| <img src="angkot.svg" width="192" alt="Angkot hijau" /> | <img src="talas.svg" width="102" alt="Keranjang talas" /> | <img src="genangan.svg" width="156" alt="Genangan hujan" /> |

- `angkot.svg`: green minibus, cream stripe, passenger windows and two wheels (64 × 40).
- `talas.svg`: taro leaves and purple roots in a woven basket (34 × 44).
- `genangan.svg`: a small blue rain puddle and splash (52 × 14).
- `backdrop.svg`: stylized Mount Salak, Tugu Kujang, tropical greenery and a quiet street (1600 × 640). An illustration, not a measured geographic or architectural reconstruction.
- `ground.svg`: a light garden floor with edge foliage, tiny flowers, and pixel texture that continues behind the directory (1600 × 600).
- `dino.svg`: cream/navy four-frame sheet (176 × 47), with 44 × 47 frames for idle/jump, two running poses, and a stopped pose. The compact silhouette takes proportion cues from the familiar browser runner while retaining the GDGoC illustration style. No Chromium asset is bundled.

The game uses inset collision shapes, a bounded speed curve, and one fixed-height jump. The static SVG landscape fills the CTA and continues through the footer. Canvas draws only actors and road marks, resizing for the available arena rather than stretching a small game card.

The autonomous run chooses its own jumps and never writes the player's score. Visitors can pause it, take over with **Ikut main**, or return to the community invitation. Offscreen/hidden-tab states stop its animation; reduced motion disables autoplay, running legs, and ground movement. Explicit gameplay remains available and pauses on focus loss or a width change. The best score is local to the browser and is never sent to the server.
