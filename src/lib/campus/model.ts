import * as THREE from "three";
import { CelBuilder } from "./builder";
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
  const onFacet = (dx: number, yy: number, lift = 0.03): [number, number, number] => [
    x + dx,
    base + yy,
    windowZ - (dx / 1.35) * 1.3 + lift,
  ];
  b.face(
    [
      onFacet(0.17, 5.13),
      onFacet(0.79, 5.13),
      onFacet(0.79, 7.22),
      onFacet(0.48, 7.61),
      onFacet(0.17, 7.22),
    ],
    "#ffffe9",
  );
  b.face(
    [
      onFacet(0.26, 5.23, 0.045),
      onFacet(0.7, 5.23, 0.045),
      onFacet(0.7, 7.16, 0.045),
      onFacet(0.48, 7.44, 0.045),
      onFacet(0.26, 7.16, 0.045),
    ],
    "#739499",
  );
  for (let i = 0; i < 5; i++)
    b.line([onFacet(0.26, 5.45 + i * 0.33, 0.06), onFacet(0.7, 5.45 + i * 0.33, 0.06)]);
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
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x + side * 1.15, base + 3.8, z + 6.9 - 0.57 + 0.045),
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
    b.box(x + side * 1.15, base + 3.8, z + 6.9 - 0.57 + 0.095, 0.065, 0.3, 0.05, "#ffffe9", false);
    b.box(
      x + side * 1.15,
      base + 3.83,
      z + 6.9 - 0.57 + 0.101,
      0.27,
      0.055,
      0.05,
      "#ffffe9",
      false,
    );
  }
}

function tree(b: CelBuilder, x: number, z: number, h: number, seed: number) {
  const rnd = random(seed),
    unit = 0.46;
  b.box(x, h * 0.3, z, 0.45, h * 0.6, 0.5, "#916142");
  b.box(x - 0.58, h * 0.56, z, 0.85, 0.26, 0.35, "#986542");
  b.box(x + 0.5, h * 0.6, z, 0.9, 0.27, 0.35, "#99613d");
  const palette = ["#477c35", "#659a33", "#86ad36", "#a5bc40", "#3b6b31"];
  const radius = Math.max(2.1, h * 0.37);
  for (let yy = -2; yy <= 2; yy++)
    for (let xx = -4; xx <= 4; xx++)
      for (let zz = -3; zz <= 3; zz++) {
        const d = (xx / 4.3) ** 2 + (zz / 3.6) ** 2 + (yy / 2.6) ** 2;
        if (d > 1 || rnd() < 0.13) continue;
        const scale = radius / 4;
        const v = unit + scale * 0.55;
        b.box(
          x + xx * scale,
          h * 0.73 + yy * scale,
          z + zz * scale,
          v,
          v,
          v,
          palette[Math.floor(rnd() * palette.length)],
          rnd() < 0.14,
        );
      }
}

function palm(b: CelBuilder, x: number, z: number, h: number) {
  for (let i = 0; i < h / 0.4; i++)
    b.box(x, 0.2 + i * 0.4, z, 0.29, 0.4, 0.3, i % 3 === 0 ? "#a67948" : "#815c3c", i % 2 === 0);
  for (let arm = 0; arm < 6; arm++) {
    const a = (arm * Math.PI) / 3;
    for (let step = 0; step < 6; step++) {
      const r = step * 0.39;
      b.box(
        x + Math.cos(a) * r,
        h + 0.3 + Math.sin((step / 6) * Math.PI) * 0.53 - step * 0.09,
        z + Math.sin(a) * r,
        0.58,
        0.27,
        0.45,
        step % 2 ? "#749630" : "#496c29",
      );
    }
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
    b.box(px, 0.88 + h / 2, pz, 0.2, h, 0.2, rnd() > 0.5 ? "#6f962e" : "#386630", false);
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
  group.add(
    new THREE.Mesh(geometry, [
      new THREE.MeshBasicMaterial({ color: "#fff6d9" }),
      new THREE.MeshBasicMaterial({ color: "#172d43" }),
    ]),
  );
  const thinEdges = new THREE.EdgesGeometry(geometry);
  const edges = new LineSegmentsGeometry();
  edges.setPositions(thinEdges.getAttribute("position").array as Float32Array);
  thinEdges.dispose();
  group.add(new LineSegments2(edges, new LineMaterial({ color: "#172d43", linewidth: 2.7 })));
  b.box(0.45, 3.78, 0.487, 0.19, 0.19, 0.045, "#142d43");
  group.add(b.finish("Dino eyes"));
  group.position.set(-9.5, 0.07, 5.5);
  group.rotation.y = -0.16;
  group.scale.setScalar(1.15);
  return group;
}

export function createCampusModel() {
  const b = new CelBuilder(),
    rnd = random(202627);
  // Full courtyard: warm patterned paving, horizontal garden terraces and a pool.
  b.box(0, -0.25, -3, 84, 0.5, 65, "#ddceb0", false);
  for (let iz = 0; iz < 29; iz++)
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
        ["#eadbc0", "#f6e9cc", "#ddcfb4", "#f0e3c7"][Math.floor(rnd() * 4)],
        false,
      );
    }
  for (let iz = 0; iz < 29; iz++)
    b.line([
      [-35, 0.03, -22 + iz * 1.12],
      [36, 0.03, -22 + iz * 1.12],
    ]);
  for (let ix = 0; ix < 46; ix++)
    b.line([
      [-34 + ix * 1.5, 0.03, -23],
      [-34 + ix * 1.5, 0.03, 12],
    ]);
  b.box(-20, 0.055, -12, 24, 0.11, 22, "#718b3e", false);
  b.box(-29, 0.07, 0, 9, 0.14, 17, "#739142", false);
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
      i % 2 ? "#4f7b32" : "#809e3b",
      false,
    );
  }
  b.box(9, 0.2, -7, 29, 0.4, 14, "#e7e0c8");
  b.box(9, 0.44, -8, 27.4, 0.2, 12, "#f1e6d0");
  for (let i = 0; i < 3; i++)
    b.box(4, 0.1 + i * 0.16, -1.5 - i * 0.43, 11 - i * 0.6, 0.2, 1.2, "#eee5d0");
  addAHN(b);

  // Back tree line and blue-green distant hills remain deliberately low.
  for (let i = 0; i < 65; i++) {
    const xx = -46 + i * 1.4,
      hh = 2.5 + Math.sin(i * 0.3) * 1.6 + rnd() * 1.8;
    b.box(xx, hh / 2, -31 - rnd() * 4, 1.5, hh, 2, "#a4bcc1", false);
  }
  for (let i = 0; i < 13; i++) tree(b, -28 + i * 2.3, -22 + rnd() * 5, 4.7 + rnd() * 2.7, 50 + i);
  tree(b, -20, 3, 11, 70);
  tree(b, -16, -5, 6.8, 83);
  tree(b, -4, -7, 5.7, 88);
  tree(b, -24, 9, 13.4, 77);
  tree(b, 23, -9, 6.4, 91);
  tree(b, 28, 2, 7.5, 92);
  tree(b, 20, -24, 6.8, 98);
  palm(b, -21, -10, 6.1);
  palm(b, -13, -13, 6.2);
  palm(b, -6, -13, 7.2);
  palm(b, 24, -5, 8.6);

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
        i % 2 ? "#507d29" : "#8eaa31",
      );
    }
  }
  for (let i = 0; i < 9; i++) lamp(b, -18 + i * 4.9, -3.1 + (i % 2) * 0.9);
  // Square reflection pool with tile rim and sparse pixel water highlights.
  b.box(10, 0.09, 3.2, 11.5, 0.18, 5.7, "#e3ded0");
  b.box(10, 0.205, 3.2, 10.7, 0.07, 4.9, "#397d8a", false);
  for (let i = 0; i < 120; i++)
    b.box(
      5 + rnd() * 10,
      0.25,
      1 + rnd() * 4.4,
      0.16 + rnd() * 0.46,
      0.014,
      0.06,
      rnd() < 0.3 ? "#b8dacc" : "#69a5a1",
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
  b.box(-1.7, 0.73, 5.45, 1.2, 1.45, 1.1, "#43804a");
  b.box(17.2, 0.66, 7.6, 1.35, 1.3, 1.35, "#fbbc05");
  b.box(19, 0.54, 8.5, 1.36, 1.07, 1.4, "#4285f4");
  b.box(21, 0.58, 8.4, 1.4, 1.15, 1.4, "#ea4335");

  // Graphic cast shadows sit just above the paving, all actual geometry.
  for (const [x, z, w, d] of [
    [-9.3, 5.6, 3.3, 1.4],
    [-20, 3, 6, 3],
    [-4, -7, 3, 2],
    [23, -9, 3.3, 2],
  ] as const) {
    b.face(
      [
        [x - w / 2, 0.05, z],
        [x + w / 2, 0.05, z],
        [x + w / 2 + 2, 0.05, z + d],
        [x - w / 2 + 1, 0.05, z + d],
      ],
      "#b4b29f",
      false,
    );
  }

  const root = new THREE.Group();
  root.name = "GDGoC IPB — Hello Campus";
  const environment = b.finish("AHN and pixel courtyard");
  root.add(environment);
  const dino = buildDino();
  root.add(dino);
  const clouds: THREE.Group[] = [];
  for (const [x, y, z, s] of [
    [-21, 16, -21, 1.4],
    [-8, 10, -24, 0.85],
    [1, 9, -27, 0.6],
    [25, 14, -24, 1.3],
  ] as const) {
    const cloud = new CelBuilder();
    cloud.box(0, 0, 0, 4, 0.65, 1.1, "#fff7e8", false);
    cloud.box(-0.6, 0.55, 0, 1.3, 0.6, 0.9, "#fff7e8", false);
    cloud.box(0.8, 0.42, -0.1, 1.4, 0.35, 0.9, "#fff7e8", false);
    const group = cloud.finish("Pixel cloud");
    group.position.set(x, y, z);
    group.scale.setScalar(s);
    root.add(group);
    clouds.push(group);
  }
  return { root, dino, clouds, solids: b.solids };
}
