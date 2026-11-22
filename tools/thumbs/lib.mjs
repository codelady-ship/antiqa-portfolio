// Pure helpers of the thumbnail tool (no browser, no network): unit-tested in lib.test.mjs.
import sharp from "sharp";

/** Every thumbnail on the belt: 960×600 WebP (frontend/public/projects). */
export const OUT = { width: 960, height: 600 };

/**
 * The fixed screenshots the site uses, read from THUMBS in project-conveyor.tsx:
 * [{ key: "jeparla", file: "jeparla.webp" }, …]. The component stays the single list of them.
 */
export function parseThumbs(source) {
  const block = /const THUMBS[^=]*=\s*\{([\s\S]*?)\n\};/.exec(source)?.[1];
  if (block === undefined) throw new Error("THUMBS not found in project-conveyor.tsx");
  const out = [];
  for (const line of block.split("\n")) {
    if (/^\s*\/\//.test(line)) continue;
    const m = /^\s*(?:"([^"]+)"|([A-Za-z0-9_-]+))\s*:\s*"\/projects\/([A-Za-z0-9._-]+\.webp)"/.exec(line);
    if (m) out.push({ key: (m[1] ?? m[2]).toLowerCase(), file: m[3] });
  }
  if (!out.length) throw new Error("THUMBS has no entries the tool can read");
  return out;
}

/** The capture settings of one project: the defaults, then its entry in thumbs.config.mjs. */
export function resolveConfig(defaults, entry) {
  return { ...defaults, ...(entry ?? {}), viewport: { ...defaults.viewport, ...(entry?.viewport ?? {}) } };
}

/** The word a page must show to count as the project's own page: its config value or the first word of its title. */
export function landmark(cfg, title) {
  if (cfg.expectText === false) return "";
  if (typeof cfg.expectText === "string") return cfg.expectText;
  return (String(title ?? "").split(/[^\p{L}\p{N}]+/u).find((w) => w.length >= 3) ?? "").toLowerCase();
}

/* ---------- comparing two pictures ---------- */

const SIG = { width: 240, height: 150 };

/** A small RGB version of a picture (any format sharp reads), for comparing. */
export async function signature(input) {
  return sharp(input).removeAlpha().resize(SIG.width, SIG.height, { fit: "fill", kernel: "cubic" }).raw().toBuffer();
}

// the picture cut into 6 × 5 regions (160×120 px of the 960×600 thumbnail each) for `tile` below
const GRID = { cols: 6, rows: 5 };

/**
 * How different two signatures are: `share` = the part of the picture (0…1) whose colour moved by
 * more than `step` levels (of 255) on some channel, `tile` = the same for the most-changed of the
 * 6 × 5 regions, `mean` = the average move. Text that is drawn a little differently (anti-aliasing,
 * lossy WebP) barely registers; a new hero, layout or headline does, and so does a change confined to
 * one part of the picture (a redrawn side menu, a new logo) through `tile`.
 */
export function difference(a, b, step = 40) {
  if (a.length !== b.length) throw new Error("signatures differ in size");
  if (a.length !== SIG.width * SIG.height * 3) throw new Error("not a signature");
  const movedIn = new Array(GRID.cols * GRID.rows).fill(0);
  const sizeOf = new Array(GRID.cols * GRID.rows).fill(0);
  let moved = 0;
  let sum = 0;
  for (let i = 0; i < a.length; i += 3) {
    const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    const px = i / 3;
    const region = Math.floor((Math.floor(px / SIG.width) * GRID.rows) / SIG.height) * GRID.cols + Math.floor(((px % SIG.width) * GRID.cols) / SIG.width);
    sizeOf[region]++;
    sum += d;
    if (d > step) {
      moved++;
      movedIn[region]++;
    }
  }
  const n = a.length / 3;
  return { share: moved / n, tile: Math.max(...movedIn.map((m, r) => m / sizeOf[r])), mean: sum / n };
}

/** Is it a picture of nothing? (one flat colour, or close to it: a blank page, a white error screen) */
export function flatness(sig) {
  const n = sig.length / 3;
  const buckets = new Map();
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < sig.length; i += 3) {
    const y = 0.299 * sig[i] + 0.587 * sig[i + 1] + 0.114 * sig[i + 2];
    sum += y;
    sq += y * y;
    const k = ((sig[i] >> 4) << 8) | ((sig[i + 1] >> 4) << 4) | (sig[i + 2] >> 4);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const mean = sum / n;
  return { contrast: Math.sqrt(Math.max(0, sq / n - mean * mean)), topShare: Math.max(...buckets.values()) / n, colours: buckets.size };
}

/* ---------- is this the real page? ---------- */

// said by a host that is asleep, starting or gone, wherever it appears in the first screen of text
const HOST_PAGES = [
  /service (is )?(waking up|unavailable|suspended)/i,
  /(application|app|service|instance) (is )?(loading|starting|waking|spinning up)/i,
  /your (free )?(instance|app|service) (is|will) (spin|wak|start)/i,
  /waking up|spinning up|cold start/i,
  /there isn'?t a github pages site here/i,
  /deployment[_ ]not[_ ]found|this deployment (cannot|could not) be found/i,
  /application error|internal server error|bad gateway|gateway time-?out|service temporarily unavailable/i,
  /welcome to nginx|apache2 (ubuntu|debian) default page|it works!/i,
  /this site can'?t be reached|err_[a-z_]+|dns_probe/i,
  /checking your browser|just a moment\.\.\.|verify you are human|attention required/i,
  /domain (is )?(for sale|parked|expired)|account (has been )?suspended/i,
];
// generic error words: only in the title, or when the page says almost nothing else
const ERROR_WORDS = /\b(404|403|500|502|503|504)\b|not found|page (could not|cannot|can't) be found|forbidden|error|tapılmadı|xəta/i;

/** Why the page's words say it is not the project's real page ("" = fine). */
export function looksBroken(title, text) {
  const head = `${title}\n${text.slice(0, 2000)}`;
  const host = HOST_PAGES.find((r) => r.test(head));
  if (host) return `the page reads like a host or error page (${host.exec(head)[0].trim().toLowerCase()})`;
  if (ERROR_WORDS.test(title)) return `the page title reads like an error ("${title.slice(0, 60)}")`;
  if (text.trim().length < 200 && ERROR_WORDS.test(text)) return "the page is nearly empty and reads like an error";
  return "";
}

/** Did the browser end up somewhere else than asked? (another site, or a sign-in page) */
export function wrongPlace(asked, final) {
  let a, f;
  try {
    a = new URL(asked);
    f = new URL(final);
  } catch {
    return `ended on an unreadable address`;
  }
  if (a.hostname !== f.hostname) return `was sent to another site (${f.hostname})`;
  const gate = /(^|\/)(login|log-in|signin|sign-in|auth|sso)(\/|$)/i;
  if (gate.test(f.pathname) && !gate.test(a.pathname)) return `was sent to a sign-in page (${f.pathname})`;
  return "";
}

/**
 * What to do with a fresh capture. `old` is null when the file does not exist yet.
 * Returns { action: "keep" | "replace" | "create", reason }.
 */
export function decide({ problems, pair, old, limits }) {
  if (problems.length) return { action: "keep", reason: problems.join("; ") };
  if (pair.share > limits.stableShare || (pair.tile ?? 0) > limits.stableTile) {
    return { action: "keep", reason: `two captures in a row differ (${pct(pair.share)} of the picture, ${pct(pair.tile ?? 0)} of one part): the page is still moving, see "settleMs" / "animationsAt" / "videoAt" in the config` };
  }
  if (!old) return { action: "create", reason: "no picture yet" };
  const numbers = `${pct(old.share)} of the picture, ${pct(old.tile ?? 0)} of its most-changed part; limits ${pct(limits.changeShare)} / ${pct(limits.changeTile)}`;
  if (old.share > limits.changeShare || (old.tile ?? 0) > limits.changeTile) return { action: "replace", reason: `changed (${numbers})` };
  return { action: "keep", reason: `same as the committed picture (${numbers})` };
}

export const pct = (x) => `${(x * 100).toFixed(1)}%`;

/** The capture as the site's WebP (960×600). */
export function toWebp(png) {
  return sharp(png).resize(OUT.width, OUT.height, { fit: "fill", kernel: "lanczos3" }).webp({ quality: 82, effort: 6 }).toBuffer();
}
