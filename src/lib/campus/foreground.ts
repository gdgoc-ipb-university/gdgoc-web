import * as THREE from "three";
import { CelBuilder, type Voxel } from "./builder";

type Point = [number, number, number];

function garden(right: boolean) {
  const b = new CelBuilder();
  const cells: Voxel[] = [];
  const colors = ["#3f732f", "#5b8d30", "#779e36", "#456a32", "#92af3d"];
  const radius = right ? 4 : 8;
  for (let x = -radius; x <= radius; x++)
    for (let z = -3; z <= 3; z++)
      for (let y = 0; y < 6; y++) {
        const shape = (x / radius) ** 2 + (z / 4) ** 2 + ((y - 1) / 4.2) ** 2;
        if (shape > 1 || (x * 17 + z * 7 + y * 11 + 1000) % 13 === 0) continue;
        cells.push({ x, y, z, color: colors[(x * 13 + z * 3 + y * 7 + 1000) % colors.length] });
      }
  b.voxels(cells, [0, 0.2, 0], 0.28);

  // Folded tropical leaves, with a raised central vein and two flat color planes.
  function leaf(base: Point, tip: Point, width: number, tone: number) {
    const dx = tip[0] - base[0],
      dz = tip[2] - base[2];
    const length = Math.hypot(dx, dz) || 1;
    const side = [(dz / length) * width, (-dx / length) * width];
    const middle: Point = [
      base[0] + dx * 0.45,
      base[1] + (tip[1] - base[1]) * 0.65,
      base[2] + dz * 0.45,
    ];
    const left: Point = [middle[0] + side[0], middle[1] - 0.18, middle[2] + side[1]];
    const edge: Point = [middle[0] - side[0], middle[1] - 0.18, middle[2] - side[1]];
    b.face([base, left, tip, middle], colors[tone]);
    b.face([base, middle, tip, edge], colors[(tone + 2) % colors.length]);
  }
  for (let i = 0; i < (right ? 11 : 6); i++) {
    const angle = i * 2.399;
    const reach = right ? 1.4 + (i % 3) * 0.65 : 1.1 + (i % 2) * 0.4;
    leaf(
      [right ? 0.2 : -0.3, 0.3, 0],
      [
        Math.cos(angle) * reach,
        (right ? 2.2 : 1.1) + (i % 3) * 0.38,
        Math.sin(angle) * reach * 0.5,
      ],
      0.2 + (i % 3) * 0.045,
      i % colors.length,
    );
  }
  for (const [x, y, z] of right
    ? [
        [-0.7, 1.55, 0.7],
        [0.05, 1.8, 0.3],
        [0.85, 1.3, 0.6],
      ]
    : [
        [-0.6, 1.35, 0.5],
        [0.9, 1.15, 0.8],
      ]) {
    b.box(x, y, z, 0.15, 0.15, 0.14, "#efc545", false);
    for (const [dx, dy] of [
      [-0.16, 0],
      [0.16, 0],
      [0, -0.16],
      [0, 0.16],
    ])
      b.box(x + dx, y + dy, z, 0.17, 0.17, 0.13, "#fff4d9", false);
  }
  return b.finish(right ? "Near tropical leaves and daisies" : "Near voxel hedge");
}

export function createForeground() {
  const root = new THREE.Group();
  root.name = "Soft foreground garden";
  const left = garden(false),
    right = garden(true);
  root.add(left, right);
  root.traverse((object) => {
    object.layers.set(1);
    if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = false;
  });
  const direction = new THREE.Vector3(),
    horizontal = new THREE.Vector3(),
    vertical = new THREE.Vector3();
  function place(camera: THREE.PerspectiveCamera) {
    camera.updateMatrixWorld();
    const depth = 14;
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * depth;
    const halfWidth = halfHeight * camera.aspect;
    camera.getWorldDirection(direction);
    horizontal.setFromMatrixColumn(camera.matrixWorld, 0);
    vertical.setFromMatrixColumn(camera.matrixWorld, 1);
    for (const [group, x, belowFrame] of [
      [left, -0.97, 0.35],
      [right, 0.98, 0.55],
    ] as const) {
      group.position
        .copy(camera.position)
        .addScaledVector(direction, depth)
        .addScaledVector(horizontal, x * halfWidth)
        .addScaledVector(vertical, -halfHeight - belowFrame);
    }
  }
  return { root, place };
}

/** Blur only the closest vegetation; architecture and the Dino never enter the blur targets. */
export function createForegroundPass(renderer: THREE.WebGLRenderer) {
  const source = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  const horizontalTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const scene = new THREE.Scene();
  const vertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const fragmentShader = `
    uniform sampler2D source;
    uniform vec2 stepSize;
    varying vec2 vUv;
    vec4 sampleColor(vec2 uv) {
      vec4 value = texture2D(source, uv);
      #ifndef COMPOSITE
        value.rgb *= value.a;
      #endif
      return value;
    }
    void main() {
      vec4 value = sampleColor(vUv) * 0.227027;
      value += sampleColor(vUv + stepSize * 1.384615) * 0.316216;
      value += sampleColor(vUv - stepSize * 1.384615) * 0.316216;
      value += sampleColor(vUv + stepSize * 3.230769) * 0.070270;
      value += sampleColor(vUv - stepSize * 3.230769) * 0.070270;
      #ifdef COMPOSITE
        if (value.a < 0.001) discard;
        value.rgb /= value.a;
      #endif
      gl_FragColor = value;
      #ifdef COMPOSITE
        #include <colorspace_fragment>
      #endif
    }
  `;
  const horizontalMaterial = new THREE.ShaderMaterial({
    uniforms: { source: { value: source.texture }, stepSize: { value: new THREE.Vector2() } },
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const compositeMaterial = new THREE.ShaderMaterial({
    defines: { COMPOSITE: 1 },
    uniforms: {
      source: { value: horizontalTarget.texture },
      stepSize: { value: new THREE.Vector2() },
    },
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const quad = new THREE.Mesh(geometry, horizontalMaterial);
  quad.frustumCulled = false;
  scene.add(quad);
  const clearColor = new THREE.Color();
  return {
    resize(width: number, height: number, mobile: boolean) {
      const ratio = renderer.getPixelRatio();
      const w = Math.max(1, Math.round((width * ratio) / 2));
      const h = Math.max(1, Math.round((height * ratio) / 2));
      source.setSize(w, h);
      horizontalTarget.setSize(w, h);
      const spread = ratio * (mobile ? 0.5 : 0.9);
      horizontalMaterial.uniforms.stepSize.value.set(spread / w, 0);
      compositeMaterial.uniforms.stepSize.value.set(0, spread / h);
    },
    render(world: THREE.Scene, worldCamera: THREE.PerspectiveCamera) {
      renderer.getClearColor(clearColor);
      const alpha = renderer.getClearAlpha();
      const mask = worldCamera.layers.mask;
      worldCamera.layers.set(1);
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(source);
      renderer.render(world, worldCamera);
      worldCamera.layers.mask = mask;
      quad.material = horizontalMaterial;
      renderer.setRenderTarget(horizontalTarget);
      renderer.render(scene, camera);
      quad.material = compositeMaterial;
      renderer.setRenderTarget(null);
      renderer.setClearColor(clearColor, alpha);
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = true;
    },
    dispose() {
      source.dispose();
      horizontalTarget.dispose();
      geometry.dispose();
      horizontalMaterial.dispose();
      compositeMaterial.dispose();
    },
  };
}
