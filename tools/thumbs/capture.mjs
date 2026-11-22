#!/usr/bin/env node
/**
 * Keeps the project belt's fixed screenshots in step with the live sites.
 *
 *   node capture.mjs [--dry-run] [--only jeparla,kirayla-rental] [--out <dir>]
 *
 * For every project in THUMBS (frontend/src/components/work/project-conveyor.tsx) it opens the live
 * demo in headless Chromium, as set in thumbs.config.mjs, and takes the picture twice. The file in
 * frontend/public/projects/ is replaced only when
 *   - the page is the real one: HTTP 200, the right site, no sign-in / error / "waking up" page, no
 *     cookie or modal layer over it, the project's name on it, not a blank picture (a host that is
 *     asleep gets two more tries, 20 s and 40 s later), and
 *   - both captures agree (the page has stopped moving), and
 *   - the picture differs from the committed one by more than LIMITS.changeShare.
 * In every other case the committed picture stays. Same size, format and file name: 960×600 WebP.
 *
 *   --dry-run  never writes into frontend/public (the report and the before / after pictures still go to --out)
 *   --only     repo names, comma-separated
 *   --out      report directory (default ./out): report.json, summary.md, <name>.before.png, <name>.after.png
 *
 * Exit code 1 when a project could not be checked (its old picture stays), so the scheduled run shows
 * red and GitHub mails the owner; 0 otherwise, changed or not.
 * PORTFOLIO_API overrides the project list address. Needs no secrets.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import { decide, difference, flatness, landmark, looksBroken, OUT, parseThumbs, pct, resolveConfig, signature, toWebp, wrongPlace } from "./lib.mjs";
import { DEFAULTS, LIMITS, PROJECTS } from "./thumbs.config.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const THUMBS_SOURCE = path.join(repo, "frontend/src/components/work/project-conveyor.tsx");
const PUBLIC_DIR = path.join(repo, "frontend/public/projects");
const API = process.env.PORTFOLIO_API || "https://antiqa-portfolio-api.vercel.app/api/projects";
const RETRY_WAITS = [0, 20_000, 40_000];

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? "") : null;
};
const dryRun = args.includes("--dry-run");
const only = flag("--only")?.toLowerCase().split(",").map((x) => x.trim()).filter(Boolean) ?? null;
const outDir = path.resolve(flag("--out") || path.join(here, "out"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const msg = (e) => (e instanceof Error ? e.message.split("\n")[0] : String(e));

/** The portfolio's own project list: live demo link and title per repo (lower-case name). */
async function fetchProjects() {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(API, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
      if (r.ok) return new Map((await r.json()).map((p) => [String(p.name).toLowerCase(), p]));
    } catch {
      /* cold start: try again */
    }
    await sleep(5000);
  }
  return null;
}

/** One visit: opens the page as configured and returns the picture with what was seen on the way. */
async function shoot(browser, url, cfg, want) {
  const context = await browser.newContext({
    viewport: cfg.viewport,
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "Asia/Baku",
    reducedMotion: cfg.reducedMotion ? "reduce" : "no-preference",
  });
  const problems = [];
  try {
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "load", timeout: 45_000 });
    const status = response?.status() ?? 0;
    if (status !== 200) problems.push(`HTTP ${status || "no answer"}`);
    const place = wrongPlace(url, page.url());
    if (place) problems.push(place);
    // quiet network and loaded fonts, but never wait for them for ever (a site with a live socket is never idle)
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});

    for (const step of cfg.steps) {
      if (step.click) {
        const target = page.locator(step.click).first();
        const there = await target.waitFor({ state: "visible", timeout: step.optional ? 4000 : 15_000 }).then(() => true, () => false);
        if (there) await target.click({ timeout: 5000 }).catch((e) => problems.push(`step click ${step.click}: ${msg(e)}`));
        else if (!step.optional) problems.push(`step click ${step.click}: not on the page`);
      } else if (step.press) await page.keyboard.press(step.press);
      else if (step.wait) await page.waitForTimeout(step.wait);
      else if (step.waitFor) await page.locator(step.waitFor).first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => problems.push(`step waitFor ${step.waitFor}: never showed`));
    }
    if (cfg.hide.length) await page.addStyleTag({ content: `${cfg.hide.join(",")}{display:none!important}` });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(cfg.settleMs);
    if (cfg.videoAt !== null) {
      await page.evaluate(
        (at) =>
          Promise.all(
            [...document.querySelectorAll("video")].map(
              (v) =>
                new Promise((done) => {
                  v.pause();
                  v.addEventListener("seeked", () => done(), { once: true });
                  v.currentTime = at;
                  setTimeout(done, 4000);
                }),
            ),
          ),
        cfg.videoAt,
      );
      await page.waitForTimeout(400);
    }

    const seen = await page.evaluate(() => {
      const inView = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 40 && r.height > 20 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.05;
      };
      const named = (el) => `${el.id} ${typeof el.className === "string" ? el.className : ""} ${el.getAttribute("aria-label") ?? ""}`;
      // a cookie / consent layer, or an open modal, over the first view
      const consent = [...document.querySelectorAll("body *")].find((el) => /cookie|consent|gdpr|onetrust|cookiebot|\bcmp\b/i.test(named(el)) && inView(el) && /fixed|sticky/.test(getComputedStyle(el).position));
      const modal = [...document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"]')].find(inView);
      return { title: document.title, text: document.body?.innerText ?? "", consent: consent ? named(consent).trim().slice(0, 60) : "", modal: modal ? (modal.getAttribute("aria-label") ?? modal.id ?? "dialog").slice(0, 60) : "" };
    });
    if (seen.consent) problems.push(`a cookie / consent layer is over the page (${seen.consent})`);
    if (seen.modal) problems.push(`a dialog is open over the page (${seen.modal})`);
    const broken = looksBroken(seen.title, seen.text);
    if (broken) problems.push(broken);
    if (want && !`${seen.title}\n${seen.text}`.toLowerCase().includes(want.toLowerCase())) problems.push(`"${want}" is nowhere on the page`);

    const png = await page.screenshot({ type: "png", ...(cfg.clip && { clip: cfg.clip }), animations: "allow", caret: "hide" });
    return { png, problems, status, finalUrl: page.url() };
  } catch (e) {
    return { png: null, problems: [...problems, msg(e)], status: 0, finalUrl: url };
  } finally {
    await context.close();
  }
}

/** Two agreeing, healthy captures of one project, with retries for a host that is waking up. */
async function capture(browser, url, cfg, want) {
  let last = null;
  for (const [i, wait] of RETRY_WAITS.entries()) {
    if (wait) {
      console.log(`    try ${i + 1} in ${wait / 1000} s (${last.problems.join("; ")})`);
      await sleep(wait);
    }
    const a = await shoot(browser, url, cfg, want);
    const sigA = a.png && (await signature(a.png));
    if (sigA) {
      const f = flatness(sigA);
      if (f.contrast < 6 || f.topShare > 0.97 || f.colours < 4) a.problems.push(`the picture is blank or one flat colour (contrast ${f.contrast.toFixed(1)}, ${pct(f.topShare)} one colour)`);
    }
    last = { ...a, sig: sigA, pair: { share: 0, mean: 0 }, tries: i + 1 };
    if (a.problems.length) continue;
    const b = await shoot(browser, url, cfg, want);
    if (b.problems.length || !b.png) {
      last.problems = b.problems.length ? b.problems : ["the second capture failed"];
      continue;
    }
    last.pair = difference(sigA, await signature(b.png), LIMITS.step);
    if (last.pair.share <= LIMITS.stableShare) break;
    last.problems = []; // unstable is decided (and worded) by decide(); try again in case it was a late animation
  }
  return last;
}

function checkClip(cfg) {
  const c = cfg.clip;
  if (!c) {
    if (Math.abs(cfg.viewport.width / cfg.viewport.height - OUT.width / OUT.height) > 0.005) return "viewport is not 16:10";
    return "";
  }
  if (Math.abs(c.width / c.height - OUT.width / OUT.height) > 0.005) return "clip is not 16:10";
  if (c.x < 0 || c.y < 0 || c.x + c.width > cfg.viewport.width || c.y + c.height > cfg.viewport.height) return "clip is outside the viewport";
  return "";
}

async function main() {
  const thumbs = parseThumbs(await readFile(THUMBS_SOURCE, "utf8"));
  const unknown = Object.keys(PROJECTS).filter((k) => !thumbs.some((t) => t.key === k));
  if (unknown.length) console.log(`note: thumbs.config.mjs has entries that are not in THUMBS (ignored): ${unknown.join(", ")}`);
  const list = thumbs.filter((t) => !only || only.includes(t.key));
  if (!list.length) throw new Error("--only matched no project in THUMBS");
  await mkdir(outDir, { recursive: true });

  const projects = await fetchProjects();
  if (!projects) console.log("note: the portfolio API did not answer; only projects with a url in thumbs.config.mjs can be captured");

  const browser = await chromium.launch();
  const rows = [];
  try {
    for (const { key, file } of list) {
      const entry = PROJECTS[key];
      const cfg = resolveConfig(DEFAULTS, entry);
      const target = path.join(PUBLIC_DIR, file);
      const row = { key, file, url: "", action: "keep", attention: false, reason: "", tries: 0, vsOld: null, pair: null };
      rows.push(row);
      console.log(`\n${key} → ${file}`);
      if (cfg.pinned) {
        row.reason = `pinned: ${cfg.pinned}`;
        console.log(`  kept (${row.reason})`);
        continue;
      }
      if (!entry) console.log(`  no entry in tools/thumbs/thumbs.config.mjs: using the defaults (first view of the live demo at ${DEFAULTS.viewport.width}×${DEFAULTS.viewport.height}). Add an entry to frame it differently.`);
      const api = projects?.get(key);
      const url = cfg.url || api?.demoUrl || "";
      row.url = url;
      const bad = !url ? (projects ? (api ? "the project has no live demo link (coming soon or switched off)" : "the project is not in the portfolio's list") : "the portfolio API did not answer") : checkClip(cfg);
      if (bad) {
        row.attention = true;
        row.reason = bad;
        console.log(`  KEPT, needs a look: ${bad}`);
        continue;
      }

      const shot = await capture(browser, url, cfg, landmark(cfg, api?.title));
      const oldBytes = existsSync(target) ? await readFile(target) : null;
      const webp = shot.png && (await toWebp(shot.png));
      // compared as the visitor would get it: the new WebP against the committed WebP
      const old = oldBytes && webp ? difference(await signature(oldBytes), await signature(webp), LIMITS.step) : null;
      const verdict = decide({ problems: shot.problems, pair: shot.pair, old: oldBytes ? (old ?? { share: 0, mean: 0 }) : null, limits: LIMITS });
      Object.assign(row, { action: verdict.action, reason: verdict.reason, tries: shot.tries, vsOld: old, pair: shot.pair });
      row.attention = verdict.action === "keep" && (shot.problems.length > 0 || shot.pair.share > LIMITS.stableShare);

      if (oldBytes) await sharp(oldBytes).png().toFile(path.join(outDir, `${path.parse(file).name}.before.png`));
      if (webp) await sharp(webp).png().toFile(path.join(outDir, `${path.parse(file).name}.after.png`));
      if (verdict.action !== "keep" && !dryRun) await writeFile(target, webp);
      const did = verdict.action === "keep" ? (row.attention ? "KEPT, needs a look" : "kept") : `${verdict.action === "create" ? "created" : "replaced"}${dryRun ? " (dry run: not written)" : ""}`;
      console.log(`  ${did}: ${verdict.reason}`);
    }
  } finally {
    await browser.close();
  }

  const changed = rows.filter((r) => r.action !== "keep");
  const attention = rows.filter((r) => r.attention);
  const num = (d) => (d ? pct(d.share) : "–");
  const summary = [
    `### Project thumbnails${dryRun ? " (dry run)" : ""}`,
    "",
    "| project | file | result | vs committed | two captures | tries | why |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r.key} | ${r.file} | ${r.attention ? "**kept, needs a look**" : r.action === "keep" ? "kept" : r.action === "create" ? "created" : "replaced"} | ${num(r.vsOld)} | ${num(r.pair)} | ${r.tries || "–"} | ${r.reason.replace(/\|/g, "/")} |`),
    "",
    `Changed: ${changed.map((r) => r.key).join(", ") || "none"}. Needs a look: ${attention.map((r) => r.key).join(", ") || "none"}.`,
    "",
  ].join("\n");
  await writeFile(path.join(outDir, "report.json"), JSON.stringify({ dryRun, limits: LIMITS, rows }, null, 2));
  await writeFile(path.join(outDir, "summary.md"), summary);
  // for the workflow's commit message
  await writeFile(path.join(outDir, "changed.txt"), changed.map((r) => r.key).join(", "));
  console.log(`\n${summary}`);
  for (const r of attention) console.log(`::warning title=Thumbnail kept (${r.key})::${r.reason}`);
  return attention.length ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e) => {
    console.error(`error: ${msg(e)}`);
    process.exitCode = 2;
  },
);
