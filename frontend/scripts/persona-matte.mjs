#!/usr/bin/env node
/**
 * Cuts her out of the cream studio, frame by frame, for the transparent persona clips
 * (fix/persona-matte, owner 2026-11-17: "my yellow background must not be there").
 *
 * Runs a background-removal model LOCALLY (@imgly/background-removal-node, ONNX on the CPU): no frame
 * is uploaded anywhere. The package is big (the model files), so it is not a site dependency;
 * install it in a scratch folder and run this script from there:
 *
 *   mkdir matte && cd matte && npm init -y && npm i @imgly/background-removal-node
 *   # the frames, in the same box persona-clips.mjs uses (from frontend/: see public/persona/README.md)
 *   ffmpeg -i clip1.mp4 -vf "scale=1280:720,fps=24,setsar=1,crop=1280:712:0:4,crop=480:712:400:0" -frames:v 108 wave/%04d.png
 *   ffmpeg -i clip3.mp4 -vf "scale=1280:720,fps=24,setsar=1,crop=1280:712:0:4,crop=950:712:330:0" desk/%04d.png
 *   node <repo>/frontend/scripts/persona-matte.mjs wave wave-alpha
 *   node <repo>/frontend/scripts/persona-matte.mjs desk desk-alpha
 *   # then, from frontend/:
 *   node scripts/persona-clips.mjs --wave clip1.mp4 --desk clip3.mp4 --wave-alpha <…>/wave-alpha --desk-alpha <…>/desk-alpha
 *
 * About 10–20 s a frame on a laptop CPU. Re-running skips frames that are already done.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [inDir, outDir, model = "medium"] = process.argv.slice(2);
if (!inDir || !outDir) {
  console.error("usage: node persona-matte.mjs <frames dir> <out dir> [small|medium]   (run where @imgly/background-removal-node is installed)");
  process.exit(1);
}
// resolved from the current folder (the scratch install), not from the site's node_modules
const { removeBackground } = await import(pathToFileURL(createRequire(join(process.cwd(), "x.js")).resolve("@imgly/background-removal-node")).href);
mkdirSync(outDir, { recursive: true });
const files = readdirSync(inDir).filter((f) => f.endsWith(".png")).sort();
const t0 = Date.now();
for (const [i, f] of files.entries()) {
  const dst = join(outDir, f);
  if (existsSync(dst)) continue;
  const blob = await removeBackground(pathToFileURL(resolve(inDir, f)).href, { model, output: { format: "image/png", quality: 1 } });
  writeFileSync(dst, Buffer.from(await blob.arrayBuffer()));
  if (i % 20 === 0) console.log(`${i + 1}/${files.length} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.log(`done: ${files.length} frames → ${outDir}`);
