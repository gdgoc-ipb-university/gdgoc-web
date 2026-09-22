import * as THREE from "three";
import { createCampusModel } from "./model";
import { createForeground, createForegroundPass } from "./foreground";

type Options = {
  animated: boolean;
  onReady: () => void;
  onFailure: () => void;
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
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#eef1e9", 65, 205);
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 1, 240);
  let model: ReturnType<typeof createCampusModel>;
  try {
    model = createCampusModel();
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  scene.add(model.root);
  const foreground = createForeground();
  const foregroundPass = createForegroundPass(renderer);
  scene.add(foreground.root);
  // Warm afternoon key from the right, with a cool fill under leaves and eaves.
  const sunlight = new THREE.DirectionalLight("#fff5e5", 2.25);
  sunlight.position.set(40, 50, 0);
  sunlight.target.position.set(-2, 0, -6);
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
  sunlight.shadow.bias = -0.00015;
  sunlight.shadow.normalBias = 0.045;
  const skyFill = new THREE.HemisphereLight("#d2e4ff", "#96aa7d", 1.15);
  sunlight.layers.enable(1);
  skyFill.layers.enable(1);
  scene.add(sunlight, sunlight.target, skyFill);
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.scene = "geometric-campus";
  canvas.dataset.solids = String(model.solids);
  canvas.dataset.ridges = "3";
  canvas.dataset.backdrop = "gunung-salak";
  canvas.dataset.foliage = "exterior-voxel-union";
  canvas.dataset.garden = "mixed-canopies-flowering-tropical-wayfinding";
  canvas.dataset.foreground = "blurred-3d-garden";
  host.append(canvas);
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
    frames = 0,
    ready = false;
  let mobile = false;
  let placeForeground = true;

  function paint(now: number) {
    raf = 0;
    if (disposed || lost || (ready && !visible) || document.hidden) return;
    if (animated && last && now - last < 1000 / 30 - 1) {
      raf = requestAnimationFrame(paint);
      return;
    }
    const dt = last ? Math.min((now - last) / 1000, 0.08) : 0;
    last = now;
    if (animated) {
      elapsed += dt;
      current.lerp(target, 0.09);
      model.dino.position.y = 0.07 + Math.sin(elapsed * 1.7) * 0.023;
      model.dino.rotation.z = Math.sin(elapsed * 1.7) * 0.009;
      model.clouds.forEach((c, i) => {
        c.position.x = cloudOrigins[i] + Math.sin(elapsed * 0.13 + i) * 0.32;
      });
    } else {
      current.set(0, 0);
      model.dino.position.y = 0.07;
      model.dino.rotation.z = 0;
    }
    camera.position.set(8.5 + current.x * 0.28, 8.7 + current.y * 0.09, 35);
    camera.lookAt(-1 + current.x * 0.06, mobile ? 5.6 : 7.8, -8);
    if (placeForeground) {
      foreground.place(camera);
      placeForeground = false;
    }
    try {
      renderer.info.reset();
      renderer.render(scene, camera);
      foregroundPass.render(scene, camera);
    } catch {
      ready = false;
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
    if (animated && visible) raf = requestAnimationFrame(paint);
  }
  function invalidate() {
    if (!raf && !disposed && !lost && (visible || !ready) && !document.hidden)
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
    foregroundPass.resize(width, height, mobile);
    placeForeground = true;
    invalidate();
  }
  function move(event: PointerEvent) {
    if (!animated || event.pointerType === "touch") return;
    const rect = host.getBoundingClientRect();
    target.set(
      (event.clientX - rect.left) / rect.width - 0.5,
      (event.clientY - rect.top) / rect.height - 0.5,
    );
    invalidate();
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
    renderer.shadowMap.needsUpdate = true;
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
  document.addEventListener("visibilitychange", visibility);
  canvas.addEventListener("webglcontextlost", contextLost);
  canvas.addEventListener("webglcontextrestored", restored);
  resize();
  return {
    setAnimated(value: boolean) {
      animated = value;
      last = 0;
      renderer.shadowMap.needsUpdate = true;
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
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", restored);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((m) => {
            if (m instanceof THREE.MeshToonMaterial) m.gradientMap?.dispose();
            m.dispose();
          });
        }
      });
      foregroundPass.dispose();
      renderer.dispose();
      canvas.remove();
      sunlight.shadow.map?.dispose();
    },
  };
}
