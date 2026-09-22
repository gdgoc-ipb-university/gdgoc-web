import * as THREE from "three";
import { createCampusModel } from "./model";

type Options = {
  animated: boolean;
  onReady: () => void;
  onFailure: () => void;
  onGreet: () => void;
};

export function mountCampus(host: HTMLDivElement, options: Options) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "low-power",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor("#faf9f2");
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 150);
  let model: ReturnType<typeof createCampusModel>;
  try {
    model = createCampusModel();
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  scene.add(model.root);
  // A real shadow pass gives flat cel-colored faces depth without PBR gradients.
  const sunlight = new THREE.DirectionalLight(0xffffff, 1);
  sunlight.position.set(-25, 40, 25);
  sunlight.target.position.set(0, 0, -5);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, {
    left: -38,
    right: 38,
    top: 38,
    bottom: -38,
    near: 1,
    far: 120,
  });
  sunlight.shadow.bias = -0.0003;
  sunlight.shadow.normalBias = 0.035;
  scene.add(sunlight, sunlight.target);
  const courtyardShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.ShadowMaterial({ color: "#354653", opacity: 0.22 }),
  );
  courtyardShadow.rotation.x = -Math.PI / 2;
  courtyardShadow.position.y = 0.041;
  courtyardShadow.receiveShadow = true;
  scene.add(courtyardShadow);
  model.root.children[0].children[0].castShadow = true;
  model.dino.children[0].castShadow = true;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.scene = "geometric-campus";
  canvas.dataset.solids = String(model.solids);
  host.append(canvas);
  const raycaster = new THREE.Raycaster();
  const vector = new THREE.Vector2();
  const target = new THREE.Vector2();
  const current = new THREE.Vector2();
  const cloudOrigins = model.clouds.map((c) => c.position.x);
  let disposed = false,
    lost = false,
    visible = false,
    animated = options.animated;
  let raf = 0,
    last = 0,
    elapsed = 0,
    jump = -1,
    frames = 0,
    ready = false;
  let mobile = false;

  function paint(now: number) {
    raf = 0;
    if (disposed || lost || !visible || document.hidden) return;
    if (animated && last && now - last < 1000 / 30 - 1) {
      raf = requestAnimationFrame(paint);
      return;
    }
    const dt = last ? Math.min((now - last) / 1000, 0.08) : 0;
    last = now;
    if (animated) {
      elapsed += dt;
      current.lerp(target, 0.09);
      if (jump >= 0) {
        jump += dt;
        if (jump > 0.72) jump = -1;
      }
      model.dino.position.y =
        0.07 +
        (jump >= 0 ? Math.sin((jump / 0.72) * Math.PI) * 1.2 : Math.sin(elapsed * 1.7) * 0.023);
      model.dino.rotation.z =
        jump >= 0 ? Math.sin((jump / 0.72) * Math.PI) * -0.065 : Math.sin(elapsed * 1.7) * 0.009;
      model.clouds.forEach((c, i) => {
        c.position.x = cloudOrigins[i] + Math.sin(elapsed * 0.13 + i) * 0.32;
      });
    } else {
      current.set(0, 0);
      model.dino.position.y = 0.07;
      model.dino.rotation.z = 0;
    }
    camera.position.set(current.x * 0.55, 9.2 + current.y * 0.18, 34);
    camera.lookAt(current.x * 0.13, mobile ? 5.7 : 8.0, -7);
    try {
      renderer.render(scene, camera);
    } catch {
      options.onFailure();
      return;
    }
    frames++;
    canvas.dataset.frame = String(frames);
    canvas.dataset.motion = animated ? "playing" : "paused";
    canvas.dataset.drawCalls = String(renderer.info.render.calls);
    canvas.dataset.triangles = String(renderer.info.render.triangles);
    if (!ready) {
      ready = true;
      options.onReady();
    }
    if (animated) raf = requestAnimationFrame(paint);
  }
  function invalidate() {
    if (!raf && !disposed && !lost && visible && !document.hidden)
      raf = requestAnimationFrame(paint);
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height || disposed) return;
    mobile = width < 760;
    // Preserve the whole horizontal composition on phones, rather than cropping AHN.
    camera.aspect = width / height;
    camera.fov = THREE.MathUtils.radToDeg(
      2 * Math.atan((Math.tan(THREE.MathUtils.degToRad(38) / 2) * (16 / 9)) / camera.aspect),
    );
    camera.updateProjectionMatrix();
    const budget = mobile ? 900_000 : 1_800_000;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 1.6, Math.sqrt(budget / (width * height))),
    );
    renderer.setSize(width, height, false);
    invalidate();
  }
  function move(event: PointerEvent) {
    if (!animated || event.pointerType === "touch") return;
    const rect = host.getBoundingClientRect();
    target.set(
      (event.clientX - rect.left) / rect.width - 0.5,
      (event.clientY - rect.top) / rect.height - 0.5,
    );
    vector.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(vector, camera);
    host.style.cursor = raycaster.intersectObjects(model.dino.children).length
      ? "pointer"
      : "default";
    invalidate();
  }
  function greet() {
    if (animated && jump < 0) jump = 0;
    options.onGreet();
    invalidate();
  }
  function click(event: PointerEvent) {
    const rect = host.getBoundingClientRect();
    vector.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(vector, camera);
    if (raycaster.intersectObjects(model.dino.children).length) greet();
  }
  function reset() {
    target.set(0, 0);
    invalidate();
  }
  function visibility() {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    invalidate();
  }
  function contextLost(event: Event) {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(raf);
    raf = 0;
    ready = false;
    options.onFailure();
  }
  function restored() {
    lost = false;
    resize();
    invalidate();
  }
  const intersection = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      visibility();
    },
    { threshold: 0.01 },
  );
  intersection.observe(host);
  const size = new ResizeObserver(resize);
  size.observe(host);
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerleave", reset);
  host.addEventListener("pointerup", click);
  document.addEventListener("visibilitychange", visibility);
  canvas.addEventListener("webglcontextlost", contextLost);
  canvas.addEventListener("webglcontextrestored", restored);
  resize();
  return {
    greet,
    setAnimated(value: boolean) {
      animated = value;
      last = 0;
      jump = -1;
      cancelAnimationFrame(raf);
      raf = 0;
      invalidate();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      intersection.disconnect();
      size.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", reset);
      host.removeEventListener("pointerup", click);
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", restored);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      canvas.remove();
      sunlight.shadow.map?.dispose();
    },
  };
}
