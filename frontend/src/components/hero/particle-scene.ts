/**
 * Triangle-particle scene (Three.js, loaded lazily). Three target shapes:
 *  0 = a folded "mind" orb, 1 = the owner's monogram, 2 = a wide scattered galaxy.
 * `setProgress(p)` (0..1, from the hero scroll track) morphs 0 → 1 → 2 on the GPU.
 */
import * as THREE from "three";

const VERT = /* glsl */ `
  attribute vec3 aB;
  attribute vec3 aC;
  attribute float aSize;
  attribute float aRot;
  attribute float aMix;
  uniform float uMorph;
  uniform float uTime;
  uniform float uPixel;
  uniform vec2 uMouse;
  varying float vMix;
  varying float vRot;
  varying float vAlpha;
  void main() {
    float m1 = smoothstep(0.0, 1.0, clamp(uMorph, 0.0, 1.0));
    float m2 = smoothstep(0.0, 1.0, clamp(uMorph - 1.0, 0.0, 1.0));
    vec3 p = mix(mix(position, aB, m1), aC, m2);
    // breathing + slight drift
    p += 0.035 * vec3(sin(uTime * 0.7 + aRot * 6.0), cos(uTime * 0.6 + aRot * 4.0), sin(uTime * 0.5 + aRot * 5.0));
    // soft push away from the cursor
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec2 d = mv.xy - uMouse * 3.0;
    float f = exp(-dot(d, d) * 1.6) * 0.35;
    mv.xy += normalize(d + 1e-4) * f;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixel * (7.0 / -mv.z);
    vMix = aMix;
    vRot = aRot * 6.2831 + uTime * 0.25 * (aMix - 0.5);
    vAlpha = 0.55 + 0.45 * sin(uTime * 1.3 + aRot * 20.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uC1;
  uniform vec3 uC2;
  uniform vec3 uC3;
  uniform float uOpacity;
  varying float vMix;
  varying float vRot;
  varying float vAlpha;
  float tri(vec2 p) {
    // signed distance to an equilateral triangle
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
    float d = tri(uv * 1.35);
    float edge = 1.0 - smoothstep(0.0, 0.12, abs(d + 0.08));   // outline
    float fill = (1.0 - smoothstep(-0.02, 0.02, d)) * 0.18;     // faint fill
    float a = max(edge, fill);
    if (a < 0.02) discard;
    vec3 col = vMix < 0.5 ? mix(uC1, uC2, vMix * 2.0) : mix(uC2, uC3, vMix * 2.0 - 1.0);
    gl_FragColor = vec4(col, a * vAlpha * uOpacity);
  }
`;

/** Points of a word drawn on a 2D canvas, mapped to scene units. */
function sampleText(text: string, count: number, font: string) {
  const W = 512,
    H = 256;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font;
  ctx.fillText(text, W / 2, H / 2 + 8);
  const data = ctx.getImageData(0, 0, W, H).data;
  const pts: number[] = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 128) pts.push(x, y);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const j = Math.floor(Math.random() * (pts.length / 2)) * 2;
    out[i * 3] = ((pts[j] ?? W / 2) / W - 0.5) * 6.4 + (Math.random() - 0.5) * 0.03;
    out[i * 3 + 1] = -((pts[j + 1] ?? H / 2) / H - 0.5) * 3.2 + (Math.random() - 0.5) * 0.03;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
  }
  return out;
}

const PALETTE = {
  dark: ["#a78bfa", "#f0a3c4", "#f6c86b"],
  light: ["#6b3fd4", "#c2457d", "#b8861f"],
};

export function createScene(canvas: HTMLCanvasElement, monogram: string) {
  const small = innerWidth < 768;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  // weak CPU or data saver: fewer particles and a lower pixel ratio
  const lowPower = (nav.hardwareConcurrency || 8) <= 4 || !!nav.connection?.saveData;
  const COUNT = small ? (lowPower ? 1200 : 1800) : lowPower ? 3000 : 6000;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: lowPower ? "low-power" : "high-performance" });
  const dpr = Math.min(devicePixelRatio, small || lowPower ? 1.25 : 2);
  renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 7;

  // shape A: folded orb (two lobes, like a mind)
  const A = new Float32Array(COUNT * 3);
  const C = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT);
  const rot = new Float32Array(COUNT);
  const mixv = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const r0 = Math.sqrt(1 - u * u);
    let x = r0 * Math.cos(th),
      y = u,
      z = r0 * Math.sin(th);
    const folds = 1 + 0.09 * Math.sin(9 * x + 3 * y) * Math.sin(8 * y + 2 * z) + 0.05 * Math.sin(14 * z);
    const lobe = 1 - 0.12 * Math.exp(-x * x * 40); // central fissure
    const R = 1.75 * folds * lobe;
    x *= R * 1.18;
    y *= R * 0.95;
    z *= R;
    A[i * 3] = x;
    A[i * 3 + 1] = y + 0.1;
    A[i * 3 + 2] = z;
    // shape C: spiral galaxy, wide
    const arm = i % 3;
    const t = Math.random();
    const ang = t * 7 + (arm * Math.PI * 2) / 3;
    const rad = 0.4 + t * 5.5;
    C[i * 3] = Math.cos(ang) * rad + (Math.random() - 0.5) * 0.6;
    C[i * 3 + 1] = (Math.random() - 0.5) * 0.5 * (1 - t) + Math.sin(ang) * rad * 0.35;
    C[i * 3 + 2] = Math.sin(ang) * rad * 0.6 - 1.5;
    size[i] = 0.6 + Math.pow(Math.random(), 3) * 2.4;
    rot[i] = Math.random();
    mixv[i] = (y / (R || 1) + 1) / 2; // gradient bottom→top
  }
  const B = sampleText(monogram, COUNT, `800 190px ${getComputedStyle(document.body).getPropertyValue("--font-grotesk") || "sans-serif"}, sans-serif`);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(A, 3));
  geo.setAttribute("aB", new THREE.BufferAttribute(B, 3));
  geo.setAttribute("aC", new THREE.BufferAttribute(C, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aRot", new THREE.BufferAttribute(rot, 1));
  geo.setAttribute("aMix", new THREE.BufferAttribute(mixv, 1));

  const uniforms = {
    uMorph: { value: 0 },
    uTime: { value: 0 },
    uPixel: { value: dpr * (small ? 3.2 : 4) },
    uMouse: { value: new THREE.Vector2(9, 9) },
    uOpacity: { value: 0 },
    uC1: { value: new THREE.Color() },
    uC2: { value: new THREE.Color() },
    uC3: { value: new THREE.Color() },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  function setTheme(dark: boolean) {
    const p = dark ? PALETTE.dark : PALETTE.light;
    uniforms.uC1.value.set(p[0]);
    uniforms.uC2.value.set(p[1]);
    uniforms.uC3.value.set(p[2]);
    mat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    mat.needsUpdate = true;
  }

  let progress = 0,
    smooth = 0,
    mx = 0,
    my = 0,
    tmx = 0,
    tmy = 0,
    running = false,
    raf = 0;
  const clock = new THREE.Clock();
  let elapsed = 0;

  function resize() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the shape inside narrow screens
    camera.position.z = w / h < 0.8 ? 10.5 : 7;
    camera.updateProjectionMatrix();
  }
  resize();

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    elapsed += Math.min(clock.getDelta(), 0.05); // own time: no jump after a pause
    const t = elapsed;
    smooth += (progress - smooth) * 0.08;
    mx += (tmx - mx) * 0.06;
    my += (tmy - my) * 0.06;
    uniforms.uTime.value = t;
    uniforms.uMorph.value = smooth * 2;
    uniforms.uOpacity.value = Math.min(1, t / 1.2);
    uniforms.uMouse.value.set(tmx * 1.2, tmy * 0.8);
    const shapeA = 1 - Math.min(1, smooth * 2);
    points.rotation.y = shapeA * (t * 0.12) + mx * 0.35;
    points.rotation.x = my * 0.2;
    renderer.render(scene, camera);
  }

  return {
    start() {
      // idempotent: the viewport observer and the tab-visibility handler may both call it
      if (running) return;
      running = true;
      clock.getDelta(); // drop the paused gap
      frame();
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    renderStatic(p: number) {
      uniforms.uMorph.value = p * 2;
      uniforms.uOpacity.value = 1;
      renderer.render(scene, camera);
    },
    setProgress(p: number) {
      progress = p;
    },
    setPointer(x: number, y: number) {
      tmx = x;
      tmy = y;
    },
    setTheme,
    resize,
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    },
  };
}
