import * as THREE from "three";
import { dinoEyeOpenness } from "./dino-animation";

/** The smaller community diorama shares the campus Dino's blink rhythm. */
export function mountDino(host: HTMLDivElement, animated: boolean) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 3.3, -3.3, 0.1, 50);
  camera.position.set(6, 4.4, 9);
  camera.lookAt(0, 1.4, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 3.2);
  sun.position.set(-4, 7, 6);
  scene.add(sun);

  const ramp = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  const materials = new Map<string, THREE.MeshToonMaterial>();
  const ink = new THREE.LineBasicMaterial({ color: "#172d43" });
  const world = new THREE.Group();
  scene.add(world);

  function material(color: string) {
    if (!materials.has(color))
      materials.set(color, new THREE.MeshToonMaterial({ color, gradientMap: ramp }));
    return materials.get(color)!;
  }
  function outlined(geometry: THREE.BufferGeometry, color: string, parent = world) {
    const mesh = new THREE.Mesh(geometry, material(color));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 28), ink);
    mesh.add(edges);
    parent.add(mesh);
    return mesh;
  }
  function box(
    size: [number, number, number],
    position: [number, number, number],
    color: string,
    parent = world,
  ) {
    const mesh = outlined(new THREE.BoxGeometry(...size), color, parent);
    mesh.position.set(...position);
    return mesh;
  }

  box([5.4, 0.22, 3.6], [0, -0.17, 0], "#e9b743");
  box([5.4, 0.1, 3.6], [0, -0.01, 0], "#fff0b8");
  box([0.85, 0.55, 0.8], [-1.9, 0.31, -0.9], "#4285f4");
  box([0.6, 0.35, 0.65], [1.95, 0.2, 0.85], "#ea4335");
  box([0.55, 0.55, 0.55], [1.6, 0.31, -0.85], "#34a853");
  box([0.2, 0.65, 0.2], [-2.1, 0.4, 1.05], "#226e42");
  box([0.7, 0.2, 0.22], [-2.1, 0.6, 1.05], "#34a853");
  box([0.2, 0.3, 0.22], [-2.35, 0.77, 1.05], "#34a853");
  box([0.2, 0.42, 0.22], [-1.84, 0.85, 1.05], "#34a853");

  const dino = new THREE.Group();
  world.add(dino);
  const pixels = [
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
    pixels.map(([x, y]) => new THREE.Vector2((x - 14) * 0.105, (30 - y) * 0.105)),
  );
  shape.closePath();
  const silhouette = new THREE.ExtrudeGeometry(shape, {
    depth: 0.45,
    bevelEnabled: false,
    steps: 1,
  });
  silhouette.translate(0, 0, -0.225);
  outlined(silhouette, "#fffcdf", dino);
  const eyes = [
    box([0.15, 0.15, 0.014], [0.34, 2.75, 0.236], "#172d43", dino),
    box([0.15, 0.15, 0.014], [0.34, 2.75, -0.236], "#172d43", dino),
  ];
  dino.position.y = 0.07;

  let raf = 0;
  let disposed = false;
  let visible = false;
  let contextLost = false;
  let elapsed = 0;
  let previous = 0;
  let jumpTime = -1;
  let pointerX = 0;
  let pointerY = 0;

  function render() {
    if (disposed || contextLost) return;
    const eyeOpenness = animated ? dinoEyeOpenness(elapsed) : 1;
    eyes.forEach((eye) => { eye.scale.y = eyeOpenness; });
    renderer.domElement.dataset.dinoEyes = eyeOpenness < 0.15 ? "closed" : "open";
    renderer.render(scene, camera);
    host.dataset.ready = "true";
  }
  function tick(now: number) {
    raf = 0;
    if (disposed || contextLost || !visible || document.hidden || !animated) return;
    const delta = previous ? Math.min((now - previous) / 1000, 0.04) : 0;
    previous = now;
    elapsed += delta;
    world.rotation.y += (pointerX * 0.18 - world.rotation.y) * 0.06;
    world.rotation.x += (pointerY * 0.05 - world.rotation.x) * 0.06;
    let jump = 0;
    if (jumpTime >= 0) {
      jumpTime += delta;
      if (jumpTime < 0.65) jump = Math.sin((jumpTime / 0.65) * Math.PI) * 0.85;
      else jumpTime = -1;
    }
    dino.position.y = 0.07 + jump + Math.sin(elapsed * 1.8) * 0.025;
    dino.rotation.z = Math.sin(elapsed * 1.8) * 0.012;
    render();
    raf = requestAnimationFrame(tick);
  }
  function syncLoop() {
    cancelAnimationFrame(raf);
    raf = 0;
    previous = 0;
    if (visible && !document.hidden && animated && !contextLost) raf = requestAnimationFrame(tick);
    else if (visible && !document.hidden) render();
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const ratio = width / height;
    camera.left = -3.3 * ratio;
    camera.right = 3.3 * ratio;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (visible) render();
  }
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      syncLoop();
    },
    { threshold: 0.01 },
  );
  observer.observe(host);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  function pointer(event: PointerEvent) {
    if (!animated || event.pointerType === "touch") return;
    const rect = host.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  }
  function leave() {
    pointerX = 0;
    pointerY = 0;
  }
  function lose(event: Event) {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(raf);
    host.dataset.ready = "false";
  }
  function restore() {
    contextLost = false;
    resize();
    syncLoop();
  }
  host.addEventListener("pointermove", pointer);
  host.addEventListener("pointerleave", leave);
  renderer.domElement.addEventListener("webglcontextlost", lose);
  renderer.domElement.addEventListener("webglcontextrestored", restore);
  document.addEventListener("visibilitychange", syncLoop);
  resize();

  return {
    jump() {
      if (animated && jumpTime < 0) jumpTime = 0;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      resizeObserver.disconnect();
      host.removeEventListener("pointermove", pointer);
      host.removeEventListener("pointerleave", leave);
      renderer.domElement.removeEventListener("webglcontextlost", lose);
      renderer.domElement.removeEventListener("webglcontextrestored", restore);
      document.removeEventListener("visibilitychange", syncLoop);
      const geometries = new Set<THREE.BufferGeometry>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments)
          geometries.add(object.geometry);
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      ink.dispose();
      ramp.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      delete host.dataset.ready;
    },
  };
}
