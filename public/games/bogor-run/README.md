# Bogor Run pixel assets

Original, editable SVG pixel artwork created for the GDGoC IPB footer. All shapes sit on an integer grid and use `shape-rendering="crispEdges"`. No stock images, remote asset hosts, or new rendering packages are required.

| Angkot | Talas | Genangan |
| --- | --- | --- |
| <img src="angkot.svg" width="192" alt="Angkot hijau" /> | <img src="talas.svg" width="102" alt="Keranjang talas" /> | <img src="genangan.svg" width="156" alt="Genangan hujan" /> |

- `angkot.svg`: green minibus, cream stripe, passenger windows and two wheels (64 × 40).
- `talas.svg`: taro leaves and purple roots in a woven basket (34 × 44).
- `genangan.svg`: a small blue rain puddle and splash (52 × 14).
- `backdrop.svg`: stylized Mount Salak, Tugu Kujang, tropical greenery and a quiet street (480 × 230). An illustration, not a measured geographic or architectural reconstruction.
- `dino.svg`: two running frames built from the site's existing pixel Dino silhouette (64 × 36 sheet; each frame 32 × 36).

The game uses inset collision shapes, a bounded speed curve, and one fixed-height jump. The background remains still; moving ground marks and running-leg alternation are disabled with reduced motion. All gameplay starts explicitly, pauses outside the viewport or when focus leaves, and resumes only through a player action. The best score is local to the browser and is never sent to the server.
