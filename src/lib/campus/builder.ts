import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

type V3 = [number, number, number];
const cube = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const cubeEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
const lightDirection = new THREE.Vector3(-0.55, 0.85, 0.65).normalize();

/** Merge geometry into two draw calls, with authored three-tone cel faces. */
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
    const normal = data.getAttribute("normal");
    const vertex = new THREE.Vector3();
    const n = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(matrix);
      this.positions.push(vertex.x, vertex.y, vertex.z);
      n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
      const light = n.dot(lightDirection);
      const value = light > 0.55 ? 1 : light > -0.15 ? 0.72 : 0.46;
      this.shade.set(color).multiplyScalar(value);
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
  pyramid(x: number, y: number, z: number, w: number, d: number, h: number) {
    const a: V3 = [x - w / 2, y, z + d / 2],
      b: V3 = [x + w / 2, y, z + d / 2],
      c: V3 = [x + w / 2, y, z - d / 2],
      e: V3 = [x - w / 2, y, z - d / 2],
      top: V3 = [x, y + h, z];
    this.face([a, b, top], "#b35e43");
    this.face([b, c, top], "#7c4038");
    this.face([c, e, top], "#8d493c");
    this.face([e, a, top], "#c57652");
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
        i % 3 === 0 ? "#c77352" : "#9f4f3c",
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
    surface.computeBoundingSphere();
    const mesh = new THREE.Mesh(
      surface,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    );
    group.add(mesh);
    const edges = new LineSegmentsGeometry();
    edges.setPositions(this.lines);
    group.add(
      new LineSegments2(
        edges,
        new LineMaterial({ color: "#172d43", linewidth: 0.85, transparent: true, opacity: 0.5 }),
      ),
    );
    group.userData.solids = this.solids;
    return group;
  }
}
