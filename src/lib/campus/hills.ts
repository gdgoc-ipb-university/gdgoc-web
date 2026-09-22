import * as THREE from "three";
import { CelBuilder, type Voxel } from "./builder";

/** Solid, stepped ridgelines with distance haze and denser fog in the valleys. */
export function createHills() {
  const group = new THREE.Group();
  group.name = "Three misty horizon ridges";
  const layers = [
    { z: -118, unit: 0.8, height: 11, color: "#9bb9c7", seed: 5, peak: -17 },
    { z: -87, unit: 0.68, height: 10, color: "#80a8b9", seed: 2, peak: -38 },
    { z: -59, unit: 0.55, height: 8, color: "#709c9d", seed: 9, peak: -61 },
  ];
  for (const layer of layers) {
    const b = new CelBuilder();
    const cells: Voxel[] = [];
    const tint = new THREE.Color(layer.color);
    const span = Math.ceil(100 / layer.unit);
    for (let x = -span; x <= span; x++) {
      for (let z = 0; z < 6; z++) {
        const worldX = x * layer.unit;
        const ridge =
          0.8 * Math.exp(-(((worldX - layer.peak) / 19) ** 2)) +
          0.68 * Math.exp(-(((worldX - layer.peak - 75) / 28) ** 2)) +
          0.3 * Math.exp(-(((worldX + 4) / 12) ** 2));
        const detail =
          Math.sin(worldX * 0.42 + layer.seed) * 0.6 + Math.cos(z * 0.8 + worldX * 0.17) * 0.6;
        const height = Math.max(
          1,
          Math.round((2.5 + layer.height * ridge + detail - z * 0.12) / layer.unit),
        );
        for (let y = 0; y < height; y++) {
          const color = tint
            .clone()
            .multiplyScalar(0.86 + ((x * 17 + z * 13 + y * 7 + 9999) % 7) * 0.026);
          cells.push({ x, y, z, color: `#${color.getHexString()}` });
        }
      }
    }
    b.voxels(cells, [0, 0, layer.z], layer.unit, false);
    const ridge = b.finish("Hazy voxel ridge");
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
