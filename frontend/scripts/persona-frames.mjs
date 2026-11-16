#!/usr/bin/env node
/**
 * Turns a persona video (e.g. the 8 s Google Flow clip) into the scroll-scrubbed frame sequence:
 * public/persona/frames/0001.webp … NNNN.webp, and prints the PERSONA.frames block for config.ts.
 *
 *   node scripts/persona-frames.mjs <video.mp4> [options]      (run from frontend/)
 *
 *   --frames 72        how many frames (60–90 is plenty; they are scrubbed by scroll, not played)
 *   --width 720        frame width in px (height follows the video's ratio)
 *   --quality 78       WebP quality
 *   --key FBF3EC       make this background colour transparent (the cream of the Flow prompt);
 *                      --key none keeps the background (then use a cream video only in light theme)
 *   --similarity 0.12  how close to --key a pixel must be to become transparent
 *   --idle             also write the last frame as public/persona/poses/idle.webp (the ring pose)
 *   --force            replace frames that are already in public/persona/frames/ (without it the
 *                      script stops and lists them, so a good set is never deleted by accident)
 *
 * Needs ffmpeg + ffprobe on PATH (or FFMPEG / FFPROBE env vars). Nothing is installed in the project.
 * Windows: `winget install Gyan.FFmpeg`, macOS: `brew install ffmpeg`, Linux: `apt install ffmpeg`.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "public", "persona", "frames");
const POSES = join(root, "public", "persona", "poses");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const FFPROBE = process.env.FFPROBE || "ffprobe";

const args = process.argv.slice(2);
// flags without a value; every other --option takes the next argument as its value
const FLAGS = new Set(["--idle", "--force"]);
// the one positional argument: any name, also one that starts with a digit (e.g. "2026-11-16 flow.mp4")
const input = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && !FLAGS.has(args[i - 1])))[0];
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : args[i + 1];
};
if (!input || !existsSync(input)) {
  console.error("usage: node scripts/persona-frames.mjs <video.mp4> [--frames 72] [--width 720] [--quality 78] [--key FBF3EC|none] [--similarity 0.12] [--idle] [--force]");
  process.exit(1);
}
const frames = Math.max(2, Number(opt("frames", 72)));
const width = Number(opt("width", 720));
const quality = Number(opt("quality", 78));
const key = String(opt("key", "FBF3EC")).replace(/^#/, "");
const similarity = Number(opt("similarity", 0.12));

const run = (bin, a) => execFileSync(bin, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const probe = (file, entries) => run(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", entries, "-of", "csv=p=0", file]).trim();

let duration;
try {
  duration = Number(run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input]).trim());
} catch {
  console.error(`ffprobe not found or failed. Install ffmpeg (see the header of this file) or set FFPROBE.`);
  process.exit(1);
}
if (!(duration > 0)) throw new Error(`could not read the duration of ${input}`);

// fresh output folder (keeps .gitkeep); old frames only go with --force
mkdirSync(OUT, { recursive: true });
const old = readdirSync(OUT).filter((f) => f.endsWith(".webp"));
if (old.length && !args.includes("--force")) {
  console.error(`public/persona/frames/ already has ${old.length} frames (${old[0]} … ${old.at(-1)}).
Run again with --force to replace them, or move them away first.`);
  process.exit(1);
}
for (const f of old) rmSync(join(OUT, f));

const filters = [`fps=${(frames / duration).toFixed(5)}`, `scale=${width}:-2:flags=lanczos`];
if (key !== "none") filters.push(`colorkey=0x${key}:${similarity}:0.08`, "format=yuva420p");
run(FFMPEG, [
  "-v", "error", "-y", "-i", input,
  "-vf", filters.join(","),
  "-frames:v", String(frames),
  "-c:v", "libwebp", "-quality", String(quality), "-compression_level", "6",
  ...(key !== "none" ? ["-pix_fmt", "yuva420p"] : []),
  join(OUT, "%04d.webp"),
]);

const files = readdirSync(OUT).filter((f) => /^\d{4}\.webp$/.test(f)).sort();
if (!files.length) throw new Error("ffmpeg wrote no frames");
const [w, h] = probe(join(OUT, files[0]), "stream=width,height").split(",").map(Number);
if (args.includes("--idle")) {
  mkdirSync(POSES, { recursive: true });
  copyFileSync(join(OUT, files.at(-1)), join(POSES, "idle.webp"));
}

const n = files.length;
const a = Math.max(1, Math.round(n * 0.45));
console.log(`\n${n} frames (${w}×${h}) in public/persona/frames/. Put this in src/components/persona/config.ts:\n`);
console.log(`  frames: {
    count: ${n},
    width: ${w},
    height: ${h},
    // the contact stage plays its own range; the travelling figure uses the whole sequence
    chapters: { hero: [1, ${a}], skills: [${a}, ${n}], contact: [${n}, ${n}] },
  },`);
if (args.includes("--idle")) console.log(`  poses: { idle: "/persona/poses/idle.webp" },`);
console.log(`\nThe figure box is 677:800 — frames of another ratio are fitted inside it (object-fit: contain).`);
