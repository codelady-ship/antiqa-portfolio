#!/usr/bin/env node
/**
 * Builds the per-section persona clips (owner, 2026-11-17: she no longer travels between sections;
 * each section has its own short video that appears there). From the Google Flow / Veo clips
 * (1280×720, 24 fps, silent, cream studio) it writes to public/persona/clips/:
 *
 *   wave.mp4   + wave.webp    hero (right) and contact: she waves. A small loop (normal GOP).
 *   desk.mp4   + desk.webp    About: she sits down at the desk and types; scrubbed by the scroll,
 *                             so EVERY frame is a keyframe (-g 1) for instant seeks.
 *   point.mp4  + point.webp   Projects: she points at the hovered plate. Played forwards to the
 *                             "arm out" frame and backwards to rest, so also -g 1.
 *
 *   node scripts/persona-clips.mjs --wave clip1.mp4 --desk clip3.mp4 [--point clip4.mp4] [options]
 *
 * Without --point the pointing clip is cut from the wave (its arm-raise part, --point-from/--point-to,
 * default 0–1.5 s). When the real pointing clip (clip4) exists, pass it and set
 * PERSONA.clips.point.hold in src/components/persona/config.ts to its "arm out" second.
 *
 * Options: --out <dir> (default public/persona/clips), --ffmpeg <path>, --point-from <s>, --point-to <s>
 *
 * Cut-out versions (fix/persona-matte): pass the RGBA frames made by scripts/persona-matte.mjs
 *   --wave-alpha <dir>   frames of the wave clip's portrait box (480×712, also used for the pointing clip)
 *   --desk-alpha <dir>   frames of the desk clip's box (950×712)
 * and the script also writes wave.webm / desk.webm / point.webm (VP9 with alpha, yuva420p) and makes
 * the .webp posters transparent. The MP4s stay: they are the fallback where WebM alpha does not work.
 *
 * Every clip: the 2 px black lines at the top and bottom are cropped, the frame is cut to a portrait
 * box around her (desk: her + the desk), H.264 yuv420p, +faststart, no audio. Nothing is blurred
 * out: a Veo watermark, when the clip has one, stays.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};

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

const wave = opt("--wave");
const desk = opt("--desk");
const point = opt("--point");
if (!wave || !desk) {
  console.error("usage: node scripts/persona-clips.mjs --wave clip1.mp4 --desk clip3.mp4 [--point clip4.mp4] [--out public/persona/clips]");
  process.exit(1);
}
for (const c of [wave, desk, point].filter(Boolean)) if (!existsSync(c)) throw new Error(`no such clip: ${c}`);

const ffmpeg = findFfmpeg();
const out = resolve(opt("--out", "public/persona/clips"));
mkdirSync(out, { recursive: true });

// 1280×720 in, the black lines are 2–3 px: keep y 4 … 716
const NORM = "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=24,setsar=1,crop=1280:712:0:4";
// she stands in the middle (x ≈ 505 … 740): a portrait box of 480 px around her
const PORTRAIT = "crop=480:712:400:0";
const X264 = ["-c:v", "libx264", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"];
const ALL_KEYS = ["-g", "1", "-keyint_min", "1", "-sc_threshold", "0"];

function run(input, file, vf, extra, trim = []) {
  const dst = join(out, file);
  execFileSync(ffmpeg, ["-y", "-v", "error", ...trim, "-i", input, "-vf", vf, ...X264, ...extra, dst], { stdio: "inherit" });
  const poster = dst.replace(/\.mp4$/, ".webp");
  execFileSync(ffmpeg, ["-y", "-v", "error", ...trim, "-i", input, "-vf", vf, "-frames:v", "1", "-c:v", "libwebp", "-quality", "82", poster], { stdio: "inherit" });
  const kb = Math.round(statSync(dst).size / 1024);
  console.log(`${file}: ${kb} KB${kb > 2500 ? "  (large: raise -crf or lower the size)" : ""}`);
}

/**
 * VP9 with alpha from a folder of RGBA PNG frames (0001.png …, 24 fps; the pointing clip starts at
 * frame 1, i.e. --point-from is not used here).
 */
function runAlpha(dir, file, scale, gop, frames = null, crf = 36, pre = "") {
  if (!dir) return;
  const dst = join(out, file);
  const input = ["-framerate", "24", "-start_number", "1", "-i", join(dir, "%04d.png")];
  const vf = `format=rgba,${pre}${scale},setsar=1,format=yuva420p`;
  const limit = frames ? ["-frames:v", String(frames)] : [];
  execFileSync(
    ffmpeg,
    ["-y", "-v", "error", ...input, ...limit, "-vf", vf, "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", String(crf), "-row-mt", "1", "-auto-alt-ref", "0", "-g", String(gop), "-an", dst],
    { stdio: "inherit" },
  );
  execFileSync(ffmpeg, ["-y", "-v", "error", ...input, "-vf", vf, "-frames:v", "1", "-c:v", "libwebp", "-pix_fmt", "yuva420p", "-quality", "82", dst.replace(/\.webm$/, ".webp")], { stdio: "inherit" });
  console.log(`${file}: ${Math.round(statSync(dst).size / 1024)} KB (alpha)`);
}

run(wave, "wave.mp4", `${NORM},${PORTRAIT},scale=432:-2`, ["-crf", "28", "-g", "48"]);
// About: her chair on the left, the desk on the right (x 330 … 1280)
run(desk, "desk.mp4", `${NORM},crop=950:712:330:0,scale=720:-2`, ["-crf", "30", ...ALL_KEYS]);
const from = opt("--point-from", "0"), to = opt("--point-to", "1.5");
run(point ?? wave, "point.mp4", `${NORM},${PORTRAIT},scale=360:-2`, ["-crf", "28", ...ALL_KEYS], point ? [] : ["-ss", from, "-to", to]);
// cut-out versions (the posters are replaced by transparent ones)
const waveA = opt("--wave-alpha"), deskA = opt("--desk-alpha");
runAlpha(waveA, "wave.webm", "scale=432:-2", 48);
// scrubbed: a keyframe every 8 frames keeps seeks quick and the file small (568 KB); the alpha
// curve drops the faint ghosts the model leaves where the desk and chair fade in and out
runAlpha(deskA, "desk.webm", "scale=720:-2", 8, null, 44, "lutrgb=a='clip((val-48)*255/160\\,0\\,255)',");
// pointing (from the wave until clip4 exists): the first 1.5 s, played both ways; a keyframe every 4
// frames (all-keyframe VP9 alpha was 4x the size)
if (!point) runAlpha(waveA, "point.webm", "scale=360:-2", 4, Math.round(Number(opt("--point-to", "1.5")) * 24), 40);
console.log(`done → ${out}`);
