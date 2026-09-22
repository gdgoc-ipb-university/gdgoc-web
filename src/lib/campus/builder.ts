import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

type V3 = [number, number, number];
const cube = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const cubeEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
export type Voxel = { x: number; y: number; z: number; color: string };

export function celMaterial() {
  // A nearest-filtered ramp preserves flat bands while receiving real cast shadows.
  const ramp = new THREE.DataTexture(new Uint8Array([0, 55, 145, 255]), 4, 1, THREE.RedFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  const material = new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap: ramp,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  material.shadowSide = THREE.FrontSide;
  return material;
}

/** Merge solid surfaces and ink contours; the shared sun supplies the cel bands. */
export class CelBuilder {
  private positions: number[] = [];
  private colors: number[] = [];
  private lines: number[] = [];
  private shade = new THREE.Color();
  public solids = 0;

  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    outline = true,
    angle = 0,
  ) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle),
      new THREE.Vector3(w, h, d),
    );
    this.geometry(cube, color, matrix, false);
    if (outline) this.addEdges(cubeEdges, matrix);
    this.solids++;
  }
  geometry(
    geometry: THREE.BufferGeometry,
    color: string,
    matrix = new THREE.Matrix4(),
    outline = true,
  ) {
    const data = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = data.getAttribute("position");
    const vertex = new THREE.Vector3();
    this.shade.set(color);
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(matrix);
      this.positions.push(vertex.x, vertex.y, vertex.z);
      this.colors.push(this.shade.r, this.shade.g, this.shade.b);
    }
    if (outline) {
      const edges = new THREE.EdgesGeometry(geometry, 25);
      this.addEdges(edges, matrix);
      edges.dispose();
    }
    if (data !== geometry) data.dispose();
  }
  private addEdges(edges: THREE.BufferGeometry, matrix: THREE.Matrix4) {
    const position = edges.getAttribute("position");
    const point = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(matrix);
      this.lines.push(point.x, point.y, point.z);
    }
  }
  line(points: V3[]) {
    for (let i = 1; i < points.length; i++) this.lines.push(...points[i - 1], ...points[i]);
  }
  face(points: V3[], color: string, outline = true) {
    this.shade.set(color);
    for (let i = 1; i < points.length - 1; i++) {
      this.positions.push(...points[0], ...points[i], ...points[i + 1]);
      for (let v = 0; v < 3; v++) this.colors.push(this.shade.r, this.shade.g, this.shade.b);
    }
    if (outline) this.line([...points, points[0]]);
  }
  /** Exterior-only voxel union: shared faces never reach the depth buffer. */
  voxels(cells: Voxel[], origin: V3, unit: number, outline = true) {
    const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
    const occupied = new Map(cells.map((cell) => [key(cell.x, cell.y, cell.z), cell]));
    const sides: { direction: V3; corners: V3[] }[] = [
      {
        direction: [1, 0, 0],
        corners: [
          [1, 0, 0],
          [1, 1, 0],
          [1, 1, 1],
          [1, 0, 1],
        ],
      },
      {
        direction: [-1, 0, 0],
        corners: [
          [0, 0, 1],
          [0, 1, 1],
          [0, 1, 0],
          [0, 0, 0],
        ],
      },
      {
        direction: [0, 1, 0],
        corners: [
          [0, 1, 1],
          [1, 1, 1],
          [1, 1, 0],
          [0, 1, 0],
        ],
      },
      {
        direction: [0, -1, 0],
        corners: [
          [0, 0, 0],
          [1, 0, 0],
          [1, 0, 1],
          [0, 0, 1],
        ],
      },
      {
        direction: [0, 0, 1],
        corners: [
          [1, 0, 1],
          [1, 1, 1],
          [0, 1, 1],
          [0, 0, 1],
        ],
      },
      {
        direction: [0, 0, -1],
        corners: [
          [0, 0, 0],
          [0, 1, 0],
          [1, 1, 0],
          [1, 0, 0],
        ],
      },
    ];
    const edges = new Map<string, [V3, V3]>();
    for (const cell of occupied.values()) {
      for (const { direction, corners } of sides) {
        if (occupied.has(key(cell.x + direction[0], cell.y + direction[1], cell.z + direction[2])))
          continue;
        const local = corners.map(([x, y, z]): V3 => [cell.x + x, cell.y + y, cell.z + z]);
        const points = local.map(([x, y, z]): V3 => [
          origin[0] + (x - 0.5) * unit,
          origin[1] + (y - 0.5) * unit,
          origin[2] + (z - 0.5) * unit,
        ]);
        this.face(points, cell.color, false);
        if (outline)
          for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            const edgeKey = [local[i].join(","), local[next].join(",")].sort().join("/");
            edges.set(edgeKey, [points[i], points[next]]);
          }
      }
    }
    for (const edge of edges.values()) this.line(edge);
    this.solids += occupied.size;
  }
  pyramid(x: number, y: number, z: number, w: number, d: number, h: number) {
    const a: V3 = [x - w / 2, y, z + d / 2],
      b: V3 = [x + w / 2, y, z + d / 2],
      c: V3 = [x + w / 2, y, z - d / 2],
      e: V3 = [x - w / 2, y, z - d / 2],
      top: V3 = [x, y + h, z];
    this.face([a, b, top], "#b96849");
    this.face([b, c, top], "#cb7950");
    this.face([c, e, top], "#b56648");
    this.face([e, a, top], "#b96849");
    for (let i = 1; i < 30; i++) {
      const t = i / 30,
        half = (w / 2) * (1 - t),
        zz = z + (d / 2) * (1 - t);
      this.face(
        [
          [x - half, y + h * t, zz + 0.012],
          [x + half, y + h * t, zz + 0.012],
          [x + half, y + h * t + 0.025, zz + 0.012],
          [x - half, y + h * t + 0.025, zz + 0.012],
        ],
        i % 3 === 0 ? "#cb7751" : "#ad6045",
        false,
      );
    }
  }
  canopy(x: number, y: number, z: number, w: number, d: number) {
    const innerW = w - 1.1,
      innerD = d - 0.7;
    this.face(
      [
        [x - w / 2, y, z + d / 2],
        [x + w / 2, y, z + d / 2],
        [x + innerW / 2, y + 0.29, z + innerD / 2],
        [x - innerW / 2, y + 0.29, z + innerD / 2],
      ],
      "#faf6e5",
    );
    this.face(
      [
        [x + w / 2, y, z + d / 2],
        [x + w / 2, y, z - d / 2],
        [x + innerW / 2, y + 0.29, z - innerD / 2],
        [x + innerW / 2, y + 0.29, z + innerD / 2],
      ],
      "#d4d7cb",
    );
    this.face(
      [
        [x - w / 2, y, z - d / 2],
        [x - w / 2, y, z + d / 2],
        [x - innerW / 2, y + 0.29, z + innerD / 2],
        [x - innerW / 2, y + 0.29, z - innerD / 2],
      ],
      "#f6f2e3",
    );
    this.box(x, y - 0.07, z, w, 0.14, d, "#d9decd", false);
  }
  finish(name: string) {
    const group = new THREE.Group();
    group.name = name;
    const surface = new THREE.BufferGeometry();
    surface.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    surface.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    surface.computeVertexNormals();
    surface.computeBoundingSphere();
    const mesh = new THREE.Mesh(surface, celMaterial());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (this.lines.length) {
      const edges = new LineSegmentsGeometry();
      edges.setPositions(this.lines);
      group.add(
        new LineSegments2(
          edges,
          new LineMaterial({ color: "#35464b", linewidth: 0.9, alphaToCoverage: true }),
        ),
      );
    }
    group.userData.solids = this.solids;
    return group;
  }
}
