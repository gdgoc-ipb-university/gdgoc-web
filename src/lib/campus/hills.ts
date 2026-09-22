import * as THREE from "three";
import { CelBuilder, type Voxel } from "./builder";

// Broad shoulders and an uneven double summit, guided by Salak's profile from Bogor.
// Authored geometry, rather than a generic cone or a photographic sky plane.
const salakProfile = [
  [-145, 1], [-128, 2.5], [-115, 5], [-104, 8], [-95, 12], [-87, 16],
  [-80, 19.8], [-77, 21.5], [-72, 22], [-68, 21], [-64, 18.5], [-60, 18.8],
  [-57, 19.7], [-54, 18.7], [-49, 20.2], [-46, 22.5], [-43, 21.7],
  [-37, 17.5], [-30, 12], [-19, 6], [-4, 2.2], [18, 1],
] as const;

function salakHeight(x: number) {
  for (let i = 1; i < salakProfile.length; i++) {
    const [right, top] = salakProfile[i];
    if (x > right) continue;
    const [left, bottom] = salakProfile[i - 1];
    return 0.82 * THREE.MathUtils.lerp(bottom, top, THREE.MathUtils.clamp((x - left) / (right - left), 0, 1));
  }
  return 1;
}

/** Salak and two low foothill layers, with distance haze and opaque valley mist. */
export function createHills() {
  const group = new THREE.Group();
  group.name = "Gunung Salak and misty foothills";
  const layers = [
    { name: "Gunung Salak", z: -116, unit: 0.68, height: 0, color: "#708f9d", seed: 5, peak: -70 },
    { name: "Distant Salak foothills", z: -87, unit: 0.8, height: 3.5, color: "#8eacb3", seed: 2, peak: -57 },
    { name: "Near misty foothills", z: -59, unit: 0.7, height: 2.6, color: "#82a39a", seed: 9, peak: -75 },
  ];
  for (const layer of layers) {
    const b = new CelBuilder();
    const cells: Voxel[] = [];
    const tint = new THREE.Color(layer.color);
    const span = Math.ceil(150 / layer.unit);
    for (let x = -span; x <= span; x++) {
      for (let z = 0; z < 6; z++) {
        const worldX = x * layer.unit;
        const ridge = layer.height === 0 ? salakHeight(worldX) :
          2.5 + layer.height * (
            Math.exp(-(((worldX - layer.peak) / 25) ** 2)) +
            0.7 * Math.exp(-(((worldX - layer.peak - 105) / 34) ** 2))
          );
        const detail =
          Math.sin(worldX * 0.42 + layer.seed) * 0.16 + Math.cos(z * 0.8 + worldX * 0.17) * 0.12;
        const height = Math.max(
          1,
          Math.round((ridge + detail - z * 0.12) / layer.unit),
        );
        for (let y = 0; y < height; y++) {
          // Wide, slanted tonal folds retain cel shading without noisy per-voxel colors.
          const fold = Math.floor((worldX + (height - y) * layer.unit * 0.55 + 300) / 8) % 3;
          const color = tint.clone().multiplyScalar(0.92 + fold * 0.04);
          cells.push({ x, y, z, color: `#${color.getHexString()}` });
        }
      }
    }
    b.voxels(cells, [0, 0, layer.z], layer.unit, false);
    const ridge = b.finish(layer.name);
    const mesh = ridge.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshToonMaterial>;
    mesh.material.gradientMap?.dispose();
    mesh.material.dispose();
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <fog_pars_vertex>",
          "#include <fog_pars_vertex>\nvarying float vRidgeHeight;",
        )
        .replace(
          "#include <worldpos_vertex>",
          "#include <worldpos_vertex>\nvRidgeHeight = (modelMatrix * vec4(transformed, 1.0)).y;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <fog_pars_fragment>",
          "#include <fog_pars_fragment>\nvarying float vRidgeHeight;",
        )
        .replace(
          "#include <fog_fragment>",
          `
          #ifdef USE_FOG
            float distanceHaze = smoothstep(fogNear, fogFar, vFogDepth);
            float valleyMist = (1.0 - smoothstep(1.0, 10.0, vRidgeHeight)) * 0.78;
            float fogAmount = 1.0 - (1.0 - distanceHaze) * (1.0 - valleyMist);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogAmount);
          #endif
        `,
        );
    };
    material.customProgramCacheKey = () => "campus-valley-mist-v1";
    // Distant terrain is deliberately unlit; atmospheric colors stay quiet and stable.
    (mesh as THREE.Mesh).material = material;
    mesh.castShadow = mesh.receiveShadow = false;
    group.add(ridge);
  }
  return group;
}
