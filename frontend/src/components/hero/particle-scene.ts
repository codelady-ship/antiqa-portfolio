/**
 * Confetti halo around the hero photo (Three.js, loaded lazily, wide screens only).
 * #32 simplified the old scroll-morphing orb / "AC" monogram / galaxy: a few hundred soft
 * triangles and dots in the site's pastel palette drift on a tilted ring around the photo,
 * slowly turn, and step aside from the cursor.
 *
 * `createScene` is async and yields to the main thread between the expensive steps
 * (WebGL context, shader compile), so booting is several short tasks, not one long one.
 */
import { BufferAttribute, BufferGeometry, Clock, Color, PerspectiveCamera, Points, Scene, ShaderMaterial, Vector2, WebGLRenderer } from "three";

/** Give the browser a turn (input, paint) between boot steps. */
function yieldToMain() {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s?.yield) return s.yield();
  return new Promise<void>((r) => setTimeout(r, 0));
}

/** Thrown (and swallowed by the caller) when the hero unmounts while the scene is still booting. */
export class Cancelled extends Error {}

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aRot;
  attribute float aCol;
  attribute float aShape;
  uniform float uTime;
  uniform float uPixel;
  uniform vec2 uMouse;
  uniform vec3 uPal[5];
  varying vec3 vCol;
  varying float vRot;
  varying float vShape;
  void main() {
    vec3 p = position;
    p += 0.06 * vec3(sin(uTime * 0.6 + aRot * 6.0), cos(uTime * 0.5 + aRot * 4.0), sin(uTime * 0.4 + aRot * 5.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // step aside from the cursor
    vec2 d = mv.xy - uMouse * 3.0;
    mv.xy += normalize(d + 1e-4) * exp(-dot(d, d) * 1.4) * 0.45;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixel * (7.0 / -mv.z);
    int i = int(aCol + 0.5);
    vCol = i == 0 ? uPal[0] : i == 1 ? uPal[1] : i == 2 ? uPal[2] : i == 3 ? uPal[3] : uPal[4];
    vRot = aRot * 6.2831 + uTime * 0.35 * (aRot - 0.5);
    vShape = aShape;
  }
`;

const FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vCol;
  varying float vRot;
  varying float vShape;
  float tri(vec2 p) {
    const float k = 1.7320508;
    p.x = abs(p.x) - 1.0;
    p.y = p.y + 1.0 / k;
    if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    p.x -= clamp(p.x, -2.0, 0.0);
    return -length(p) * sign(p.y);
  }
  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float c = cos(vRot), s = sin(vRot);
    uv = mat2(c, -s, s, c) * uv;
    // rounded triangle or dot, filled
    float d = vShape < 0.5 ? tri(uv * 1.5) - 0.08 : length(uv) - 0.55;
    float a = 1.0 - smoothstep(-0.04, 0.04, d);
    if (a < 0.02) discard;
    gl_FragColor = vec4(vCol, a * uOpacity);
  }
`;

const PALETTE = {
  // pink, coral, lilac, mint, peach (fills, decorative only)
  light: ["#f48fb1", "#ff9e80", "#b39ddb", "#7fd1b0", "#ffc49b"],
  dark: ["#ff8fb3", "#ffa48f", "#c6a9ff", "#8fe0c0", "#ffc48a"],
};

export async function createScene(canvas: HTMLCanvasElement, isCancelled: () => boolean = () => false) {
  const step = async () => {
    await yieldToMain();
    if (isCancelled()) throw new Cancelled();
  };
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowPower = (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory ?? 8) <= 2;
  const COUNT = lowPower ? 70 : 120;

  const pos = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT);
  const rot = new Float32Array(COUNT);
  const col = new Float32Array(COUNT);
  const shape = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    // a loose, tilted ellipse around the photo; a few strays further out
    const a = Math.random() * Math.PI * 2;
    const stray = Math.random() < 0.15;
    const r = (stray ? 1.25 : 1) * (0.92 + Math.random() * 0.28);
    pos[i * 3] = Math.cos(a) * 2.35 * r;
    pos[i * 3 + 1] = Math.sin(a) * 2.75 * r;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
    size[i] = 2 + Math.pow(Math.random(), 2) * 2.6;
    rot[i] = Math.random();
    col[i] = Math.floor(Math.random() * 5);
    shape[i] = Math.random() < 0.6 ? 0 : 1;
  }

  await step();
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "low-power" });
  const dpr = Math.min(devicePixelRatio, lowPower ? 1.25 : 2);
  renderer.setPixelRatio(dpr);
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 7;

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setAttribute("aSize", new BufferAttribute(size, 1));
  geo.setAttribute("aRot", new BufferAttribute(rot, 1));
  geo.setAttribute("aCol", new BufferAttribute(col, 1));
  geo.setAttribute("aShape", new BufferAttribute(shape, 1));

  const uniforms = {
    uTime: { value: 0 },
    uPixel: { value: dpr * 4 },
    uMouse: { value: new Vector2(9, 9) },
    uOpacity: { value: 0 },
    uPal: { value: PALETTE.light.map((c) => new Color(c)) },
  };
  const mat = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false });
  const points = new Points(geo, mat);
  points.rotation.z = -0.12;
  scene.add(points);

  const dispose = () => {
    geo.dispose();
    mat.dispose();
    renderer.dispose();
  };

  function setTheme(dark: boolean) {
    (dark ? PALETTE.dark : PALETTE.light).forEach((c, i) => uniforms.uPal.value[i].set(c));
  }

  let running = false,
    raf = 0,
    elapsed = 0,
    mx = 0,
    my = 0,
    tmx = 9,
    tmy = 9;
  const clock = new Clock();

  function resize() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  try {
    await renderer.compileAsync(points, camera, scene);
    await step();
  } catch (e) {
    if (e instanceof Cancelled || isCancelled()) {
      dispose();
      throw new Cancelled();
    }
    /* compile failed here → three compiles on the first render instead */
  }

  function draw() {
    uniforms.uTime.value = elapsed;
    points.rotation.y = Math.sin(elapsed * 0.15) * 0.35 + mx * 0.25;
    points.rotation.x = my * 0.15;
    renderer.render(scene, camera);
  }

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    elapsed += Math.min(clock.getDelta(), 0.05); // own time: no jump after a pause
    mx += ((tmx > 5 ? 0 : tmx) - mx) * 0.05;
    my += ((tmy > 5 ? 0 : tmy) - my) * 0.05;
    uniforms.uOpacity.value = Math.min(1, elapsed / 1.2);
    uniforms.uMouse.value.set(tmx * 1.2, tmy * 0.8);
    draw();
  }

  return {
    start() {
      if (running) return;
      running = true;
      clock.getDelta();
      frame();
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    /** reduced motion: one still frame */
    renderStatic() {
      uniforms.uOpacity.value = 1;
      draw();
    },
    /** pointer in canvas space, -1..1 */
    setPointer(x: number, y: number) {
      tmx = x;
      tmy = y;
    },
    setTheme,
    resize,
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      dispose();
    },
  };
}
