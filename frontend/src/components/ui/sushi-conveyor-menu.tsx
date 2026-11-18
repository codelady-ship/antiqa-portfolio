"use client";

/* Third-party (21st.dev) imperative animation component: the belt runs in requestAnimationFrame and
   keeps its live state in refs on purpose (no re-render per frame). The React Compiler rules below
   flag that pattern, and the plates are remote / transparent images sized by the belt geometry. */
/* eslint-disable react-hooks/refs, react-hooks/immutability, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, @next/next/no-img-element */

/**
 * SushiConveyorMenu — a stadium-loop conveyor belt.
 *
 * Source: 21st.dev, component "sushi-conveyor-menu" ("Sushi Conveyor Belt Menu – Restaurant Hero
 * Section") by DHxWhy (@dhxwhy), https://21st.dev/@dhxwhy/components/sushi-conveyor-menu
 * Licence: MIT, as stated on that page ("License: mit"); pasted by the owner on 2026-11-16.
 * The original is in commit 93bd154; the changes below are ours.
 *
 * Adapted for the portfolio:
 * - shadcn tokens mapped to the site palette (globals.css: ink/bg/muted/line/surface, rose…);
 * - price is optional; plates can be a round-cut screenshot (`cover`) or a pastel initial;
 * - `centerpiece` stands on the island in the middle (depth-sorted between the lanes);
 * - `renderActions` replaces the price + "Add to order" row in the dialog;
 * - `technicalDetails` marks the detail chips as tech names (translate="no").
 */

import * as React from "react";
import { createPortal } from "react-dom";

export type DishTier = 1 | 2 | 3 | 4 | 5;

export interface ConveyorDish {
  id: string;
  /** Accessible name, chip text and dialog title. */
  name: string;
  /** One or two sentences for the caption and the dialog. */
  description?: string;
  /** Price text such as "$4.20", shown on the chip, the caption and the dialog (optional). */
  price?: string;
  /** Price tier 1–5. Kaiten plates are colour-coded by price, so the tier is drawn as the plate ring in chart colour 1–5. */
  tier?: DishTier;
  /** Top-down photo of the plate, centred on a transparent square canvas; or, with `cover`, any picture cut round. */
  image?: string;
  /** Cut `image` to the round plate (object-cover), e.g. a website screenshot. */
  cover?: boolean;
  /** Letter drawn on a pastel plate when there is no image. */
  initial?: string;
  /** Short facts such as the piece count or allergens, listed as chips in the dialog. */
  details?: string[];
}

export interface SushiConveyorMenuLabels {
  add: string;
  close: string;
  previous: string;
  next: string;
  /** Accessible name of the pause toggle. */
  pause?: string;
}

export interface SushiConveyorMenuProps extends React.ComponentProps<"section"> {
  items: ConveyorDish[];
  eyebrow?: string;
  heading?: string;
  /** Shown under the belt while no plate is picked out. */
  caption?: string;
  /** Call to action rendered under the caption. */
  action?: React.ReactNode;
  /** A small note centred under the belt controls (e.g. what the centerpiece is). */
  note?: React.ReactNode;
  /** Cruise speed of the belt in px/s, measured on the front lane. */
  speed?: number;
  /** Stops the belt (controlled). */
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** Brings one plate after another to the front and lifts it, until the visitor interacts. */
  autoplay?: boolean;
  /** Milliseconds between autoplay plates. */
  interval?: number;
  /** Index of the lifted plate (controlled). */
  active?: number | null;
  onActiveChange?: (index: number | null) => void;
  onOpenChange?: (index: number | null) => void;
  /** Called by the dialog's add button. */
  onAdd?: (item: ConveyorDish) => void;
  /** Price label per tier for the legend. Derived from the items when omitted. */
  legend?: { [tier: number]: string };
  labels?: SushiConveyorMenuLabels;
  /** Stands on the island in the middle of the belt: in front of the back lane, behind the front lane. */
  centerpiece?: React.ReactNode;
  /** Width of the centerpiece box as a multiple of the plate diameter. */
  centerWidth?: number;
  /** Dialog buttons instead of the price and the add button. `close` animates the plate back. */
  renderActions?: (item: ConveyorDish, close: () => void) => React.ReactNode;
  /** The detail chips are tech names: never machine-translated. */
  technicalDetails?: boolean;
  /** Replaces the eyebrow / heading / legend block (e.g. the site's own section heading). */
  header?: React.ReactNode;
  /** Accessible name of the belt when there is no `heading`. */
  beltLabel?: string;
  /** Gap between plates as a multiple of the default (a few plates on a longer belt). */
  spacing?: number;
  /** Radius of the belt's ends as a multiple of the default (a deeper island for the centerpiece). */
  curve?: number;
  /** Smallest plate diameter in px on narrow screens (ignored with autoDensity: the belt never overflows). */
  minPlate?: number;
  /**
   * Fit any number of plates (1 … ~20): `spacing` / `curve` become the look for a handful of plates;
   * fewer plates get a longer gap (the loop keeps room for the island), more plates first close the
   * gaps (never closer than a lifted plate needs), then get a deeper oval, then get smaller. The
   * cruise speed follows the plate size.
   */
  autoDensity?: boolean;
  /** classes sizing the belt before it is measured (server render), e.g. responsive aspect ratios, so it does not shift. */
  initialClass?: string;
  /** A click on a plate calls this instead of opening the built-in dialog (the site's own project modal). */
  onPick?: (index: number) => void;
  /** Replaces the caption (name + description of the lifted plate) with your own block, e.g. a project panel. */
  info?: React.ReactNode;
}

const SPACING = 1.35;
const CURVE = 0.95;
const BAND = 1.22;
const TILT = 0.8;
const SLAT = 0.34;
const LIFT_Y = -6;
const LIFT_SCALE = 0.08;
const BACK_SHADE = 0.15;
const CHIP_ROOM = 34;
const WIDE = 1024;
const HOLD = 1400;
const RUN = 0;
const SEEK = 1;
const DRAG = 2;
const DEFAULT_LABELS: SushiConveyorMenuLabels = { add: "Add to order", close: "Close", previous: "Previous plate", next: "Next plate", pause: "Pause belt" };
// plate rings in the site's palette (globals.css) instead of shadcn's chart colours
const TIERS = [
  { ring: "border-rose", dot: "bg-rose" },
  { ring: "border-violet", dot: "bg-violet" },
  { ring: "border-mint", dot: "bg-mint" },
  { ring: "border-gold", dot: "bg-gold" },
  { ring: "border-accent", dot: "bg-accent" },
] as const;
/**
 * Belt colours (review 2026-11-18: the light-mode belt was a dark aubergine slab). Light: a blush
 * belt with raspberry (#c8365f) rails and a cream island; dark: a deep berry belt, not muddy grey.
 * Nothing on the belt itself carries text (the plates, chips and controls have their own surfaces),
 * the rails are decoration; text around it keeps the page tokens (AA).
 */
const THEME =
  "[--belt:#f7c9d6] dark:[--belt:#4a2340] " +
  "[--belt-side:#e7a3b8] dark:[--belt-side:#33172c] " +
  "[--rail:#c8365f] dark:[--rail:#ff8fb3] " +
  "[--seam:#a8325a] dark:[--seam:#000] " +
  "[--island:#fffaf5] dark:[--island:#2f2133] " +
  "[--island-low:#fde8ee] dark:[--island-low:#271b2b] " +
  "[--island-wall:#f2c4d2] dark:[--island-wall:#1f1523]";

type Geo = {
  width: number; height: number; d: number; r: number; s: number; l: number; pitch: number; n: number;
  kb: number; cx: number; ym: number; a: number; b: number; band: number; slats: number; side: number; edgeTop: number;
};
type Point = { x: number; z: number; nx: number; nz: number; tx: number; tz: number };
type Sim = {
  offset: number; v: number; mode: number; target: number;
  lift: number[]; vlift: number[]; z: number[]; lane: string[];
  raf: number; last: number; visible: boolean; init: boolean; touched: boolean; l: number; center: number; published: string;
  px: number; py: number; inside: boolean; lock: boolean; lockX: number; lockY: number;
};

function makeSim(): Sim {
  return { offset: 0, v: 0, mode: RUN, target: 0, lift: [], vlift: [], z: [], lane: [], raf: 0, last: 0, visible: true, init: false, touched: false, l: 0, center: -1, published: "", px: 0, py: 0, inside: false, lock: false, lockX: 0, lockY: 0 };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function tierStyle(tier: number | undefined) {
  return TIERS[clamp(Math.round(tier ?? 1), 1, 5) - 1] ?? TIERS[0];
}

/** Position on the stadium loop. u is arc length on the belt, the front lane runs right to left and the back lane left to right. */
function along(g: Geo, u: number): Point {
  const { s, r } = g;
  let t = ((u % g.l) + g.l) % g.l;
  if (t < s) return { x: s / 2 - t, z: r, nx: 0, nz: 1, tx: -1, tz: 0 };
  t -= s;
  const arc = Math.PI * r;
  if (t < arc) {
    const f = t / r;
    const sin = Math.sin(f);
    const cos = Math.cos(f);
    return { x: -s / 2 - r * sin, z: r * cos, nx: -sin, nz: cos, tx: -cos, tz: -sin };
  }
  t -= arc;
  if (t < s) return { x: -s / 2 + t, z: -r, nx: 0, nz: -1, tx: 1, tz: 0 };
  t -= s;
  const f = Math.min(Math.PI, t / r);
  const sin = Math.sin(f);
  const cos = Math.cos(f);
  return { x: s / 2 + r * sin, z: -r * cos, nx: sin, nz: -cos, tx: cos, tz: sin };
}

/** Perspective-ish projection: the back lane shrinks to kb and the depth axis is foreshortened by TILT. */
function project(g: Geo, x: number, z: number) {
  const k = g.a + g.b * z;
  return { x: g.cx + x * k, y: g.ym + TILT * (g.a * z + (g.b * z * z) / 2), k };
}

function makeGeo(width: number, n: number, d: number, kb: number, spacing = 1, curve = 1): Geo {
  const l = Math.max(1, n) * SPACING * spacing * d;
  const r = Math.min(CURVE * curve * d, l / (2 * Math.PI));
  const s = Math.max(0, (l - 2 * Math.PI * r) / 2);
  const g: Geo = { width, height: 0, d, r, s, l, pitch: l / Math.max(1, n), n: Math.max(1, n), kb, cx: width / 2, ym: 0, a: (1 + kb) / 2, b: (1 - kb) / (2 * r), band: BAND * d, slats: Math.max(10, Math.round(l / (SLAT * d))), side: Math.max(3, d * 0.07), edgeTop: 0 };
  let top = Infinity;
  let bottom = -Infinity;
  let edge = Infinity;
  for (let j = 0; j < 120; j++) {
    const p = along(g, (j / 120) * l);
    const rim = project(g, p.x + (p.nx * g.band) / 2, p.z + (p.nz * g.band) / 2);
    const plate = project(g, p.x, p.z);
    const half = (plate.k * d * TILT) / 2;
    edge = Math.min(edge, rim.y);
    top = Math.min(top, rim.y, plate.y + (LIFT_Y / 100) * half * 2 - half * (1 + LIFT_SCALE) - CHIP_ROOM);
    bottom = Math.max(bottom, rim.y + g.side + d * 0.06, plate.y + half + d * 0.08);
  }
  g.ym = Math.ceil(-top) + 2;
  g.height = Math.ceil(bottom - top) + 4;
  g.edgeTop = edge + g.ym;
  return g;
}

/**
 * Width of the centerpiece box. grow: keep the usual size when the plates get small (autoDensity on
 * wider screens). Always capped so a portrait (about 1.2 × its width tall) stays inside the stage:
 * its bottom sits at ym + 0.3 d, so its top never rises above the stage's top edge.
 */
function centerpieceWidth(g: Geo, centerWidth: number, grow: boolean) {
  const base = (grow ? Math.max(g.d, Math.min(g.d * 1.75, 140)) : g.d) * centerWidth;
  return Math.min(base, (g.ym + g.d * 0.3) / PORTRAIT);
}
/** height / width of the centerpiece portrait (her clip still / video is 360 × 534) */
const PORTRAIT = 1.48;

/** pastel tile for a plate without a picture: soft fill + its matching text colour (AA) */
const TILE_TINTS = ["bg-pink-soft text-rose", "bg-lilac-soft text-violet", "bg-peach-soft text-gold", "bg-mint-soft text-mint", "bg-butter-soft text-gold"];
function tileTint(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TILE_TINTS[h % TILE_TINTS.length];
}

/** autoDensity: closest pitch (in SPACING units) at which a lifted plate (×1.08) still clears its neighbours */
const MIN_GAP = 1.24 / SPACING;
/** autoDensity: the shortest loop, in plate diameters, that still leaves the island its room */
const MIN_LOOP = 12;

/** autoDensity: gap and curve for n plates, from the look set for a handful of plates (base spacing / curve). */
export function density(n: number, spacing: number, curve: number, narrow = false) {
  const count = Math.max(1, n);
  return {
    // few plates: a longer gap, so the loop (and the island in it) keeps its size
    spacing: Math.max(spacing, MIN_LOOP / (SPACING * count)),
    // many plates: a deeper oval holds more belt in the same width (phones go nearly round)
    curve: curve * clamp(Math.sqrt(count / 6), 1, narrow ? 2.6 : 1.8),
  };
}

function halfSpan(g: Geo) {
  let span = 0;
  for (let j = 0; j < 120; j++) {
    const p = along(g, (j / 120) * g.l);
    const rim = project(g, p.x + (p.nx * g.band) / 2, p.z + (p.nz * g.band) / 2);
    const plate = project(g, p.x, p.z);
    span = Math.max(span, Math.abs(rim.x - g.cx) + 3, Math.abs(plate.x - g.cx) + (plate.k * g.d * (1 + LIFT_SCALE)) / 2);
  }
  return span;
}

function edgePath(g: Geo, offset: number) {
  let d = "";
  const steps = 168;
  for (let j = 0; j < steps; j++) {
    const p = along(g, (j / steps) * g.l);
    const q = project(g, p.x + p.nx * offset, p.z + p.nz * offset);
    d += `${j ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  }
  return `${d}Z`;
}

/** Crescent slat seams across the belt, redrawn every frame so they travel with the plates (and round the curves). */
function slatPath(g: Geo, offset: number, shift: number) {
  const half = g.band * 0.46;
  const pitch = g.l / g.slats;
  const bulge = pitch * 0.2;
  let d = "";
  for (let j = 0; j < g.slats; j++) {
    const p = along(g, offset + shift + j * pitch);
    const inner = project(g, p.x - p.nx * half, p.z - p.nz * half);
    const outer = project(g, p.x + p.nx * half, p.z + p.nz * half);
    const mid = project(g, p.x + p.tx * bulge, p.z + p.tz * bulge);
    d += `M${inner.x.toFixed(1)} ${inner.y.toFixed(1)}Q${(2 * mid.x - (inner.x + outer.x) / 2).toFixed(1)} ${(2 * mid.y - (inner.y + outer.y) / 2).toFixed(1)} ${outer.x.toFixed(1)} ${outer.y.toFixed(1)}`;
  }
  return d;
}

function pose(g: Geo, offset: number, i: number) {
  const p = along(g, offset - i * g.pitch);
  const q = project(g, p.x, p.z);
  return { x: q.x, y: q.y, k: q.k, depth: (p.z + g.r) / (2 * g.r) };
}

function centerOf(g: Geo, offset: number) {
  return ((Math.round((offset - g.s / 2) / g.pitch) % g.n) + g.n) % g.n;
}

function legendEntries(items: ConveyorDish[], legend: { [tier: number]: string } | undefined) {
  const out = [] as { tier: number; label: string }[];
  for (let tier = 1; tier <= 5; tier++) {
    const label = legend ? legend[tier] : items.find((item) => (item.tier ?? 1) === tier)?.price;
    if (label) out.push({ tier, label });
  }
  return out;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function SushiConveyorMenu({
  items,
  eyebrow,
  heading,
  caption,
  action,
  note,
  speed = 26,
  paused: pausedProp,
  onPausedChange,
  autoplay = false,
  interval = 3000,
  active: activeProp,
  onActiveChange,
  onOpenChange,
  onAdd,
  legend,
  labels = DEFAULT_LABELS,
  centerpiece,
  centerWidth = 1.25,
  renderActions,
  technicalDetails = false,
  header: headerProp,
  beltLabel,
  spacing = 1,
  curve = 1,
  minPlate = 96,
  autoDensity = false,
  initialClass = "aspect-[2]",
  onPick,
  info,
  className,
  ref,
  ...rest
}: SushiConveyorMenuProps) {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const count = items.length;
  const sectionRef = React.useRef(null as HTMLElement | null);
  const stageRef = React.useRef(null as HTMLDivElement | null);
  const beltRef = React.useRef(null as HTMLDivElement | null);
  const seamRef = React.useRef(null as SVGPathElement | null);
  const glintRef = React.useRef(null as SVGPathElement | null);
  const plates = React.useRef([] as (HTMLButtonElement | null)[]);
  const lifts = React.useRef([] as (HTMLSpanElement | null)[]);
  const shades = React.useRef([] as (HTMLSpanElement | null)[]);
  const shadows = React.useRef([] as (HTMLSpanElement | null)[]);
  const anchors = React.useRef([] as (HTMLSpanElement | null)[]);
  const sim = React.useRef(makeSim());
  const pointer = React.useRef({ id: -1, index: -1, x: 0, y: 0, moved: false, start: 0, lane: 1, lastX: 0, lastT: 0, v: 0 });
  const pendingOpen = React.useRef(-1);
  const returnFocus = React.useRef(null as number | null);
  const autoActive = React.useRef(null as number | null);
  const autoLast = React.useRef(null as number | null);
  const [size, setSize] = React.useState({ section: 0, stage: 0 });
  const [innerActive, setInnerActive] = React.useState(null as number | null);
  const [innerPaused, setInnerPaused] = React.useState(false);
  const [openIndex, setOpenIndex] = React.useState(null as number | null);
  const [lifted, setLifted] = React.useState(null as number | null);
  const [reduced, setReduced] = React.useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [playing, setPlaying] = React.useState(autoplay);
  const [center, setCenter] = React.useState(0);
  const [failed, setFailed] = React.useState({} as { [id: string]: boolean });

  const requested = activeProp !== undefined ? activeProp : innerActive;
  const active = requested !== null && requested >= 0 && requested < count ? requested : null;
  const paused = pausedProp ?? innerPaused;
  const wide = size.section >= WIDE;
  const narrow = size.section > 0 && size.section < 480;
  const kb = narrow ? 0.6 : 0.68;

  const geo = React.useMemo(() => {
    if (!size.stage || count === 0) return null;
    const cap = wide ? 150 : clamp(size.section * 0.143, 96, 150);
    const fitFor = (sp: number, cv: number) => (size.stage - 8) / ((2 * halfSpan(makeGeo(1000, count, 100, kb, sp, cv))) / 100);
    if (!autoDensity) {
      const fit = fitFor(spacing, curve);
      return makeGeo(size.stage, count, Math.round(clamp(fit, Math.min(minPlate, cap), cap)), kb, spacing, curve);
    }
    const auto = density(count, spacing, curve, narrow);
    let sp = auto.spacing;
    // too small at the preferred gap: close the gaps first (bisection: fit falls as the gap grows)
    const want = cap * 0.8;
    if (fitFor(sp, auto.curve) < want && sp > MIN_GAP) {
      let lo = MIN_GAP;
      let hi = sp;
      for (let k = 0; k < 16; k++) {
        const mid = (lo + hi) / 2;
        if (fitFor(mid, auto.curve) >= want) lo = mid;
        else hi = mid;
      }
      sp = lo;
    }
    return makeGeo(size.stage, count, Math.max(16, Math.floor(Math.min(fitFor(sp, auto.curve), cap))), kb, sp, auto.curve);
  }, [size.stage, size.section, count, kb, wide, narrow, spacing, curve, minPlate, autoDensity]);

  const live = React.useRef({
    geo: null as Geo | null, active: null as number | null, paused: false, reduced: false, open: false, count: 0, speed: 26,
    activeControlled: false, pausedControlled: false,
    onActiveChange: undefined as ((index: number | null) => void) | undefined,
    onPausedChange: undefined as ((value: boolean) => void) | undefined,
    onOpenChange: undefined as ((index: number | null) => void) | undefined,
    onAdd: undefined as ((item: ConveyorDish) => void) | undefined,
    onPick: undefined as ((index: number) => void) | undefined,
  });
  live.current = {
    // autoDensity: smaller plates travel slower, so a full belt does not look like it races
    geo, active, paused, reduced, open: openIndex !== null, count, speed: Math.max(0, autoDensity && geo ? speed * clamp(geo.d / 110, 0.5, 1.1) : speed),
    activeControlled: activeProp !== undefined, pausedControlled: pausedProp !== undefined,
    onActiveChange, onPausedChange, onOpenChange, onAdd, onPick,
  };

  const setSectionRef = React.useCallback((node: HTMLElement | null) => {
    sectionRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  const paintPlate = React.useCallback((i: number) => {
    const L = live.current;
    const g = L.geo;
    const s = sim.current;
    const button = plates.current[i];
    if (!g || !button) return;
    const q = pose(g, s.offset, i);
    const e = s.lift[i] ?? 0;
    button.style.transform = `translate3d(${(q.x - g.d / 2).toFixed(2)}px,${(q.y - (g.d * TILT) / 2).toFixed(2)}px,0) scale(${q.k.toFixed(4)})`;
    // the tap area (::before) stays ≥ 44 px on screen however small the plate is drawn
    const hit = `${Math.ceil(44 / q.k)}px`;
    if (button.dataset.hit !== hit) { button.dataset.hit = hit; button.style.setProperty("--hit", hit); }
    const z = i === L.active ? 2000 : 100 + Math.round(q.y);
    if (s.z[i] !== z) { s.z[i] = z; button.style.zIndex = String(z); }
    const lane = q.depth >= 0.5 ? "front" : "back";
    if (s.lane[i] !== lane) { s.lane[i] = lane; button.dataset.lane = lane; }
    const lift = lifts.current[i];
    if (lift) lift.style.transform = `translateY(${(LIFT_Y * e).toFixed(3)}%) scale(${(1 + LIFT_SCALE * e).toFixed(4)})`;
    const shade = shades.current[i];
    if (shade) shade.style.opacity = (BACK_SHADE * clamp(1 - q.depth, 0, 1) * (1 - 0.7 * clamp(e, 0, 1))).toFixed(3);
    const shadow = shadows.current[i];
    if (shadow) {
      shadow.style.transform = `translate3d(0,${(g.d * TILT * 0.05 * e).toFixed(2)}px,0) scale(${(1 + 0.14 * e).toFixed(3)})`;
      shadow.style.opacity = (1 - 0.5 * clamp(e, 0, 1)).toFixed(3);
    }
    const anchor = anchors.current[i];
    if (anchor) anchor.style.transform = `scale(${(1 / (q.k * (1 + LIFT_SCALE * e))).toFixed(4)})`;
  }, []);

  const paintBelt = React.useCallback(() => {
    const L = live.current;
    const g = L.geo;
    const s = sim.current;
    if (!g) return;
    seamRef.current?.setAttribute("d", slatPath(g, s.offset, 0));
    glintRef.current?.setAttribute("d", slatPath(g, s.offset, -Math.max(1.4, g.d * 0.024)));
    const v = (Math.abs(s.v) < 0.005 ? 0 : s.v).toFixed(2);
    if (v !== s.published) { s.published = v; beltRef.current?.style.setProperty("--belt-v", v); }
    const c = centerOf(g, s.offset);
    if (c !== s.center) { s.center = c; setCenter(c); }
  }, []);

  const paintAll = React.useCallback(() => {
    for (let i = 0; i < live.current.count; i++) paintPlate(i);
    paintBelt();
  }, [paintPlate, paintBelt]);

  const hitTest = React.useCallback((px: number, py: number) => {
    const L = live.current;
    const g = L.geo;
    const s = sim.current;
    if (!g) return null;
    let best = null as number | null;
    let bestY = -Infinity;
    for (let i = 0; i < L.count; i++) {
      const q = pose(g, s.offset, i);
      const e = clamp(s.lift[i] ?? 0, 0, 1.2);
      const grow = (1 + LIFT_SCALE * e) * (i === L.active ? 1.1 : 1);
      // never smaller than a 44 px tap target (small plates on phones)
      const rx = Math.max(22, (g.d * q.k * grow) / 2);
      const ry = Math.max(22, (g.d * TILT * q.k * grow) / 2);
      const dx = (px - q.x) / rx;
      const dy = (py - (q.y + (LIFT_Y / 100) * g.d * TILT * q.k * e)) / ry;
      if (dx * dx + dy * dy > 1) continue;
      if (i === L.active) return i;
      if (q.y > bestY) { best = i; bestY = q.y; }
    }
    return best;
  }, []);

  const hoverRef = React.useRef((hit: number | null) => { void hit; });

  const tick = React.useCallback((now: number) => {
    const s = sim.current;
    const L = live.current;
    const g = L.geo;
    s.raf = 0;
    if (!g || !s.visible) { s.last = 0; return; }
    const dt = s.last ? clamp((now - s.last) / 1000, 0, 0.25) : 1 / 60;
    s.last = now;
    // Sub-steps keep the springs stable and the belt on real time when frames arrive late.
    const steps = Math.max(1, Math.ceil(dt / 0.017));
    const h = dt / steps;
    const stopped = L.paused || L.active !== null || L.open;
    const cruise = L.reduced ? 0 : L.speed;
    for (let step = 0; step < steps; step++) {
      if (s.mode === SEEK) {
        const w = 5.6;
        s.v += (w * w * (s.target - s.offset) - 2 * w * s.v) * h;
        s.offset += s.v * h;
        if (Math.abs(s.target - s.offset) < 0.3 && Math.abs(s.v) < 4) { s.offset = s.target; s.v = 0; s.mode = RUN; }
      } else if (s.mode === RUN) {
        if (stopped) {
          s.v *= Math.exp(-7.2 * h);
          if (Math.abs(s.v) < 0.02) s.v = 0;
        } else {
          let e = s.v - cruise;
          if (Math.abs(e) > Math.max(6, cruise * 0.5)) e = Math.sign(e) * Math.max(0, Math.abs(e) * Math.exp(-2.4 * h) - 90 * h);
          else e *= Math.exp(-3.4 * h);
          s.v = cruise + (Math.abs(e) < 0.01 ? 0 : e);
        }
        s.offset += s.v * h;
      }
      for (let i = 0; i < L.count; i++) {
        const goal = i === L.active ? 1 : 0;
        if (L.reduced) { s.lift[i] = goal; s.vlift[i] = 0; continue; }
        const x = s.lift[i] ?? 0;
        const v = (s.vlift[i] ?? 0) + (330 * (goal - x) - 23 * (s.vlift[i] ?? 0)) * h;
        s.lift[i] = x + v * h;
        s.vlift[i] = v;
      }
    }
    let busy = s.mode !== RUN || s.v !== 0 || (!stopped && cruise > 0);
    for (let i = 0; i < L.count; i++) {
      const goal = i === L.active ? 1 : 0;
      if (Math.abs(goal - (s.lift[i] ?? 0)) < 0.002 && Math.abs(s.vlift[i] ?? 0) < 0.02) { s.lift[i] = goal; s.vlift[i] = 0; }
      else busy = true;
    }
    if (s.inside && !s.lock && s.mode === RUN && !L.open && pointer.current.id < 0 && Math.abs(s.v) > 0.3) {
      const hit = hitTest(s.px, s.py);
      if (hit !== null && hit !== L.active) hoverRef.current(hit);
    }
    paintAll();
    if (busy) s.raf = requestAnimationFrame(tick);
    else s.last = 0;
  }, [hitTest, paintAll]);

  const kick = React.useCallback(() => {
    const s = sim.current;
    if (s.raf || !s.visible) return;
    s.last = 0;
    s.raf = requestAnimationFrame(tick);
  }, [tick]);

  const setActive = React.useCallback((next: number | null) => {
    const L = live.current;
    if (L.active === next) return;
    if (!L.activeControlled) { L.active = next; setInnerActive(next); }
    L.onActiveChange?.(next);
    kick();
  }, [kick]);

  const stop = React.useCallback(() => {
    setPlaying(false);
    const s = sim.current;
    s.touched = true;
    if (s.mode === SEEK) s.mode = RUN;
    const auto = autoActive.current;
    if (auto !== null) {
      autoActive.current = null;
      if (live.current.active === auto) setActive(null);
    }
  }, [setActive]);

  const seekTo = React.useCallback((index: number) => {
    const s = sim.current;
    const g = live.current.geo;
    if (!g) return;
    const base = g.s / 2 + index * g.pitch;
    s.target = base + Math.round((s.offset - base) / g.l) * g.l;
    if (live.current.reduced) { s.offset = s.target; s.v = 0; s.mode = RUN; paintAll(); return; }
    s.mode = SEEK;
    kick();
  }, [kick, paintAll]);

  const focusVisible = () => !!stageRef.current?.querySelector("[data-dish]:focus-visible");

  hoverRef.current = (hit: number | null) => {
    const current = live.current.active;
    if (hit === current) {
      // The visitor takes over the plate autoplay lifted: autoplay stops and the plate stays up.
      if (hit !== null && autoActive.current === hit) { autoActive.current = null; setPlaying(false); }
      return;
    }
    if (hit !== null) { stop(); setActive(hit); return; }
    if (current !== null && current !== autoActive.current && !focusVisible()) setActive(null);
  };

  const open = React.useCallback((index: number) => {
    stop();
    setActive(index);
    const pick = live.current.onPick;
    if (pick) { pick(index); return; }
    const s = sim.current;
    s.v = 0;
    s.mode = RUN;
    live.current.open = true;
    paintBelt();
    setOpenIndex(index);
    live.current.onOpenChange?.(index);
  }, [stop, setActive, paintBelt]);

  const close = React.useCallback(() => {
    live.current.open = false;
    setOpenIndex(null);
    live.current.onOpenChange?.(null);
    kick();
  }, [kick]);

  const go = (index: number, focus: boolean) => {
    if (count === 0) return;
    const next = ((index % count) + count) % count;
    stop();
    if (focus) plates.current[next]?.focus({ preventScroll: true });
    setActive(next);
    seekTo(next);
  };

  const togglePause = () => {
    stop();
    const L = live.current;
    const next = !L.paused;
    if (!L.pausedControlled) { L.paused = next; setInnerPaused(next); }
    L.onPausedChange?.(next);
    if (!next && L.active !== null && !focusVisible() && !sim.current.inside) setActive(null);
    kick();
  };

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  React.useEffect(() => { setPlaying(autoplay); }, [autoplay]);

  React.useLayoutEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;
    const measure = () => {
      const next = { section: Math.round(section.clientWidth), stage: Math.round(stage.clientWidth) };
      setSize((old) => (old.section === next.section && old.stage === next.stage ? old : next));
    };
    // perf (2026-11-18): the first build of the belt (plates, lanes, SVG) is a transition, so React
    // renders it in small slices after hydration instead of one long blocking task on page load;
    // the server HTML already holds the belt's box (initialClass), so nothing moves meanwhile
    React.startTransition(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [count > 0]);

  React.useLayoutEffect(() => {
    const s = sim.current;
    if (!geo) return;
    if (!s.init) {
      s.init = true;
      s.offset = geo.s / 2 - Math.min(live.current.speed * 1.62, geo.pitch * 0.45);
      s.v = live.current.reduced || live.current.paused ? 0 : live.current.speed;
    } else if (s.l > 0 && s.l !== geo.l) {
      const f = geo.l / s.l;
      s.offset *= f;
      s.target *= f;
    }
    if (live.current.reduced) {
      s.v = 0;
      if (s.mode !== DRAG) s.mode = RUN;
      if (!s.touched) s.offset = geo.s / 2;
    }
    s.l = geo.l;
    s.z = [];
    s.lane = [];
    paintAll();
    kick();
  }, [geo, items, reduced, paintAll, kick]);

  React.useEffect(() => { kick(); }, [active, paused, openIndex, reduced, speed, kick]);

  React.useEffect(() => {
    const node = sectionRef.current;
    const s = sim.current;
    let inView = true;
    const update = () => {
      const visible = inView && !document.hidden;
      if (visible === s.visible) return;
      s.visible = visible;
      if (visible) kick();
      else if (s.raf) { cancelAnimationFrame(s.raf); s.raf = 0; s.last = 0; }
    };
    const observer = node && typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => { inView = entries.some((entry) => entry.isIntersecting); update(); }) : null;
    if (node && observer) observer.observe(node);
    document.addEventListener("visibilitychange", update);
    update();
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, [kick]);

  React.useEffect(() => () => { const s = sim.current; if (s.raf) cancelAnimationFrame(s.raf); s.raf = 0; s.last = 0; }, []);

  const geoReady = geo !== null;
  React.useEffect(() => {
    if (!playing || reduced || paused || openIndex !== null || count === 0 || !geoReady) return;
    let timer = 0;
    const show = () => {
      const g = live.current.geo;
      if (!g) return;
      const last = autoLast.current;
      const index = last === null ? centerOf(g, sim.current.offset + live.current.speed * 0.25) : (last + 1) % count;
      autoLast.current = index;
      autoActive.current = index;
      setActive(index);
      seekTo(index);
      timer = window.setTimeout(() => {
        if (autoActive.current === index) {
          autoActive.current = null;
          if (live.current.active === index) setActive(null);
        }
        timer = window.setTimeout(show, Math.max(300, interval - HOLD));
      }, HOLD);
    };
    timer = window.setTimeout(show, autoLast.current === null ? 1600 : Math.max(300, interval - HOLD));
    return () => window.clearTimeout(timer);
  }, [playing, reduced, paused, openIndex, count, interval, geoReady, setActive, seekTo]);

  React.useLayoutEffect(() => {
    if (openIndex !== null || lifted !== null || returnFocus.current === null) return;
    const index = returnFocus.current;
    returnFocus.current = null;
    plates.current[index]?.focus({ preventScroll: true });
  }, [openIndex, lifted]);

  const local = (event: React.PointerEvent) => {
    const box = stageRef.current?.getBoundingClientRect();
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    const g = live.current.geo;
    if (event.button !== 0 || !g) return;
    const at = local(event);
    const hit = hitTest(at.x, at.y);
    pendingOpen.current = -1;
    pointer.current = { id: event.pointerId, index: hit ?? -1, x: event.clientX, y: event.clientY, moved: false, start: sim.current.offset, lane: at.y >= g.ym ? 1 : -1, lastX: event.clientX, lastT: event.timeStamp, v: 0 };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const s = sim.current;
    const p = pointer.current;
    const stage = stageRef.current;
    const g = live.current.geo;
    if (!stage || !g) return;
    const at = local(event);
    if (event.pointerType === "mouse") { s.px = at.x; s.py = at.y; s.inside = true; }
    if (p.id === event.pointerId) {
      const dx = event.clientX - p.x;
      const now = event.timeStamp;
      if (!p.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(event.clientY - p.y)) {
        p.moved = true;
        stop();
        setActive(null);
        s.mode = DRAG;
        if (stage.isConnected) stage.setPointerCapture(event.pointerId);
      }
      if (p.moved) {
        const v = (event.clientX - p.lastX) / Math.max(1, now - p.lastT);
        p.v = p.v * 0.6 + v * 0.4;
        p.lastX = event.clientX;
        p.lastT = now;
        const scale = p.lane > 0 ? 1 : 1 / g.kb;
        s.offset = p.start - p.lane * dx * scale;
        s.v = live.current.reduced ? 0 : -p.lane * p.v * 1000 * scale;
        kick();
      }
      return;
    }
    if (event.pointerType !== "mouse" || live.current.open) return;
    if (s.lock) {
      if (Math.hypot(at.x - s.lockX, at.y - s.lockY) < 4) return;
      s.lock = false;
    }
    hoverRef.current(hitTest(at.x, at.y));
  };

  const finishPointer = (event: React.PointerEvent, cancelled: boolean) => {
    const p = pointer.current;
    if (p.id !== event.pointerId) return;
    const s = sim.current;
    const stage = stageRef.current;
    if (stage?.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    pointer.current = { ...p, id: -1 };
    if (s.mode === DRAG) {
      s.mode = RUN;
      // Holding still before letting go bleeds the flick away (about 70 ms time constant).
      const carry = Math.exp(-Math.max(0, event.timeStamp - p.lastT) / 70);
      s.v = live.current.reduced ? 0 : clamp(s.v * carry, -1400, 1400);
      if (event.pointerType === "mouse") {
        const at = local(event);
        s.lock = true;
        s.lockX = at.x;
        s.lockY = at.y;
      }
      kick();
      return;
    }
    if (cancelled || p.moved) return;
    const touch = event.pointerType !== "mouse";
    if (p.index < 0) {
      if (touch && live.current.active !== null) { stop(); setActive(null); }
      return;
    }
    stop();
    if (touch && live.current.active !== p.index) setActive(p.index);
    else pendingOpen.current = p.index;
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key) || count === 0) return;
    event.preventDefault();
    const own = (event.target as HTMLElement).closest("[data-dish]")?.getAttribute("data-dish");
    const from = own != null ? Number(own) : (active ?? center);
    go(event.key === "Home" ? 0 : event.key === "End" ? count - 1 : from + (event.key === "ArrowRight" ? 1 : -1), true);
  };

  const openSource = React.useCallback(() => (openIndex === null ? null : lifts.current[openIndex]?.getBoundingClientRect() ?? null), [openIndex]);
  const onLift = React.useCallback((on: boolean) => setLifted(on ? openIndex : null), [openIndex]);
  const onDialogClose = React.useCallback(() => { returnFocus.current = openIndex; close(); }, [openIndex, close]);
  const onDialogAdd = React.useCallback(() => {
    const item = openIndex === null ? undefined : items[openIndex];
    if (item) live.current.onAdd?.(item);
  }, [openIndex, items]);

  const paths = React.useMemo(() => (geo ? { outer: edgePath(geo, geo.band / 2), inner: edgePath(geo, -geo.band / 2), island: edgePath(geo, -geo.band / 2 - geo.d * 0.035) } : null), [geo]);
  const current = active === null ? null : items[active] ?? null;
  const roving = active ?? center;
  const tiers = legendEntries(items, legend);
  const g = geo;
  // 44 × 44 px tap targets (review 2026-11-18)
  const control = "inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink/80 shadow-sm outline-none transition-colors hover:border-rose hover:text-rose focus-visible:ring-2 focus-visible:ring-rose motion-reduce:transition-none";

  const header = headerProp ?? ((eyebrow || heading || tiers.length > 0) && (
    <div className={wide ? "flex flex-col items-start gap-4 text-left" : "flex flex-col items-center gap-2 px-2 text-center"}>
      {eyebrow && <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted">{eyebrow}</p>}
      {heading && <h2 className={`text-balance font-medium tracking-tight ${wide ? "text-4xl leading-[1.1] xl:text-[2.75rem]" : "text-2xl md:text-3xl"}`}>{heading}</h2>}
      {tiers.length > 0 && (
        <ul aria-hidden="true" data-legend className={`mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] tabular-nums text-muted ${wide ? "justify-start" : "justify-center"} ${narrow ? "max-w-[15rem]" : ""}`}>
          {tiers.map((entry) => (
            <li key={entry.tier} className="inline-flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full border-2 bg-transparent ${tierStyle(entry.tier).ring}`} />
              {entry.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  ));

  const captionNode = (
    <div id={`${uid}-caption`} aria-live={info ? undefined : "polite"} data-caption className={info ? "mt-4 w-full lg:mt-0" : "mx-auto mt-2 min-h-[3.75rem] max-w-md px-2 text-center sm:min-h-[2.75rem] lg:mx-0 lg:mt-0 lg:min-h-[3.25rem] lg:max-w-none lg:px-0 lg:text-left"}>
      {info ?? (
        <>
          <p className={`text-sm ${current ? "font-medium text-ink" : "text-muted"}`}>
            {current ? <>{current.name}{current.price && <span className="font-normal tabular-nums text-muted"> · {current.price}</span>}</> : caption}
          </p>
          {current?.description && <p className="mt-0.5 text-[13px] leading-snug text-muted">{current.description}</p>}
        </>
      )}
    </div>
  );

  const controls = count > 1 && (
    <div className="relative z-10 mt-1 flex items-center justify-center gap-1.5">
      <button type="button" data-control="previous" aria-label={labels.previous} onClick={() => go((live.current.active ?? sim.current.center) - 1, false)} className={control}>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
      </button>
      <button type="button" data-control="pause" aria-label={labels.pause ?? DEFAULT_LABELS.pause} aria-pressed={paused} onClick={togglePause} className={control}>
        {paused
          ? <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="currentColor"><path d="M5 3.4v9.2a.6.6 0 0 0 .9.5l7.4-4.6a.6.6 0 0 0 0-1L5.9 2.9a.6.6 0 0 0-.9.5Z" /></svg>
          : <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="currentColor"><rect x="4" y="3" width="2.6" height="10" rx="0.8" /><rect x="9.4" y="3" width="2.6" height="10" rx="0.8" /></svg>}
      </button>
      <button type="button" data-control="next" aria-label={labels.next} onClick={() => go((live.current.active ?? sim.current.center) + 1, false)} className={control}>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
      </button>
    </div>
  );

  const stage = count > 0 && (
    <div
      ref={stageRef}
      data-stage
      role="group"
      aria-label={heading ?? beltLabel ?? "Sushi conveyor belt"}
      aria-roledescription="conveyor belt"
      className={`relative w-full touch-pan-y select-none ${g ? "" : initialClass}`}
      style={g ? { height: g.height, overflowX: "clip" } : { overflowX: "clip" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => finishPointer(event, false)}
      onPointerCancel={(event) => finishPointer(event, true)}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        const s = sim.current;
        s.inside = false;
        s.lock = false;
        const current = live.current.active;
        if (pointer.current.id < 0 && !live.current.open && current !== null && current !== autoActive.current && !focusVisible()) setActive(null);
      }}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if ((next && stageRef.current?.contains(next)) || live.current.open || sim.current.inside) return;
        const current = live.current.active;
        if (current !== null && current !== autoActive.current) setActive(null);
      }}
      onKeyDown={onKeyDown}
    >
      {g && (
        <div aria-hidden="true" data-counter className="pointer-events-none absolute inset-x-0" style={{ top: Math.max(0, g.edgeTop - g.d * 0.34), height: g.ym - Math.max(0, g.edgeTop - g.d * 0.34), background: "linear-gradient(to bottom, color-mix(in oklab, var(--ink) 9%, transparent) 0 1px, transparent 1px, color-mix(in oklab, var(--ink) 5%, transparent) 40%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, black 18%, black 82%, transparent)", maskImage: "linear-gradient(to right, transparent, black 18%, black 82%, transparent)" }} />
      )}
      <div ref={beltRef} data-belt aria-hidden="true" className="pointer-events-none absolute inset-0">
        {g && paths && (
          <svg className="absolute left-0 top-0 overflow-visible" width={g.width} height={g.height} viewBox={`0 0 ${g.width} ${g.height}`} focusable="false">
            <defs>
              <filter id={`${uid}-soft`} x="-10%" y="-30%" width="120%" height="160%">
                <feGaussianBlur stdDeviation={(g.d * 0.06).toFixed(1)} />
              </filter>
              <linearGradient id={`${uid}-island`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" style={{ stopColor: "var(--island)" }} />
                <stop offset="1" style={{ stopColor: "var(--island-low)" }} />
              </linearGradient>
            </defs>
            <path d={paths.outer} transform={`translate(0 ${(g.side + g.d * 0.07).toFixed(1)})`} fill="#7a2a48" className="opacity-[0.14] dark:opacity-60 dark:[fill:black]" filter={`url(#${uid}-soft)`} />
            <path d={`${paths.outer}${paths.inner}`} fillRule="evenodd" transform={`translate(0 ${g.side.toFixed(1)})`} style={{ fill: "var(--belt-side)" }} />
            <path d={`${paths.outer}${paths.inner}`} fillRule="evenodd" style={{ fill: "var(--belt)" }} />
            <path ref={seamRef} fill="none" style={{ stroke: "var(--seam)" }} strokeOpacity={0.3} strokeWidth={Math.max(1, g.d * 0.013)} strokeLinecap="round" />
            <path ref={glintRef} fill="none" stroke="white" strokeOpacity={0.14} strokeWidth={Math.max(0.8, g.d * 0.009)} strokeLinecap="round" />
            <path d={paths.outer} fill="none" style={{ stroke: "var(--rail)" }} strokeWidth={Math.max(2, g.d * 0.026)} />
            <path d={paths.outer} fill="none" stroke="white" strokeOpacity={0.55} strokeWidth={Math.max(0.8, g.d * 0.008)} transform="translate(0 -0.8)" />
            <path d={paths.inner} fill="none" style={{ stroke: "var(--rail)" }} strokeWidth={Math.max(1.6, g.d * 0.02)} />
            <path d={paths.inner} fill="none" stroke="white" strokeOpacity={0.4} strokeWidth={Math.max(0.8, g.d * 0.008)} transform="translate(0 -0.7)" />
            <path d={paths.island} style={{ fill: "var(--island-wall)" }} />
            <path d={paths.island} transform={`translate(0 ${(-g.side * 0.6).toFixed(1)})`} style={{ fill: `url(#${uid}-island)` }} />
            <path d={paths.island} transform={`translate(0 ${(-g.side * 0.6 - 0.6).toFixed(1)})`} fill="none" stroke="white" strokeOpacity={0.55} strokeWidth={Math.max(0.8, g.d * 0.008)} className="dark:opacity-40" />
          </svg>
        )}
      </div>
      {/* autoDensity: her size follows the usual plate size, not the smaller plates of a full belt; on
          phones the plain plate-based size, and never taller than the room above the island
          (review #51: at 390 px she covered the legend) */}
      {g && centerpiece && (
        <div
          aria-hidden="true"
          data-centerpiece
          className="pointer-events-none absolute"
          style={{ left: g.cx, top: g.ym + g.d * 0.3, width: centerpieceWidth(g, centerWidth, autoDensity && !narrow), transform: "translate(-50%, -100%)", zIndex: 100 + Math.round(g.ym) }}
        >
          {centerpiece}
        </div>
      )}
      {g && items.map((item, i) => {
        const tier = tierStyle(item.tier);
        const isActive = active === i;
        const broken = !!failed[item.id] || !item.image;
        const mask = `url("${item.image}") 0 0 / 100% 100% no-repeat`;
        const round = !broken && !!item.cover;
        return (
          <button
            key={item.id}
            ref={(node) => { plates.current[i] = node; }}
            type="button"
            data-dish={i}
            data-active={isActive || undefined}
            tabIndex={i === roving ? 0 : -1}
            aria-label={item.price ? `${item.name}, ${item.price}` : item.name}
            aria-describedby={`${uid}-caption`}
            aria-haspopup="dialog"
            aria-current={isActive || undefined}
            className="absolute left-0 top-0 cursor-pointer rounded-[50%] outline-none before:absolute before:left-1/2 before:top-1/2 before:size-[max(100%,var(--hit,44px))] before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose"
            style={{ width: g.d, height: g.d * TILT, visibility: lifted === i ? "hidden" : undefined }}
            onFocus={() => { if (pointer.current.id < 0) { stop(); setActive(i); } }}
            onClick={(event) => { const pending = pendingOpen.current; pendingOpen.current = -1; if (event.detail === 0 || pending === i) open(i); }}
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-90">
              <span ref={(node) => { shadows.current[i] = node; }} className="absolute inset-x-[5%] bottom-[-9%] top-[16%] rounded-[50%] bg-black" style={{ filter: `blur(${Math.max(2, g.d * 0.045).toFixed(1)}px)` }} />
            </span>
            <span ref={(node) => { lifts.current[i] = node; }} data-lift className="absolute inset-0">
              <span aria-hidden="true" data-placeholder className={`absolute rounded-[50%] border border-line bg-surface ${broken || round ? "inset-[3%] shadow-sm" : "inset-[6%]"}`}>
                {broken && item.initial ? (
                  // no screenshot: a soft pastel tile with the initial, its tint picked by the name
                  // (so neighbours differ), meant to look like a plate of its own, not a broken image
                  <span className={`display absolute inset-[9%] grid place-items-center rounded-[50%] leading-none font-[650] ${tileTint(item.name)}`} style={{ fontSize: g.d * 0.3 }}>
                    <span className="-translate-y-[4%] -rotate-6">{item.initial}</span>
                  </span>
                ) : (
                  !round && <span className="absolute inset-[30%] rounded-[50%] bg-muted/20" />
                )}
              </span>
              {round && (
                <span aria-hidden="true" className="pointer-events-none absolute inset-[9%] overflow-hidden rounded-[50%] bg-bg-2">
                  <img
                    src={item.image}
                    alt=""
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    onError={() => setFailed((old) => (old[item.id] ? old : { ...old, [item.id]: true }))}
                    className="size-full select-none object-cover object-top"
                  />
                  <span ref={(node) => { shades.current[i] = node; }} className="absolute inset-0 bg-black" style={{ opacity: 0 }} />
                </span>
              )}
              {!broken && !round && (
                <img
                  src={item.image}
                  alt=""
                  draggable={false}
                  onError={() => setFailed((old) => (old[item.id] ? old : { ...old, [item.id]: true }))}
                  className="pointer-events-none absolute inset-0 size-full select-none object-fill"
                />
              )}
              {!broken && !round && <span ref={(node) => { shades.current[i] = node; }} aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: 0, WebkitMask: mask, mask }} />}
              <span aria-hidden="true" data-ring className={`pointer-events-none absolute -inset-[2%] rounded-[50%] border-2 ${tier.ring}`} />
              <span ref={(node) => { anchors.current[i] = node; }} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 size-0">
                <span data-chip className={`absolute bottom-[7px] left-0 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface py-1 pl-2 pr-2.5 text-[11px] font-medium leading-none text-ink shadow-[0_6px_16px_-6px_color-mix(in_oklab,var(--ink)_40%,transparent)] transition-[opacity,translate] duration-300 motion-reduce:transition-none ${isActive && lifted !== i ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}>
                  <span className={`size-1.5 rounded-full ${tier.dot}`} />
                  {item.name}
                  {item.price && <span className="tabular-nums text-muted">{item.price}</span>}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <section
      {...rest}
      ref={setSectionRef}
      data-slot="sushi-conveyor-menu"
      data-layout={wide ? "wide" : "stack"}
      data-active={active ?? ""}
      data-open={openIndex ?? ""}
      data-paused={paused || undefined}
      data-center={center}
      className={`relative isolate w-full overflow-hidden text-ink ${THEME} ${className ?? ""}`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(64% 52% at 50% 56%, color-mix(in oklab, var(--ink) 5%, transparent), transparent 72%)" }} />
      {/* one DOM for both layouts, switched by CSS at lg (= WIDE): the server render (before the
          section is measured) already has the right layout, so hydration shifts nothing */}
      <div className="mx-auto grid w-full max-w-7xl justify-items-center px-4 pt-6 pb-2 [grid-template-areas:'h''s''c''cap''a'] sm:px-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:grid-rows-[1fr_auto_auto_auto_1fr_auto] lg:items-center lg:justify-items-stretch lg:gap-x-12 lg:gap-y-6 lg:px-10 lg:pt-14 lg:pb-4 lg:[grid-template-areas:'._s''h_s''cap_s''a_s''._s''._c']">
        {/* full width below lg, so the heading lines up with the card under the belt (review 2026-11-18: indented at 768) */}
        <div className="w-full [grid-area:h] lg:w-auto lg:justify-self-start">{header}</div>
        <div className="mt-2 w-full min-w-0 [grid-area:s] lg:mt-0">{stage}</div>
        <div className="flex flex-col items-center gap-2 [grid-area:c] lg:-mt-6">
          {controls}
          {note}
        </div>
        <div className="w-full [grid-area:cap]">{captionNode}</div>
        {action && <div className="mt-3 flex justify-center [grid-area:a] lg:mt-0 lg:justify-start">{action}</div>}
      </div>
      {openIndex !== null && items[openIndex] && (
        <DishDialog
          uid={uid}
          item={items[openIndex]}
          index={openIndex}
          total={count}
          labels={labels}
          reduced={reduced}
          broken={!!failed[items[openIndex].id] || !items[openIndex].image}
          renderActions={renderActions}
          technicalDetails={technicalDetails}
          source={openSource}
          onLift={onLift}
          onAdd={onDialogAdd}
          onClose={onDialogClose}
        />
      )}
    </section>
  );
}

function DishDialog({ uid, item, index, total, labels, reduced, broken, source, onLift, onAdd, onClose, renderActions, technicalDetails }: {
  uid: string;
  item: ConveyorDish;
  index: number;
  total: number;
  labels: SushiConveyorMenuLabels;
  reduced: boolean;
  broken: boolean;
  source: () => DOMRect | null;
  onLift: (lifted: boolean) => void;
  onAdd: () => void;
  onClose: () => void;
  renderActions?: (item: ConveyorDish, close: () => void) => React.ReactNode;
  technicalDetails?: boolean;
}) {
  const dialogRef = React.useRef(null as HTMLDivElement | null);
  const figureRef = React.useRef(null as HTMLDivElement | null);
  const closeRef = React.useRef(null as HTMLButtonElement | null);
  const timer = React.useRef(0);
  const closing = React.useRef(false);
  const [shown, setShown] = React.useState(false);
  const [added, setAdded] = React.useState(false);
  const titleId = `${uid}-dish-title`;
  const tier = tierStyle(item.tier);

  React.useLayoutEffect(() => {
    const figure = figureRef.current;
    const from = source();
    closeRef.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onLift(true);
    let animation = null as Animation | null;
    if (figure && from && !reduced && from.width > 0) {
      const to = figure.getBoundingClientRect();
      const sx = from.width / to.width;
      const sy = from.height / to.height;
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      const rise = Math.min(120, Math.abs(dy) * 0.3 + 40);
      animation = figure.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transform: `translate(${dx * 0.42}px, ${dy * 0.42 - rise}px) scale(${((sx + 1) / 2) * 1.05}, ${((sy + 1) / 2) * 1.05}) rotate(${dx > 0 ? -6 : 6}deg)`, offset: 0.5 },
        { transform: "none" },
      ], { duration: 680, easing: "cubic-bezier(.22,.85,.3,1)" });
    }
    const raf = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(raf);
      animation?.cancel();
      window.clearTimeout(timer.current);
      document.body.style.overflow = overflow;
      onLift(false);
    };
  }, [source, reduced, onLift]);

  const dismiss = React.useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setShown(false);
    const figure = figureRef.current;
    const to = source();
    if (!figure || !to || reduced || to.width === 0) { onClose(); return; }
    const from = figure.getBoundingClientRect();
    const sx = to.width / from.width;
    const sy = to.height / from.height;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const animation = figure.animate([
      { transform: "none" },
      { transform: `translate(${dx * 0.58}px, ${dy * 0.58 - 36}px) scale(${(sx + 1) / 2}, ${(sy + 1) / 2})`, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
    ], { duration: 540, easing: "cubic-bezier(.45,0,.55,1)", fill: "forwards" });
    animation.onfinish = () => onClose();
  }, [source, reduced, onClose]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.contains(event.target as Node)) return;
      if (event.key === "Escape") { event.preventDefault(); dismiss(); }
      else if (event.key === "Tab") {
        const first = dialog.querySelector("button");
        if (first) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dismiss]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); dismiss(); return; }
    if (event.key !== "Tab") return;
    const controls = [...(dialogRef.current?.querySelectorAll("button") ?? [])].filter((node) => !node.disabled);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const add = () => {
    if (added || closing.current) return;
    onAdd();
    setAdded(true);
    timer.current = window.setTimeout(dismiss, reduced ? 0 : 450);
  };

  return createPortal(
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} data-dish-dialog className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 text-ink sm:p-8" onKeyDown={onKeyDown}>
      <div aria-hidden="true" className={`absolute inset-0 bg-bg/80 backdrop-blur-md transition-opacity duration-300 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`} onClick={dismiss} />
      <div className="relative grid w-full max-w-[52rem] items-center gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] sm:gap-10 sm:p-8">
        <div aria-hidden="true" className={`absolute inset-0 rounded-[2rem] border border-line bg-surface shadow-2xl transition-[opacity,scale] duration-300 motion-reduce:transition-none ${shown ? "scale-100 opacity-100" : "scale-[0.97] opacity-0"}`} />
        <button ref={closeRef} type="button" onClick={dismiss} className={`absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted outline-none transition-[opacity,color] duration-300 hover:text-ink focus-visible:ring-2 focus-visible:ring-rose motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}>
          {labels.close}
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>
        </button>
        <div ref={figureRef} data-dish-figure className={`relative mx-auto w-full ${item.cover && !broken ? "aspect-[16/10] max-w-[min(52vh,26rem)]" : "aspect-square max-w-[min(42vh,22rem)]"}`}>
          <span aria-hidden="true" className="absolute inset-x-[8%] bottom-[-4%] top-[14%] rounded-full bg-black opacity-25 blur-2xl dark:opacity-70" />
          {broken ? (
            <span aria-hidden="true" className={`absolute inset-[3%] grid place-items-center rounded-full border border-line ${tileTint(item.name)}`}>
              {item.initial ? <span className="display -rotate-6 text-[7rem] leading-none font-[650]">{item.initial}</span> : <span className="absolute inset-[30%] rounded-full bg-muted/25" />}
            </span>
          ) : item.cover ? (
            <img src={item.image} alt={item.name} draggable={false} className="relative size-full select-none rounded-[1.4rem] border border-line object-cover object-top shadow-xl" />
          ) : (
            <img src={item.image} alt={item.name} draggable={false} className="relative size-full select-none object-contain" />
          )}
          <span aria-hidden="true" className={`absolute -inset-[1.5%] border-[3px] ${item.cover && !broken ? "rounded-[1.6rem]" : "rounded-full"} ${tier.ring}`} />
        </div>
        <div className={`relative flex flex-col gap-3 text-center transition-[opacity,translate] delay-150 duration-500 motion-reduce:transition-none sm:text-left ${shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
          <p className="flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.2em] text-muted sm:justify-start">
            <span aria-hidden="true" className={`size-2 rounded-full ${tier.dot}`} />
            {pad(index + 1)} / {pad(total)}
          </p>
          <h3 id={titleId} className="text-2xl font-medium tracking-tight sm:text-3xl">{item.name}</h3>
          {item.description && <p className="text-sm leading-relaxed text-muted">{item.description}</p>}
          {item.details && item.details.length > 0 && (
            <ul translate={technicalDetails ? "no" : undefined} lang={technicalDetails ? "en" : undefined} className={`flex flex-wrap justify-center gap-2 sm:justify-start ${technicalDetails ? "notranslate" : ""}`}>
              {item.details.map((detail) => <li key={detail} className="rounded-full border border-line px-3 py-1 text-xs text-muted">{detail}</li>)}
            </ul>
          )}
          {renderActions ? (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 sm:justify-start">{renderActions(item, dismiss)}</div>
          ) : (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
            {item.price && <p className="text-2xl font-semibold tabular-nums tracking-tight">{item.price}</p>}
            <button type="button" data-add onClick={add} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg shadow-sm outline-none transition-[translate,box-shadow] hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:transition-none">
              {added
                ? <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
                : <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3.5v9M3.5 8h9" /></svg>}
              {labels.add}
            </button>
          </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default SushiConveyorMenu;
