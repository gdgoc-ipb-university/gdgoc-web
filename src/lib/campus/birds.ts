import * as THREE from "three";
import { CelBuilder } from "./builder";

const formation = [
  [0, 0, 0, 0.82],
  [-2.2, 0.8, -1.4, 0.67],
  [1.9, -0.25, -1.9, 0.62],
  [-3.4, 1.2, -4, 0.5],
  [3.3, 0.65, -4.5, 0.48],
] as const;

/** Five solid, stepped birds share three draw calls for bodies and hinged wings. */
export function createBirds() {
  const root = new THREE.Group();
  root.name = "Pixel birds above the campus";

  function instances(builder: CelBuilder, name: string) {
    const source = builder.finish(name).children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshToonMaterial>;
    const mesh = new THREE.InstancedMesh(source.geometry, source.material, formation.length);
    mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // The tiny moving flock does not enter the cached campus shadow map.
    mesh.castShadow = mesh.receiveShadow = false;
    // These five instances move together through a small, bounded sky region.
    mesh.frustumCulled = false;
    root.add(mesh);
    return mesh;
  }

  const body = new CelBuilder();
  body.box(0, 0, 0, 0.2, 0.19, 0.64, "#344c5b", false);
  body.box(0, 0.06, 0.32, 0.23, 0.2, 0.23, "#344c5b", false);
  body.box(0, 0.025, 0.47, 0.1, 0.07, 0.13, "#c39343", false);
  body.box(0, -0.08, 0.06, 0.16, 0.08, 0.38, "#f5eedc", false);
  for (const side of [-1, 1])
    body.box(side * 0.085, -0.015, -0.42, 0.085, 0.07, 0.3, "#344c5b", false);
  const bodies = instances(body, "Bird bodies");

  function wing(side: number) {
    const b = new CelBuilder();
    b.box(side * 0.27, 0, 0, 0.54, 0.075, 0.38, "#3e5867", false);
    b.box(side * 0.7, -0.015, -0.1, 0.32, 0.065, 0.29, "#344c5b", false);
    b.box(side * 0.98, -0.025, -0.2, 0.24, 0.055, 0.18, "#344c5b", false);
    return instances(b, side < 0 ? "Left wings" : "Right wings");
  }
  const left = wing(-1), right = wing(1);
  const pose = new THREE.Object3D();
  const hinge = new THREE.Matrix4();
  const transform = new THREE.Matrix4();

  function update(elapsed: number) {
    const angle = elapsed * 0.105;
    const heading = Math.atan2(-5.5 * Math.sin(angle), 3.6 * Math.cos(angle));
    formation.forEach(([x, y, z, scale], i) => {
      pose.position.set(
        12 + Math.cos(angle) * 5.5 + x,
        20 + y + Math.sin(elapsed * 0.65 + i * 0.9) * 0.22,
        -32 + Math.sin(angle) * 3.6 + z,
      );
      pose.rotation.set(0.05, heading, Math.sin(angle + i * 0.2) * 0.1);
      pose.scale.setScalar(scale);
      pose.updateMatrix();
      bodies.setMatrixAt(i, pose.matrix);
      // Each bird has its own cadence, alternating short flaps and long glides.
      const cycle = (elapsed + i * 0.71) % 5.8;
      const envelope = cycle < 2.6 ? Math.sin((cycle / 2.6) * Math.PI) : 0;
      const flap = 0.12 + Math.sin(elapsed * 9 + i * 1.7) * envelope * 0.64;
      hinge.makeRotationZ(-flap);
      left.setMatrixAt(i, transform.multiplyMatrices(pose.matrix, hinge));
      hinge.makeRotationZ(flap);
      right.setMatrixAt(i, transform.multiplyMatrices(pose.matrix, hinge));
    });
    for (const mesh of [bodies, left, right]) mesh.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { root, update, count: formation.length };
}
