// The 3D stage: one transparent canvas, one trainer (our own model, see
// tools/ and the README), driven
// entirely by a scroll progress value so `?p=` can pin any frame.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { COLOURWAYS, STUDIO, type Colourway } from "./brand";

export { COLOURWAYS };
export type { Colourway };

const LOOKS = [...COLOURWAYS, STUDIO];
const lookAt = (p: number) => (p > T.wipe[0] + 0.03 && p < T.cw[0] - 0.012 ? LOOKS.length - 1 : colourwayAt(p));

// ── Timeline (scroll progress 0..1) ─────────────────────────────────────────
export const T = {
  hero: [0.0, 0.16],
  wipe: [0.14, 0.21],
  anatomy: [0.21, 0.42],
  explode: [0.235, 0.29, 0.365, 0.405],
  run: [0.42, 0.615],
  cw: [0.63, 0.8],
  join: [0.805, 0.92],
  finale: [0.915, 1.0],
} as const;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const seg = (a: number, b: number, p: number) => clamp01((p - a) / (b - a));
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const pulse = (a: number, b: number, c: number, d: number, p: number) =>
  Math.min(smooth(seg(a, b, p)), 1 - smooth(seg(c, d, p)));

export const cwEdges = () => {
  const [a, b] = T.cw;
  const w = (b - a) / COLOURWAYS.length;
  return COLOURWAYS.map((_, i) => a + w * i);
};
export const colourwayAt = (p: number) => {
  if (p < T.cw[0] || p >= T.finale[0] + 0.012) return 0;
  if (p >= T.cw[1]) return COLOURWAYS.length - 1;
  return Math.min(COLOURWAYS.length - 1, Math.floor(seg(T.cw[0], T.cw[1], p) * COLOURWAYS.length));
};

interface Key { at: number; x: number; y: number; s: number; yaw: number; pitch: number; roll: number }

const keysFor = (narrow: boolean): Key[] =>
  narrow
    ? [
        { at: 0.0, x: 0, y: -0.2, s: 1.0, yaw: -0.55, pitch: 0.2, roll: -0.12 },
        { at: 0.13, x: 0, y: 0.0, s: 1.12, yaw: -1.0, pitch: 0.12, roll: -0.24 },
        { at: 0.225, x: 0, y: 0.2, s: 0.78, yaw: -6.75, pitch: 0.24, roll: 0 },
        { at: 0.4, x: 0, y: 0.2, s: 0.78, yaw: -7.3, pitch: 0.3, roll: 0 },
        { at: 0.455, x: 0, y: 0.02, s: 0.9, yaw: -12.57, pitch: 0.05, roll: -0.08 },
        { at: 0.6, x: 0, y: 0.02, s: 0.9, yaw: -12.45, pitch: 0.05, roll: -0.08 },
        { at: 0.645, x: 0, y: 0.04, s: 0.98, yaw: -13.2, pitch: 0.16, roll: -0.08 },
        { at: 0.8, x: 0, y: 0.04, s: 0.98, yaw: -13.2, pitch: 0.16, roll: -0.08 },
        { at: 0.85, x: 0.3, y: 0.66, s: 0.46, yaw: -13.12, pitch: 0.3, roll: 0.22 },
        { at: 0.91, x: 0.34, y: 0.62, s: 0.46, yaw: -13.6, pitch: 0.2, roll: -0.2 },
        { at: 0.965, x: 0, y: 0.02, s: 1.02, yaw: -19.4, pitch: 0.2, roll: -0.12 },
        { at: 1.0, x: 0, y: 0.02, s: 1.02, yaw: -19.55, pitch: 0.2, roll: -0.12 },
      ]
    : [
        { at: 0.0, x: 0.36, y: -0.06, s: 1.42, yaw: -0.55, pitch: 0.16, roll: -0.1 },
        { at: 0.13, x: 0.1, y: 0, s: 1.5, yaw: -1.0, pitch: 0.1, roll: -0.22 },
        { at: 0.225, x: 0.34, y: 0.0, s: 1.0, yaw: -6.75, pitch: 0.22, roll: 0 },
        { at: 0.4, x: 0.34, y: 0.0, s: 1.0, yaw: -7.3, pitch: 0.3, roll: 0 },
        { at: 0.455, x: -0.04, y: -0.06, s: 1.08, yaw: -12.57, pitch: 0.04, roll: -0.08 },
        { at: 0.6, x: -0.04, y: -0.06, s: 1.08, yaw: -12.45, pitch: 0.04, roll: -0.08 },
        { at: 0.645, x: 0, y: -0.02, s: 1.22, yaw: -13.2, pitch: 0.14, roll: -0.08 },
        { at: 0.8, x: 0, y: -0.02, s: 1.22, yaw: -13.2, pitch: 0.14, roll: -0.08 },
        { at: 0.85, x: 0.62, y: 0.5, s: 0.56, yaw: -13.12, pitch: 0.3, roll: 0.22 },
        { at: 0.91, x: 0.66, y: 0.44, s: 0.56, yaw: -13.6, pitch: 0.2, roll: -0.2 },
        { at: 0.965, x: 0.02, y: 0.06, s: 1.3, yaw: -19.4, pitch: 0.16, roll: -0.1 },
        { at: 1.0, x: 0.02, y: 0.06, s: 1.3, yaw: -19.55, pitch: 0.16, roll: -0.1 },
      ];

const sample = (keys: Key[], p: number): Key => {
  if (p <= keys[0].at) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (p <= b.at) {
      const t = smooth((p - a.at) / (b.at - a.at));
      const L = (k: keyof Key) => a[k] + (b[k] - a[k]) * t;
      return { at: p, x: L("x"), y: L("y"), s: L("s"), yaw: L("yaw"), pitch: L("pitch"), roll: L("roll") };
    }
  }
  return keys[keys.length - 1];
};

// Explode directions in model space (cm; x = toe, y = up).
const EXPLODE: Record<string, [number, number, number]> = {
  laces: [1.5, 12.5, 0],
  tongue: [-2.5, 9.5, 0],
  upper: [0, 5.2, 0],
  clip: [-7.5, 2.4, 0],
  midsole: [0, -1.2, 0],
  plate: [0, -1.2, 0],
  outsole: [0, -6.4, 0],
};
const PLATE_SPLIT = 3.2;

/** Height canvas → tangent-space normal map (Sobel), tiled. */
const normalFromHeight = (c: HTMLCanvasElement, strength: number) => {
  const w = c.width, h = c.height;
  const src = c.getContext("2d")!.getImageData(0, 0, w, h).data;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const g = out.getContext("2d")!;
  const img = g.createImageData(w, h);
  const H = (x: number, y: number) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = (-dx / l) * 127.5 + 127.5;
      img.data[i + 1] = (dy / l) * 127.5 + 127.5;
      img.data[i + 2] = (1 / l) * 127.5 + 127.5;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

/** Knit: rows of interlocked V stitches. */
const knitTexture = () => {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#2a2a2a";
  g.fillRect(0, 0, 256, 256);
  g.lineCap = "round";
  const cell = 32, rowH = 16;
  for (let pass = 0; pass < 2; pass++)
    for (let y = -1; y < 256 / rowH + 1; y++)
      for (let x = -1; x < 256 / cell + 1; x++) {
        const ox = x * cell, oy = y * rowH;
        g.strokeStyle = pass ? "#f4f4f4" : "#8a8a8a";
        g.lineWidth = pass ? 5 : 10;
        g.beginPath();
        g.moveTo(ox + 3, oy);
        g.lineTo(ox + cell / 2 - 1, oy + rowH + 5);
        g.moveTo(ox + cell - 3, oy);
        g.lineTo(ox + cell / 2 + 1, oy + rowH + 5);
        g.stroke();
      }
  const t = normalFromHeight(c, 3.2);
  t.repeat.set(16, 16);
  return t;
};

/** Fine grain for foam and rubber. */
const grainTexture = () => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const img = g.createImageData(128, 128);
  let s = 3;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 128 * 128; i++) {
    const v = 90 + rnd() * 120;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = normalFromHeight(c, 1.1);
  t.repeat.set(9, 9);
  return t;
};

/** A photo-studio surround for reflections: dark room, three soft boxes. */
const studioEnvironment = () => {
  const sc = new THREE.Scene();
  sc.add(new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: 0x2b2b2e, side: THREE.BackSide })));
  const box = (w: number, h: number, pos: [number, number, number], power: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(power, power, power), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    sc.add(m);
  };
  box(16, 10, [0, 14, 4], 9);
  box(6, 14, [-15, 2, 6], 5);
  box(5, 12, [15, 3, -4], 6);
  box(10, 3, [0, -1, 16], 2.5);
  return sc;
};

const speckleTexture = () => {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 256, 256);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 520; i++) {
    g.fillStyle = `rgba(20,20,24,${0.25 + rnd() * 0.5})`;
    g.beginPath();
    g.arc(rnd() * 256, rnd() * 256, 0.5 + rnd() * 1.3, 0, 7);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.6, 1.2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const blobTexture = () => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const rg = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  rg.addColorStop(0, "rgba(0,0,0,0.5)");
  rg.addColorStop(0.6, "rgba(0,0,0,0.16)");
  rg.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
};

export interface StageFrame {
  p: number;
  time: number;
  dt: number;
  mx: number;
  my: number;
  speed: number;
  still: boolean;
}

export interface Stage {
  ready: Promise<void>;
  frame(f: StageFrame): void;
  resize(): void;
  /** Screen position of a part's centre (px), for callouts. */
  anchor(part: string, out: { x: number; y: number }): boolean;
  /** Screen-space left/right edge of the (exploded) trainer, px. */
  bounds(out: { min: number; max: number }): void;
  dispose(): void;
}

export function createStage(canvas: HTMLCanvasElement, glbUrl: string): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(studioEnvironment(), 0.03).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  camera.position.set(0, 0, 10);

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(4, 6, 6);
  const rim = new THREE.DirectionalLight(0xffffff, 1.9);
  rim.position.set(-6, 3, -5);
  scene.add(key, rim);

  // Shoe rig: rig (screen position/scale) → spin (rotation) → model (cm → units)
  const rig = new THREE.Group();
  const spin = new THREE.Group();
  const model = new THREE.Group();
  model.scale.setScalar(0.1);
  model.position.set(0, -0.42, 0);
  spin.add(model);
  rig.add(spin);
  scene.add(rig);

  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 1.9),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0 }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -0.62;
  blob.renderOrder = -1;
  rig.add(blob);

  // Speed field: streaks at many depths (parallax), dashes on the floor.
  const STREAKS = 150;
  const streakGeo = new THREE.BoxGeometry(1, 0.012, 0.012);
  const streakMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  const streaks = new THREE.InstancedMesh(streakGeo, streakMat, STREAKS);
  streaks.frustumCulled = false;
  streaks.renderOrder = -2;
  const sData: { x: number; y: number; z: number; len: number; v: number }[] = [];
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const volt = new THREE.Color("#d6ff1f"), white = new THREE.Color("#ffffff"), hot = new THREE.Color("#ff4a1c");
  for (let i = 0; i < STREAKS; i++) {
    const z = -14 + rnd() * 17;
    const floor = i % 3 === 0;
    sData.push({
      x: (rnd() - 0.5) * 60,
      y: floor ? -0.72 - rnd() * 0.02 : (rnd() - 0.5) * 9,
      z,
      len: floor ? 1.6 + rnd() * 1.4 : 1.5 + rnd() * 7,
      v: 0.7 + rnd() * 0.8,
    });
    streaks.setColorAt(i, floor ? white : rnd() < 0.22 ? volt : rnd() < 0.12 ? hot : white);
  }
  scene.add(streaks);
  const dummy = new THREE.Object3D();

  const parts = new Map<string, THREE.Object3D>();
  const centres = new Map<string, THREE.Vector3>();
  const mats = new Map<string, THREE.MeshPhysicalMaterial>();
  const targets = new Map<string, THREE.Color>();
  let plateMeshes: THREE.Object3D[] = [];
  let loaded = false;
  let loadedAt = 0;
  let disposed = false;
  let narrow = false;
  let fit = 1;
  let halfW = 1, halfH = 1;
  let cw = -1;
  const knit = knitTexture();
  const speckle = speckleTexture();

  const grain = grainTexture();
  const ns = (v: number) => new THREE.Vector2(v, v);
  const grade: Record<string, THREE.MeshPhysicalMaterialParameters> = {
    upperMat: { roughness: 0.95, normalMap: knit, normalScale: ns(1.8), sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color("#ffffff") },
    railMat: { roughness: 0.5, normalMap: grain, normalScale: ns(0.12) },
    eyestayMat: { roughness: 0.48, normalMap: grain, normalScale: ns(0.1) },
    stitchMat: { roughness: 0.9 },
    eyeletMat: { roughness: 0.25, metalness: 0.6, envMapIntensity: 1.3 },
    liningMat: { roughness: 1, sheen: 0.6, sheenRoughness: 0.8 },
    tongueMat: { roughness: 0.92, normalMap: knit, normalScale: ns(0.5), sheen: 0.8, sheenRoughness: 0.6 },
    laceMat: { roughness: 0.9, sheen: 0.7, sheenRoughness: 0.6 },
    clipMat: { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.18, envMapIntensity: 1.25 },
    midMat: { roughness: 0.72, map: speckle, normalMap: grain, normalScale: ns(0.35) },
    plateMat: { roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.3 },
    outMat: { roughness: 0.78, normalMap: grain, normalScale: ns(0.3) },
  };

  const ready = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(glbUrl).then(async (gltf) => {
    if (disposed) return;
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const list = Array.isArray(m.material) ? m.material : [m.material];
      const next = list.map((src) => {
        const name = (src as THREE.Material).name;
        let mat = mats.get(name);
        if (!mat) {
          // A scanned body brings its own detail texture: keep it (it is a neutral
          // greyscale, so the colourway tints it) and skip the tiled maps, whose
          // scale assumes our own UVs.
          const tex = (src as THREE.MeshStandardMaterial).map ?? null;
          const { map: _m, normalMap: _n, normalScale: _s, ...plain } = grade[name] ?? {};
          mat = new THREE.MeshPhysicalMaterial({
            color: "#ffffff",
            vertexColors: !!m.geometry.getAttribute("color"),
            ...(tex ? { ...plain, sheen: (plain.sheen ?? 0) * 0.15, map: tex, side: THREE.DoubleSide } : grade[name] ?? {}),
          });
          mat.name = name;
          mats.set(name, mat);
          targets.set(name, new THREE.Color("#ffffff"));
        }
        return mat;
      });
      m.material = Array.isArray(m.material) ? next : next[0];
    });
    // Top-level nodes are the parts; a multi-material part arrives as a group.
    // Compressed meshes carry their de-quantisation transform on the node, so
    // each part gets a clean wrapper group for the page to move.
    for (const child of [...gltf.scene.children]) {
      const wrap = new THREE.Group();
      wrap.name = child.name;
      gltf.scene.add(wrap);
      wrap.add(child);
      parts.set(wrap.name, wrap);
      const box = new THREE.Box3().setFromObject(wrap);
      centres.set(wrap.name, box.getCenter(new THREE.Vector3()));
    }
    model.add(gltf.scene);
    const plate = parts.get("plate");
    plateMeshes = plate ? [plate] : [];
    cw = -1;
    applyColourway(0, true);
    await renderer.compileAsync(scene, camera);
    loaded = true;
    loadedAt = -1;
  });

  function applyColourway(i: number, instant = false) {
    if (i === cw) return;
    cw = i;
    const look = LOOKS[i].mats;
    const all = { eyestayMat: look.upperMat, stitchMat: look.laceMat, eyeletMat: look.clipMat, ...look };
    for (const [name, hex] of Object.entries(all)) {
      targets.get(name)?.set(hex);
      if (instant) mats.get(name)?.color.set(hex);
    }
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const budget = Math.sqrt(3.2e6 / (w * h));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2, budget));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    narrow = w / h < 0.9;
    halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    halfW = halfH * camera.aspect;
    fit = Math.min(1, (halfW * 2 * 0.86) / 3.3);
  }
  resize();

  const v3 = new THREE.Vector3();
  let yawLag = 0, pitchLag = 0;

  function frame(f: StageFrame) {
    if (disposed) return;
    if (loaded && loadedAt < 0) loadedAt = f.time;
    const { p } = f;
    const k = sample(keysFor(narrow), p);
    const edges = cwEdges();
    let cwSpin = 0;
    for (let i = 1; i < edges.length; i++) cwSpin -= Math.PI * 2 * smooth(seg(edges[i] - 0.016, edges[i] + 0.018, p));

    const runAmt = pulse(T.run[0], T.run[0] + 0.04, T.run[1] - 0.03, T.run[1], p);
    const intro = f.still ? 1 : smooth(clamp01((f.time - loadedAt) / 1.1));
    const stride = f.still ? 0.35 : f.time * 7.2;
    const float = f.still ? 0 : Math.sin(f.time * 1.1) * 0.035 * (1 - runAmt);

    yawLag += (f.mx * 0.22 - yawLag) * Math.min(1, f.dt * 5);
    pitchLag += (f.my * 0.12 - pitchLag) * Math.min(1, f.dt * 5);

    rig.position.set(k.x * halfW + (f.still ? 0 : f.mx * 0.08), k.y * halfH + float + Math.abs(Math.sin(stride)) * 0.1 * runAmt, 0);
    rig.scale.setScalar(k.s * fit * (0.55 + 0.45 * intro));
    spin.rotation.set(
      k.pitch + pitchLag,
      k.yaw + cwSpin + yawLag + (1 - intro) * -2.4,
      k.roll + Math.sin(stride) * 0.2 * runAmt,
      "YXZ",
    );

    // explode
    const e = pulse(T.explode[0], T.explode[1], T.explode[2], T.explode[3], p);
    for (const [name, dir] of Object.entries(EXPLODE)) {
      const part = parts.get(name);
      if (part) part.position.set(dir[0] * e, dir[1] * e, dir[2] * e);
    }
    for (const pm of plateMeshes) pm.scale.z = 1 + (PLATE_SPLIT / 4.5) * e;

    // colourway colours ease toward their targets
    applyColourway(lookAt(p), f.still);
    const a = Math.min(1, f.dt * 7);
    for (const [name, mat] of mats) mat.color.lerp(targets.get(name)!, a);

    // contact shadow where the shoe "stands"
    const grounded = Math.max(1 - smooth(seg(0.04, 0.14, p)), smooth(seg(0.955, 0.985, p)));
    (blob.material as THREE.MeshBasicMaterial).opacity = 0.75 * grounded * intro;

    // speed field
    streakMat.opacity = 0.85 * runAmt;
    streaks.visible = runAmt > 0.002;
    if (streaks.visible) {
      const flow = f.still ? p * 420 : f.time * 16 + p * 420;
      for (let i = 0; i < STREAKS; i++) {
        const s = sData[i];
        const depth = 1 / (1 + Math.max(0, -s.z) * 0.12);
        let x = (s.x - flow * s.v * depth) % 60;
        if (x < -30) x += 60;
        dummy.position.set(x, s.y, s.z);
        dummy.scale.set(s.len * (0.5 + runAmt + Math.min(2, Math.abs(f.speed) * 30)), 1 + depth * 2, 1);
        dummy.updateMatrix();
        streaks.setMatrixAt(i, dummy.matrix);
      }
      streaks.instanceMatrix.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  function anchor(part: string, out: { x: number; y: number }) {
    const obj = parts.get(part);
    const c = centres.get(part);
    if (!obj || !c) return false;
    v3.copy(c).add(obj.position);
    model.localToWorld(v3);
    v3.project(camera);
    out.x = (v3.x * 0.5 + 0.5) * (canvas.clientWidth || window.innerWidth);
    out.y = (-v3.y * 0.5 + 0.5) * (canvas.clientHeight || window.innerHeight);
    return true;
  }

  const EDGE: [number, number, number][] = [[-23, 9, 0], [-15, 0, 0], [17, 14, 0], [15, 0, 0], [-23, 9, 5], [17, 14, -5]];
  function bounds(out: { min: number; max: number }) {
    const w = canvas.clientWidth || window.innerWidth;
    out.min = Infinity;
    out.max = -Infinity;
    for (const e of EDGE) {
      v3.set(e[0], e[1], e[2]);
      model.localToWorld(v3);
      v3.project(camera);
      const x = (v3.x * 0.5 + 0.5) * w;
      out.min = Math.min(out.min, x);
      out.max = Math.max(out.max, x);
    }
  }

  function dispose() {
    disposed = true;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    for (const m of mats.values()) m.dispose();
    knit.dispose();
    grain.dispose();
    speckle.dispose();
    env.dispose();
    pmrem.dispose();
    renderer.dispose();
  }

  return { ready, frame, resize, anchor, bounds, dispose };
}
