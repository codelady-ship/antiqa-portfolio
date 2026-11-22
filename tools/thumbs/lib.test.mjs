import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { decide, difference, flatness, landmark, looksBroken, OUT, parseThumbs, resolveConfig, signature, toWebp, wrongPlace } from "./lib.mjs";
import { DEFAULTS, LIMITS, PROJECTS } from "./thumbs.config.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const thumbs = parseThumbs(readFileSync(path.join(repo, "frontend/src/components/work/project-conveyor.tsx"), "utf8"));

/** a flat picture with optional rectangles: [{ left, top, width, height, color }] */
const picture = (color, boxes = []) =>
  sharp({ create: { width: 960, height: 600, channels: 3, background: color } })
    .composite(boxes.map((b) => ({ input: { create: { width: b.width, height: b.height, channels: 3, background: b.color } }, left: b.left, top: b.top })))
    .png()
    .toBuffer();
const page = () => picture("#f5f0e8", [{ left: 100, top: 80, width: 500, height: 90, color: "#222222" }, { left: 100, top: 300, width: 300, height: 200, color: "#c8963c" }]);

test("THUMBS in project-conveyor.tsx is readable", () => {
  assert.ok(thumbs.length >= 7);
  assert.deepEqual(thumbs.find((t) => t.key === "jeparla"), { key: "jeparla", file: "jeparla.webp" });
  assert.deepEqual(thumbs.find((t) => t.key === "ecommerse-app"), { key: "ecommerse-app", file: "hueline.webp" });
});

test("parseThumbs skips commented lines and refuses a file without THUMBS", () => {
  const src = 'const THUMBS: Record<string, string> = {\n  // old: "/projects/old.webp",\n  a: "/projects/a.webp",\n  "B-c": "/projects/b.webp",\n};\n';
  assert.deepEqual(parseThumbs(src), [{ key: "a", file: "a.webp" }, { key: "b-c", file: "b.webp" }]);
  assert.throws(() => parseThumbs("const X = {};"));
});

test("every config entry belongs to a project in THUMBS and frames a 16:10 picture inside its viewport", () => {
  for (const [key, entry] of Object.entries(PROJECTS)) {
    assert.ok(thumbs.some((t) => t.key === key), `${key} is not in THUMBS`);
    if (entry.pinned) continue;
    const cfg = resolveConfig(DEFAULTS, entry);
    const box = cfg.clip ?? { x: 0, y: 0, ...cfg.viewport };
    assert.ok(Math.abs(box.width / box.height - OUT.width / OUT.height) < 0.005, `${key}: not 16:10`);
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= cfg.viewport.width && box.y + box.height <= cfg.viewport.height, `${key}: clip outside the viewport`);
  }
});

test("resolveConfig: a project without an entry gets the defaults", () => {
  assert.deepEqual(resolveConfig(DEFAULTS, undefined), DEFAULTS);
  assert.deepEqual(resolveConfig(DEFAULTS, { viewport: { width: 1440, height: 900 } }).viewport, { width: 1440, height: 900 });
});

test("landmark: the configured word, else the first word of the title", () => {
  assert.equal(landmark({}, "Ember & Olive"), "ember");
  assert.equal(landmark({}, "AFN Rent a Car"), "afn");
  assert.equal(landmark({ expectText: "hue" }, "HUELINE"), "hue");
  assert.equal(landmark({ expectText: false }, "Jeparla"), "");
  assert.equal(landmark({}, undefined), "");
});

test("the same picture as PNG and as lossy WebP counts as unchanged", async () => {
  const png = await page();
  const d = difference(await signature(png), await signature(await toWebp(png)), LIMITS.step);
  assert.ok(d.share <= LIMITS.changeShare / 10, `share ${d.share}`);
});

test("toWebp keeps the site's size and format", async () => {
  const meta = await sharp(await toWebp(await sharp({ create: { width: 832, height: 520, channels: 3, background: "#888" } }).png().toBuffer())).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ["webp", 960, 600]);
});

test("a new headline block is a change, a one-pixel shift is not", async () => {
  const base = await signature(await page());
  const shifted = await signature(await picture("#f5f0e8", [{ left: 101, top: 80, width: 500, height: 90, color: "#222222" }, { left: 100, top: 300, width: 300, height: 200, color: "#c8963c" }]));
  assert.ok(difference(base, shifted, LIMITS.step).share <= LIMITS.changeShare);
  const redesigned = await signature(await picture("#f5f0e8", [{ left: 100, top: 80, width: 500, height: 90, color: "#222222" }, { left: 500, top: 300, width: 300, height: 200, color: "#3050c0" }]));
  assert.ok(difference(base, redesigned, LIMITS.step).share > LIMITS.changeShare);
});

test("a change confined to one part of the picture (a redrawn side menu) counts through `tile`", async () => {
  const base = await signature(await page());
  const menu = await signature(await picture("#f5f0e8", [{ left: 100, top: 80, width: 500, height: 90, color: "#222222" }, { left: 100, top: 300, width: 300, height: 200, color: "#c8963c" }, { left: 820, top: 20, width: 100, height: 60, color: "#3050c0" }]));
  const d = difference(base, menu, LIMITS.step);
  assert.ok(d.share <= LIMITS.changeShare, `share ${d.share}`);
  assert.ok(d.tile > LIMITS.changeTile, `tile ${d.tile}`);
  assert.equal(decide({ problems: [], pair: { share: 0, tile: 0 }, old: d, limits: LIMITS }).action, "replace");
  assert.equal(difference(base, base, LIMITS.step).tile, 0);
});

test("flatness tells a blank page from a real one", async () => {
  const blank = flatness(await signature(await picture("#ffffff")));
  assert.ok(blank.contrast < 6 && blank.topShare > 0.97);
  const real = flatness(await signature(await page()));
  assert.ok(real.contrast >= 6 && real.topShare <= 0.97 && real.colours >= 4);
});

test("looksBroken: host, error and waking-up pages", () => {
  assert.equal(looksBroken("Jeparla — qızıl, gümüş və brilyant zərgərlik", "Kataloq Mağazalar ".repeat(40)), "");
  assert.equal(looksBroken("Food Wagon – Food delivery in Baku", "HOW IT WORKS · Delivered warm & fast. ".repeat(20)), "");
  assert.ok(looksBroken("404: NOT_FOUND", "DEPLOYMENT_NOT_FOUND"));
  assert.ok(looksBroken("Site not found · GitHub Pages", "There isn't a GitHub Pages site here."));
  assert.ok(looksBroken("502 Bad Gateway", "nginx"));
  assert.ok(looksBroken("Welcome to nginx!", "Welcome to nginx! If you see this page, the nginx web server is successfully installed."));
  assert.ok(looksBroken("My app", "Your free instance will spin up shortly"));
  assert.ok(looksBroken("", "Service waking up…"));
  assert.ok(looksBroken("Just a moment...", "Checking your browser before accessing the site"));
  assert.ok(looksBroken("App", "Not found"));
  // a long real page that merely mentions an error word is fine
  assert.equal(looksBroken("Code Check", `${"Question 1 of 10. ".repeat(30)} What does a 404 error mean?`), "");
});

test("wrongPlace: another site or a sign-in page", () => {
  assert.equal(wrongPlace("https://jeparla.duckdns.org/az", "https://jeparla.duckdns.org/az"), "");
  assert.equal(wrongPlace("https://a.example/", "https://a.example/az/"), "");
  assert.ok(wrongPlace("https://a.example/", "https://parked.example/"));
  assert.ok(wrongPlace("https://a.example/az/merchant", "https://a.example/az/login"));
  assert.equal(wrongPlace("https://a.example/login?demo=admin", "https://a.example/login"), "");
});

test("decide: keep on any doubt, replace only a steady and really different picture", () => {
  const steady = { share: 0, mean: 0 };
  const limits = LIMITS;
  assert.equal(decide({ problems: ["HTTP 503"], pair: steady, old: { share: 0.9 }, limits }).action, "keep");
  assert.equal(decide({ problems: [], pair: { share: limits.stableShare * 2 }, old: { share: 0.9 }, limits }).action, "keep");
  assert.equal(decide({ problems: [], pair: steady, old: { share: limits.changeShare / 2 }, limits }).action, "keep");
  assert.equal(decide({ problems: [], pair: steady, old: { share: limits.changeShare * 2 }, limits }).action, "replace");
  assert.equal(decide({ problems: [], pair: steady, old: { share: 0, tile: limits.changeTile / 2 }, limits }).action, "keep");
  assert.equal(decide({ problems: [], pair: steady, old: { share: 0, tile: limits.changeTile * 2 }, limits }).action, "replace");
  // one part still moving (a carousel) is not steady
  assert.equal(decide({ problems: [], pair: { share: 0, tile: limits.stableTile * 2 }, old: { share: 0.9 }, limits }).action, "keep");
  assert.equal(decide({ problems: [], pair: steady, old: null, limits }).action, "create");
  assert.equal(decide({ problems: ["HTTP 503"], pair: steady, old: null, limits }).action, "keep");
});
