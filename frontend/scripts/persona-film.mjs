#!/usr/bin/env node
/**
 * Builds the scroll-scrubbed persona film (owner's "AI Character Portfolio" guide, 2026-11-16) from
 * the Google Flow clips: joins clip1 … clipN with a short cross-fade, removes the Veo watermark,
 * encodes two web files where EVERY frame is a keyframe (instant seeks while scrolling) and a
 * poster, then prints the PERSONA.film block for src/components/persona/config.ts.
 *
 *   node scripts/persona-film.mjs <clip1.mp4> <clip2.mp4> … [options]      (run from frontend/)
 *
 * Options:
 *   --out <dir>          output folder (default public/persona/film)
 *   --sections a,b,…     the site section each clip ENDS in: hero | about | work | contact | - (none).
 *                        Default for 4 clips: hero,about,-,work; 5 clips: hero,about,-,work,contact
 *                        (docs/FLOW-PERSONA-PROMPTS.md clip plan: 3 = the desk, between About and Projects)
 *   --fade <s>           cross-fade between clips (default 0.25)
 *   --fps <n>            frame rate of the film (default 24)
 *   --delogo x:y:w:h     blur out a box in the 1280×720 frame. Off by default: the Veo watermark
 *                        stays unless you pass this, and only after checking that your Flow/Veo plan
 *                        allows removing it (Veo's corner mark is about 1160:672:104:36)
 *   --ffmpeg <path>      ffmpeg binary (default: $FFMPEG, then "ffmpeg" on PATH, then the WinGet
 *                        Gyan build as a last resort); ffprobe is taken from the same folder
 *   --force              replace an existing film in --out
 *
 * Output: film-1280.mp4 (desktop, CRF 27), film-854.mp4 (a smaller encode, kept for a later phone
 * version), poster.jpg (first frame, 1280 px). H.264, -g 1 (all keyframes), +faststart, no audio.
 * Warns when a file is larger than the site should download (all-keyframe video is big).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const flags = new Set(["--force"]);
const valued = new Set(["--out", "--sections", "--fade", "--fps", "--delogo", "--ffmpeg"]);
const clips = [];
for (let i = 0; i < args.length; i++) {
  if (valued.has(args[i])) i++;
  else if (!flags.has(args[i])) clips.push(args[i]);
}
if (clips.length < 2) {
  console.error("usage: node scripts/persona-film.mjs <clip1.mp4> <clip2.mp4> … [--sections hero,about,-,work] [--out public/persona/film] [--fade 0.25] [--delogo x:y:w:h|none] [--ffmpeg path] [--force]");
  process.exit(1);
}
for (const c of clips) if (!existsSync(c)) throw new Error(`no such clip: ${c}`);

/** --ffmpeg, $FFMPEG, "ffmpeg" on PATH, then any WinGet Gyan build (whatever its version) */
function findFfmpeg() {
  const given = opt("--ffmpeg", process.env.FFMPEG);
  if (given) return given;
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0) return "ffmpeg";
  const base = process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Microsoft/WinGet/Packages");
  const pkg = base && existsSync(base) && readdirSync(base).find((d) => d.startsWith("Gyan.FFmpeg"));
  const build = pkg && readdirSync(join(base, pkg)).find((d) => d.startsWith("ffmpeg-"));
  const exe = build && join(base, pkg, build, "bin", "ffmpeg.exe");
  if (exe && existsSync(exe)) return exe;
  throw new Error("ffmpeg not found: install it (winget install Gyan.FFmpeg), or pass --ffmpeg <path> / set FFMPEG");
}
const ffmpeg = findFfmpeg();
const ffprobe = ffmpeg.includes("/") || ffmpeg.includes("\\") ? join(dirname(ffmpeg), `ffprobe${ffmpeg.endsWith(".exe") ? ".exe" : ""}`) : "ffprobe";
const out = resolve(opt("--out", "public/persona/film"));
const fade = Number(opt("--fade", "0.25"));
const fps = Number(opt("--fps", "24"));
const delogo = opt("--delogo", "none");
const sections = (opt("--sections", clips.length === 5 ? "hero,about,-,work,contact" : clips.length === 4 ? "hero,about,-,work" : "") || "").split(",").filter(Boolean);
if (sections.length !== clips.length) throw new Error(`--sections needs one entry per clip (${clips.length})`);
const KNOWN = new Set(["hero", "about", "work", "contact", "-"]);
for (const s of sections) if (!KNOWN.has(s)) throw new Error(`unknown section "${s}" (hero | about | work | contact | -)`);
for (const need of ["hero", "about", "work"]) if (!sections.includes(need)) throw new Error(`--sections must contain ${need}`);

mkdirSync(out, { recursive: true });
const files = ["film-1280.mp4", "film-854.mp4", "poster.jpg"];
const existing = files.filter((f) => existsSync(join(out, f)));
if (existing.length && !args.includes("--force")) {
  console.error(`${out} already has ${existing.join(", ")}. Add --force to replace them.`);
  process.exit(1);
}

const duration = (f) => Number(execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());
const lens = clips.map(duration);
if (lens.some((d) => !(d > fade * 2))) throw new Error(`every clip must be longer than ${fade * 2}s`);

// each input → 1280×720 at one frame rate (xfade needs equal sizes, rates and formats)
const norm = clips.map((_, i) => `[${i}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=${fps},setsar=1,format=yuv420p,settb=AVTB[n${i}]`);
// xfade chain: the k-th fade starts where the film so far ends, minus the fade
const chain = [];
const marks = [];
let prev = "n0",
  total = lens[0];
for (let k = 1; k < clips.length; k++) {
  const offset = total - fade;
  marks.push(offset); // clip k (1-based) has reached its last pose where the fade starts
  chain.push(`[${prev}][n${k}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(3)}[x${k}]`);
  prev = `x${k}`;
  total = offset + lens[k];
}
marks.push(Math.max(0, total - 1 / fps)); // the last clip's end
const logo = delogo === "none" ? "" : (() => {
  const [x, y, w, h] = delogo.split(":").map(Number);
  if ([x, y, w, h].some((v) => !Number.isFinite(v))) throw new Error("--delogo needs x:y:w:h");
  return `,delogo=x=${x}:y=${y}:w=${w}:h=${h}`;
})();
const graph = [...norm, ...chain, `[${prev}]null${logo},split=2[a][b]`, "[a]scale=1280:-2[o1]", "[b]scale=854:-2[o2]"].join(";");
const enc = (crf) => ["-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-g", "1", "-keyint_min", "1", "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"];

console.log(`joining ${clips.length} clips (${lens.map((d) => d.toFixed(2)).join(" + ")} s, ${fade} s fades) …`);
execFileSync(
  ffmpeg,
  ["-y", "-v", "error", ...clips.flatMap((c) => ["-i", c]), "-filter_complex", graph, "-map", "[o1]", ...enc(27), join(out, "film-1280.mp4"), "-map", "[o2]", ...enc(28), join(out, "film-854.mp4")],
  { stdio: "inherit" },
);
execFileSync(ffmpeg, ["-y", "-v", "error", "-i", join(out, "film-1280.mp4"), "-frames:v", "1", "-q:v", "3", join(out, "poster.jpg")], { stdio: "inherit" });

const kb = (f) => Math.round(statSync(join(out, f)).size / 1024);
// the whole film is downloaded before it plays: keep it small (fewer / shorter clips, higher --crf)
const LIMIT = { "film-1280.mp4": 12 * 1024, "film-854.mp4": 8 * 1024 };
for (const [f, max] of Object.entries(LIMIT))
  if (kb(f) > max) console.warn(`warning: ${f} is ${(kb(f) / 1024).toFixed(1)} MB (> ${max / 1024} MB): too heavy for the site; use shorter clips or fewer of them`);
const filmLen = duration(join(out, "film-1280.mp4"));
const m = Object.fromEntries(sections.map((s, i) => [s, +marks[i].toFixed(2)]).filter(([s]) => s !== "-"));
const pub = out.replace(/\\/g, "/").split("/public/")[1] ?? "persona/film";
console.log(`\n${files.map((f) => `${f} ${kb(f)} KB`).join(", ")} in ${out} (${filmLen.toFixed(2)} s)`);
console.log("Put this in src/components/persona/config.ts (PERSONA.film), then tune `place` by eye:\n");
console.log(`  film: {
    desktop: "/${pub}/film-1280.mp4",
    mobile: "/${pub}/film-854.mp4", // not used yet: phones keep the static page
    poster: "/${pub}/poster.jpg",
    width: 1280,
    height: 720,
    duration: ${filmLen.toFixed(2)},
    marks: { ${Object.entries(m).map(([k, v]) => `${k}: ${v}`).join(", ")} },
    hold: 0.35,
    // where she stands in the film at each mark (0 = left edge, 1 = right edge)
    focus: { hero: 0.5, about: 0.33, work: 0.5${m.contact !== undefined ? ", contact: 0.5" : ""} },
    // where she should stand on the screen: right in the hero, left in About, on the belt
    place: { hero: 0.72, about: 0.27, work: "belt"${m.contact !== undefined ? ", contact: 0.5" : ""} },
  },`);
if (readdirSync(out).some((f) => /\.webp$/.test(f))) console.log("\nnote: old frame files are in this folder; they are not used any more.");
