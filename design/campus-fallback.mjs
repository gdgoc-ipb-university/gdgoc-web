// Renders public/environments/01-hello-campus-3d.webp, the still shown in place of the landing's Three.js
// campus when WebGL is unavailable or stalls (src/components/campus-environment.tsx).
//
// Start the site (`pnpm dev` or `pnpm start`), then run from the repository root after changing the scene:
//   node design/campus-fallback.mjs [site URL, default http://127.0.0.1:3104]
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { captureScene } from "./campus-still.mjs";

// 16:9, the frame the scene is composed for, at the renderer's full resolution.
const scene = await captureScene({ width: 1792, height: 1008 });
const webp = await sharp(scene).webp({ quality: 90 }).toBuffer();
await writeFile("public/environments/01-hello-campus-3d.webp", webp);
console.log(`public/environments/01-hello-campus-3d.webp: ${Math.round(webp.length / 1024)} KB`);
