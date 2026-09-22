import * as THREE from "three";
import { CelBuilder, celMaterial, type Voxel } from "./builder";
import { createHills } from "./hills";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function addAHN(b: CelBuilder) {
  const x = 10,
    z = -12,
    base = 0.8;
  const widths = [25, 24, 21.5, 19.4, 17.5];
  const depths = [10.5, 10, 9.3, 8.6, 8];
  const storey = 1.36;
  for (let i = 0; i < 5; i++) {
    const y = base + i * storey,
      w = widths[i],
      d = depths[i];
    b.box(x, y + 0.56, z, w, 1.12, d, "#f7f3df");
    b.box(x, y + 0.2, z + d / 2 + 0.014, w, 0.24, 0.08, "#b27a60");
    b.box(x, y + 0.7, z + d / 2 + 0.063, w - 0.2, 0.64, 0.075, "#3d6474");
    b.box(x + w / 2 + 0.018, y + 0.7, z, 0.06, 0.64, d - 0.1, "#2d505d");
    const count = Math.floor(w / 0.65);
    for (let j = 0; j <= count; j++) {
      const xx = x - w / 2 + 0.1 + (j * (w - 0.2)) / count;
      b.box(xx, y + 0.7, z + d / 2 + 0.11, 0.055, 0.7, 0.07, "#1c3947", false);
      if (j % 6 === 0) b.box(xx, y + 0.54, z + d / 2 + 0.13, 0.2, 1.1, 0.2, "#fffae8");
    }
    b.box(x, y + 0.72, z + d / 2 + 0.12, w, 0.045, 0.045, "#193948", false);
    for (let j = 0; j < 12; j++)
      b.box(x + w / 2 + 0.06, y + 0.7, z - d / 2 + (j * d) / 12, 0.1, 0.7, 0.05, "#172d43", false);
    b.canopy(x, y + 1.16, z, w + 1.5, d + 1.1);
  }
  const roofY = base + 5 * storey - 0.1;
  b.pyramid(x, roofY, z, 18.2, 9.2, 5.7);
  b.box(x, roofY + 6.02, z, 0.055, 0.7, 0.055, "#859494");
  for (const offset of [-3.8, 0, 3.8]) {
    const cx = x + offset,
      zz = z + 4.46,
      yy = roofY + 0.15;
    b.face(
      [
        [cx - 1.15, yy, zz],
        [cx + 1.15, yy, zz],
        [cx, yy + 1.22, zz - 0.54],
      ],
      "#fffae9",
    );
    b.face(
      [
        [cx - 0.82, yy + 0.12, zz + 0.012],
        [cx + 0.82, yy + 0.12, zz + 0.012],
        [cx, yy + 0.96, zz - 0.34],
      ],
      "#294858",
    );
    b.line([
      [cx, yy + 0.15, zz + 0.03],
      [cx, yy + 0.82, zz - 0.24],
    ]);
  }

  // AHN's front core projects as a chevron. It widens in three steps toward ground.
  function core(w: number, y: number, h: number, depth: number) {
    const front = z + 5.8 + depth,
      back = z + 3.75;
    b.face(
      [
        [x - w / 2, y, front - 1.3],
        [x, y, front],
        [x, y + h, front],
        [x - w / 2, y + h, front - 1.3],
      ],
      "#8f5346",
    );
    b.face(
      [
        [x, y, front],
        [x + w / 2, y, front - 1.3],
        [x + w / 2, y + h, front - 1.3],
        [x, y + h, front],
      ],
      "#b46d50",
    );
    b.face(
      [
        [x + w / 2, y, front - 1.3],
        [x + w / 2, y, back],
        [x + w / 2, y + h, back],
        [x + w / 2, y + h, front - 1.3],
      ],
      "#75463e",
    );
    b.face(
      [
        [x - w / 2, y + h, back],
        [x + w / 2, y + h, back],
        [x + w / 2, y + h, front - 1.3],
        [x, y + h, front],
        [x - w / 2, y + h, front - 1.3],
      ],
      "#bcc9c2",
    );
    // Sparse masonry seams keep the building readable rather than noisy.
    for (let row = 1; row < h / 0.26; row++) {
      const yy = y + row * 0.26;
      b.line([
        [x - w / 2, yy, front - 1.29],
        [x, yy, front + 0.015],
        [x + w / 2, yy, front - 1.29],
      ]);
    }
  }
  core(7.3, base, 2.4, 1.6);
  core(4.8, base + 2.4, 2.3, 1.1);
  core(2.7, base + 4.7, 3.1, 0.7);
  const windowZ = z + 5.8 + 0.7;
  const emblemAxis = 0.76;
  // The upper facet is set back: compensate so its window projects directly above the crest.
  const windowAxis = 0.64;
  const onFacet = (dx: number, yy: number, lift = 0.03): [number, number, number] => [
    x + windowAxis + dx,
    base + yy,
    windowZ - ((windowAxis + dx) / 1.35) * 1.3 + lift,
  ];
  b.face(
    [
      onFacet(-0.31, 5.13),
      onFacet(0.31, 5.13),
      onFacet(0.31, 7.22),
      onFacet(0, 7.61),
      onFacet(-0.31, 7.22),
    ],
    "#ffffe9",
  );
  b.face(
    [
      onFacet(-0.22, 5.23, 0.045),
      onFacet(0.22, 5.23, 0.045),
      onFacet(0.22, 7.16, 0.045),
      onFacet(0, 7.44, 0.045),
      onFacet(-0.22, 7.16, 0.045),
    ],
    "#739499",
  );
  for (let i = 0; i < 5; i++)
    b.line([onFacet(-0.22, 5.45 + i * 0.33, 0.06), onFacet(0.22, 5.45 + i * 0.33, 0.06)]);
  b.box(x, base + 8.15, z + 5.9, 0.05, 0.65, 0.05, "#aebcb5");
  const entryZ = z + 7.5;
  b.box(x, base + 0.76, entryZ, 4.4, 1.53, 0.4, "#294954");
  b.box(x, base + 1.6, entryZ + 0.1, 4.6, 0.17, 0.6, "#f7f4e6");
  for (const dx of [-2.2, -0.75, 0.75, 2.2])
    b.box(x + dx, base + 0.8, entryZ + 0.35, 0.12, 1.6, 0.14, "#ecf0df");
  for (let i = 0; i < 5; i++)
    b.box(x, base - 0.08 - i * 0.13, entryZ + 0.8 + i * 0.3, 5.1 + i * 0.3, 0.17, 0.7, "#e3e0d0");
  // Circular emblems on both facets. Stylised crests, not clock faces.
  for (const side of [-1, 1]) {
    const emblemX = x + side * emblemAxis;
    const emblemZ = z + 6.9 - (emblemAxis / 2.4) * 1.3;
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(emblemX, base + 3.8, emblemZ + 0.045),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side * 0.5, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    const medal = new THREE.CircleGeometry(0.32, 16);
    b.geometry(medal, "#fcf8dc", matrix);
    medal.dispose();
    const inner = new THREE.CircleGeometry(0.23, 16);
    matrix.elements[14] += 0.025;
    b.geometry(inner, "#295b7d", matrix, false);
    inner.dispose();
    b.box(emblemX, base + 3.8, emblemZ + 0.095, 0.065, 0.3, 0.05, "#ffffe9", false);
    b.box(emblemX, base + 3.83, emblemZ + 0.101, 0.27, 0.055, 0.05, "#ffffe9", false);
  }
}

type Crown = "round" | "column" | "umbrella" | "yellow" | "coral";

function tree(
  b: CelBuilder, foliage: CelBuilder, x: number, z: number, h: number, seed: number,
  crown: Crown = seed % 5 === 1 ? "column" : seed % 5 === 2 ? "umbrella" : "round",
) {
  const rnd = random(seed);
  const trunk = Math.max(0.45, h * 0.043);
  b.box(x, h * 0.3, z, trunk, h * 0.6, trunk, "#a16a43");
  b.box(x - 0.58, h * 0.56, z, 0.85, 0.26, 0.35, "#986542");
  b.box(x + 0.5, h * 0.6, z, 0.9, 0.27, 0.35, "#99613d");
  const greens = [
    ["#258646", "#43a849", "#75bd3c", "#a9d94b", "#1e6d43"],
    ["#2b8053", "#479f58", "#6cb74f", "#99cf60", "#23664c"],
    ["#448e37", "#63b336", "#8dcc3b", "#b5df52", "#317c3e"],
  ];
  const palette = crown === "yellow"
    ? ["#c89e28", "#f1be28", "#ffcf41", "#ffe47a", "#459349"]
    : crown === "coral"
      ? ["#bf5473", "#df628a", "#ee87a4", "#f9b0bb", "#419151"]
      : greens[seed % greens.length];
  const radius = Math.max(2.1, Math.min(4.8, h * 0.37));
  const wide = crown === "column" ? 2.6 : crown === "umbrella" ? 4.8 : 4.3;
  const tall = crown === "column" ? 3.9 : crown === "umbrella" ? 1.85 : 2.6;
  const cells: Voxel[] = [];
  for (let yy = -3; yy <= 3; yy++)
    for (let xx = -4; xx <= 4; xx++)
      for (let zz = -3; zz <= 3; zz++) {
        const d = (xx / wide) ** 2 + (zz / (wide * 0.84)) ** 2 + (yy / tall) ** 2;
        if (d > 1 || rnd() < 0.09) continue;
        const tones = yy > 0 ? [1, 2, 3] : yy < 0 ? [0, 1, 4] : [0, 1, 2, 3, 4];
        cells.push({
          x: xx,
          y: yy,
          z: zz,
          color: palette[tones[Math.floor(rnd() * tones.length)]],
        });
      }
  foliage.voxels(cells, [x, h * 0.73, z], radius / 4);
}

function palm(b: CelBuilder, foliage: CelBuilder, x: number, z: number, h: number) {
  for (let i = 0; i < h / 0.4; i++)
    b.box(x, 0.2 + i * 0.4, z, 0.29, 0.4, 0.3, i % 3 === 0 ? "#a67948" : "#815c3c", i % 2 === 0);
  const cells: Voxel[] = [];
  const unit = 0.26;
  for (let arm = 0; arm < 7; arm++) {
    const a = (arm * Math.PI * 2) / 7;
    for (let step = 0; step < 10; step++) {
      const r = step * 0.26;
      for (let side = -1; side <= (step < 7 ? 1 : 0); side++) {
        cells.push({
          x: Math.round((Math.cos(a) * r + Math.sin(a) * side * unit) / unit),
          y: Math.round((Math.sin((step / 10) * Math.PI) * 0.75 - step * 0.1) / unit),
          z: Math.round((Math.sin(a) * r - Math.cos(a) * side * unit) / unit),
          color: step % 3 ? "#7bc93b" : "#278845",
        });
      }
    }
  }
  foliage.voxels(cells, [x, h + 0.3, z], unit);
}

/** Broad folded leaves interrupt the cubic canopy silhouettes at eye level. */
function tropicalPlant(b: CelBuilder, x: number, z: number, scale = 1) {
  b.box(x, 0.55 * scale, z, 0.18, 1.1 * scale, 0.18, "#5e943e", false);
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.399;
    const reach = (1.3 + (i % 3) * 0.3) * scale;
    const dx = Math.cos(angle), dz = Math.sin(angle);
    const y = (1.4 + (i % 3) * 0.5) * scale;
    const base: [number, number, number] = [x, 0.65 * scale, z];
    const spine: [number, number, number] = [x + dx * reach * 0.48, y, z + dz * reach * 0.48];
    const tip: [number, number, number] = [x + dx * reach, y - 0.3, z + dz * reach];
    const edge = 0.36 * scale;
    b.face([base, [spine[0] + dz * edge, y - 0.22, spine[2] - dx * edge], tip, spine], "#79c843");
    b.face([base, spine, tip, [spine[0] - dz * edge, y - 0.22, spine[2] + dx * edge]], "#20934e");
  }
}

function gardenSignpost(b: CelBuilder, x: number, z: number) {
  b.box(x, 1.35, z, 0.14, 2.7, 0.14, "#264548");
  for (const [y, direction, color] of [[2.45, 1, "#3679ed"], [1.96, -1, "#f8be15"], [1.47, 1, "#ed5e48"]] as const) {
    b.box(x, y, z + 0.06, 1.35, 0.32, 0.15, color);
    b.box(x + direction * 0.76, y, z + 0.06, 0.19, 0.18, 0.15, color, false);
    b.box(x + direction * 0.89, y, z + 0.06, 0.1, 0.08, 0.15, color, false);
  }
}

function planter(b: CelBuilder, x: number, z: number, w: number, d: number, seed: number) {
  const rnd = random(seed);
  b.box(x, 0.39, z, w, 0.78, d, "#c4c1ad");
  b.box(x, 0.79, z, w + 0.12, 0.14, d + 0.12, "#eee9d7");
  b.box(x, 0.85, z, w - 0.23, 0.1, d - 0.23, "#36573a", false);
  for (let j = 0; j < Math.floor(w / 0.5); j++) {
    const xx = x - w / 2 + 0.25 + j * 0.5;
    b.line([
      [xx, 0, z + d / 2 + 0.01],
      [xx, 0.76, z + d / 2 + 0.01],
    ]);
  }
  b.line([
    [x - w / 2, 0.36, z + d / 2 + 0.012],
    [x + w / 2, 0.36, z + d / 2 + 0.012],
  ]);
  for (let i = 0; i < w * d * 9; i++) {
    const px = x + (rnd() - 0.5) * (w - 0.3),
      pz = z + (rnd() - 0.5) * (d - 0.3),
      h = 0.18 + rnd() * 0.36;
    b.box(px, 0.88 + h / 2, pz, 0.2, h, 0.2, rnd() > 0.5 ? "#7fc03b" : "#288441", false);
    if (rnd() < 0.26) {
      b.box(px, 1.0 + h, pz, 0.12, 0.12, 0.12, "#f6c649", false);
      for (const [dx, dz] of [
        [-0.11, 0],
        [0.11, 0],
        [0, -0.11],
        [0, 0.11],
      ])
        b.box(px + dx, 1.0 + h, pz + dz, 0.11, 0.12, 0.11, "#fffbe6", false);
    }
  }
}

function lamp(b: CelBuilder, x: number, z: number) {
  b.box(x, 0.8, z, 0.13, 1.6, 0.13, "#253c3d");
  b.box(x, 1.65, z, 0.4, 0.58, 0.38, "#233839");
  b.box(x, 1.65, z + 0.198, 0.25, 0.4, 0.025, "#ffffdb", false);
  b.box(x + 0.208, 1.65, z, 0.026, 0.4, 0.24, "#e0ebbe", false);
  b.box(x, 1.98, z, 0.5, 0.1, 0.48, "#293c35");
}

function buildDino() {
  const b = new CelBuilder();
  const points = [
    [14, 0],
    [26, 0],
    [26, 2],
    [28, 2],
    [28, 10],
    [20, 10],
    [20, 12],
    [25, 12],
    [25, 14],
    [18, 14],
    [18, 17],
    [21, 17],
    [21, 20],
    [19, 20],
    [19, 19],
    [17, 19],
    [17, 22],
    [15, 22],
    [15, 25],
    [13, 25],
    [13, 30],
    [9, 30],
    [9, 28],
    [11, 28],
    [11, 24],
    [7, 24],
    [7, 28],
    [3, 28],
    [3, 26],
    [5, 26],
    [5, 21],
    [3, 21],
    [3, 18],
    [1, 18],
    [1, 8],
    [3, 8],
    [3, 13],
    [5, 13],
    [5, 16],
    [9, 16],
    [9, 13],
    [12, 13],
    [12, 2],
    [14, 2],
  ];
  const shape = new THREE.Shape(
    points.map(([x, y]) => new THREE.Vector2((x - 14) * 0.145, (30 - y) * 0.145)),
  );
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.47, bevelEnabled: false });
  const group = new THREE.Group();
  group.name = "Chrome Dino";
  const front = celMaterial();
  front.vertexColors = false;
  front.color.set("#fff6d9");
  front.emissive.set("#fff0d0");
  front.emissiveIntensity = 0.48;
  const sides = celMaterial();
  sides.vertexColors = false;
  sides.color.set("#172d43");
  group.add(new THREE.Mesh(geometry, [front, sides]));
  (group.children[0] as THREE.Mesh).castShadow = true;
  (group.children[0] as THREE.Mesh).receiveShadow = false;
  const thinEdges = new THREE.EdgesGeometry(geometry);
  const edges = new LineSegmentsGeometry();
  edges.setPositions(thinEdges.getAttribute("position").array as Float32Array);
  thinEdges.dispose();
  group.add(new LineSegments2(edges, new LineMaterial({ color: "#172d43", linewidth: 2.7 })));
  b.box(0.45, 3.78, 0.487, 0.19, 0.19, 0.045, "#142d43");
  group.add(b.finish("Dino eyes"));
  group.position.set(-9.5, 0.07, 7.3);
  group.rotation.y = -0.16;
  group.scale.setScalar(1.32);
  return group;
}

export function createCampusModel() {
  const b = new CelBuilder(),
    foliage = new CelBuilder(),
    rnd = random(202627);
  // One continuous terrain foundation covers the entire camera frustum. Courtyard
  // and meadow slabs sit above it; their outside corners must never expose the sky.
  b.box(0, -0.5, -125, 520, 0.5, 440, "#70a34e", false);
  // Full courtyard: warm patterned paving, horizontal garden terraces and a pool.
  b.box(0, -0.25, -3, 84, 0.5, 65, "#d9ceb6", false);
  b.box(0, -0.22, -61, 190, 0.3, 65, "#8b9f68", false);
  for (let iz = 0; iz < 41; iz++)
    for (let ix = 0; ix < 46; ix++) {
      const x = -34 + ix * 1.5,
        z = -22 + iz * 1.12;
      b.box(
        x,
        0.009,
        z,
        1.48,
        0.025,
        1.1,
        ["#ece1cb", "#f1e6cf", "#e7dcc5", "#ede2cc"][Math.floor(rnd() * 4)],
        false,
      );
    }
  // The narrow gaps between paving blocks supply subtle, warm joints without an ink grid.
  b.box(-20, 0.055, -12, 24, 0.11, 22, "#71a844", false);
  b.box(-29, 0.07, 0, 9, 0.14, 17, "#68a547", false);
  for (let i = 0; i < 65; i++) {
    const xx = -30 + rnd() * 25,
      zz = -20 + rnd() * 14,
      hh = 0.28 + rnd() * 0.45;
    b.box(
      xx,
      0.1 + hh / 2,
      zz,
      0.6 + rnd() * 0.9,
      hh,
      0.7 + rnd() * 0.6,
      i % 2 ? "#358941" : "#88bd3d",
      false,
    );
  }
  b.box(9, 0.2, -7, 29, 0.4, 14, "#e7e0c8");
  b.box(9, 0.44, -8, 27.4, 0.2, 12, "#f1e6d0");
  for (let i = 0; i < 3; i++)
    b.box(4, 0.1 + i * 0.16, -1.5 - i * 0.43, 11 - i * 0.6, 0.2, 1.2, "#eee5d0");
  const architecture = new CelBuilder();
  addAHN(architecture);
  // Layer the repaired western terrain edge with canopy and low understory.
  for (let i = 0; i < 14; i++) {
    const x = -65 + i * 2.8;
    tree(b, foliage, x, -32 - (i % 3) * 3.4, 4.5 + (i % 5) * 0.8, 210 + i);
    if (i < 11) tree(b, foliage, x + 1.5, -25 - (i % 2) * 2.5, 2.3 + (i % 3) * 0.45, 250 + i);
  }
  for (let i = 0; i < 20; i++)
    tree(b, foliage, -37 + i * 3.1, -31 + rnd() * 5, 3.2 + rnd() * 3, 110 + i);
  for (let i = 0; i < 13; i++)
    tree(b, foliage, -28 + i * 2.3, -22 + rnd() * 5, 4.7 + rnd() * 2.7, 50 + i);
  // Retain the left tree frame while leaving the left-aligned hero text legible.
  tree(b, foliage, -24.7, 3, 17, 70, "round");
  tree(b, foliage, -16, -5, 6.8, 83);
  tree(b, foliage, -4, -7, 5.7, 88);
  tree(b, foliage, -26.7, 9, 19.5, 77, "round");
  tree(b, foliage, 23, -9, 6.4, 91);
  tree(b, foliage, 28, 2, 7.5, 92);
  tree(b, foliage, 34, 14, 31, 95);
  tree(b, foliage, 20, -24, 6.8, 98);
  palm(b, foliage, -21, -10, 6.1);
  palm(b, foliage, -13, -13, 6.2);
  palm(b, foliage, -6, -13, 7.2);
  palm(b, foliage, 24, -5, 8.6);
  // Flowering accents and different leaf scales break up the western green wall.
  tree(b, foliage, -20.5, -7.5, 6.2, 310, "yellow");
  tree(b, foliage, -29, -14, 5.3, 312, "coral");
  tropicalPlant(b, -18, 0.6, 1.25);
  tropicalPlant(b, -23, 3.8, 1.45);
  tropicalPlant(b, -14.6, -4.8, 0.85);
  gardenSignpost(b, -18.7, 3.5);

  for (const [px, pz, pw, pd, seed] of [
    [-19, -0.5, 7, 2.1, 1],
    [-5, -5, 5, 2.1, 2],
    [1, -4.1, 6, 1.7, 3],
    [13, -3.4, 6, 1.8, 4],
    [20, -2.7, 4.8, 1.8, 5],
    [2, 7.9, 7.3, 2.7, 6],
    [-18, 9.7, 8, 3, 7],
    [23, 8.5, 9, 4, 8],
  ])
    planter(b, px, pz, pw, pd, seed);
  // Tall angular foreground leaves frame the garden and make its depth legible.
  for (const [cx, cz] of [
    [-20, 10],
    [24, 11],
    [23, 8],
    [-24, 7],
  ]) {
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI * 2) / 9,
        dx = Math.cos(a),
        dz = Math.sin(a),
        h = 1.4 + (i % 3) * 0.48;
      b.face(
        [
          [cx, 0.3, cz],
          [cx + dx * 0.55 + 0.18, 0.8, cz + dz * 0.55],
          [cx + dx * 1.1, h, cz + dz * 1.1],
          [cx + dx * 0.35 - 0.18, 0.8, cz + dz * 0.35],
        ],
        i % 2 ? "#2b9145" : "#92cf40",
      );
    }
  }
  for (let i = 0; i < 9; i++) lamp(b, -18 + i * 4.9, -3.1 + (i % 2) * 0.9);
  // Square reflection pool with tile rim and sparse pixel water highlights.
  b.box(10, 0.09, 3.2, 11.5, 0.18, 5.7, "#e3ded0");
  b.box(10, 0.205, 3.2, 10.7, 0.07, 4.9, "#218f9e", false);
  for (let i = 0; i < 120; i++)
    b.box(
      5 + rnd() * 10,
      0.25,
      1 + rnd() * 4.4,
      0.16 + rnd() * 0.46,
      0.014,
      0.06,
      rnd() < 0.3 ? "#c0edda" : "#58c3b5",
      false,
    );
  for (let i = 0; i < 14; i++)
    b.box(6 + rnd() * 7, 0.29, 2 + rnd() * 3, 0.25, 0.08, 0.3, "#668932");
  // Brand-color seats: familiar blocks around the dinosaur, no invented signage.
  for (const [x, z, c] of [
    [-13.5, 6, "#ea4335"],
    [-6, 6, "#4285f4"],
  ] as const) {
    b.box(x, 0.87, z, 2.9, 0.57, 0.94, c);
    b.box(x - 0.95, 0.29, z, 0.3, 0.57, 0.6, "#76614f");
    b.box(x + 0.95, 0.29, z, 0.3, 0.57, 0.6, "#76614f");
  }
  b.box(-3.4, 0.66, 5.6, 1.1, 1.3, 1.1, "#fbbc05");
  b.box(-1.7, 0.73, 5.45, 1.2, 1.45, 1.1, "#2fa451");
  b.box(17.2, 0.66, 7.6, 1.35, 1.3, 1.35, "#fbbc05");
  b.box(19, 0.54, 8.5, 1.36, 1.07, 1.4, "#4285f4");
  b.box(21, 0.58, 8.4, 1.4, 1.15, 1.4, "#ea4335");

  const root = new THREE.Group();
  root.name = "GDGoC IPB — Hello Campus";
  const environment = b.finish("AHN and pixel courtyard");
  root.add(environment);
  const crowns = foliage.finish("Exterior-only leaf canopies");
  // Tiny self-shadow samples shimmer along voxel seams. Canopies retain their
  // directional cel shading and cast shadows, but don't sample their own shadow map.
  (crowns.children[0] as THREE.Mesh).receiveShadow = false;
  root.add(crowns);
  const ahn = architecture.finish("Andi Hakim Nasoetion");
  // A low three-quarter view reveals the right facade and the projecting core.
  for (const child of ahn.children) {
    if (child instanceof THREE.Mesh) child.geometry.translate(-10, 0, 12);
  }
  ahn.position.set(10, 0, -12);
  ahn.rotation.y = -0.18;
  ahn.scale.set(0.91, 1.16, 1);
  root.add(ahn, createHills());
  const dino = buildDino();
  root.add(dino);
  const clouds: THREE.Group[] = [];
  // Keep the hero's established text area clear: a small cloud at the left edge,
  // with the larger clouds in open sky above and beside AHN.
  for (const [x, y, z, s] of [
    [-54, 26, -35, 0.85],
    [18.5, 25, -38, 1.5],
    [25, 19, -24, 1.7],
  ] as const) {
    const cloud = new CelBuilder();
    cloud.box(0, 0, 0, 4, 0.65, 1.1, "#e7d8b1", false);
    cloud.box(-0.6, 0.55, 0, 1.3, 0.6, 0.9, "#e7d8b1", false);
    cloud.box(0.8, 0.42, -0.1, 1.4, 0.35, 0.9, "#e7d8b1", false);
    const group = cloud.finish("Pixel cloud");
    const surface = group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshToonMaterial>;
    const normals = surface.geometry.getAttribute("normal");
    const colors = surface.geometry.getAttribute("color");
    const tint = new THREE.Color();
    for (let i = 0; i < normals.count; i++) {
      tint.set(normals.getY(i) < -0.5 ? "#cbc0cc" : normals.getX(i) < -0.5 ? "#e6d8d0" : "#fff0d1");
      colors.setXYZ(i, tint.r, tint.g, tint.b);
    }
    surface.material.gradientMap?.dispose();
    surface.material.dispose();
    (surface as THREE.Mesh).material = new THREE.MeshBasicMaterial({ vertexColors: true });
    surface.castShadow = surface.receiveShadow = false;
    group.position.set(x, y, z);
    group.scale.setScalar(s);
    root.add(group);
    clouds.push(group);
  }
  return { root, dino, clouds, solids: b.solids + architecture.solids + foliage.solids };
}
