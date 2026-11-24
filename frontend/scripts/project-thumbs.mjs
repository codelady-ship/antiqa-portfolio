#!/usr/bin/env node
/**
 * Small copies of the project screenshots for the belt plates (issue #69): the 960 px
 * public/projects/<name>.webp files are drawn in 30–150 px round plates, so the plates load
 * public/projects/<name>-160.webp, -320.webp and -480.webp (srcset) and only the project dialog keeps
 * the full 960 px picture. Same picture, only fewer pixels (Lanczos downscale).
 *
 *   node scripts/project-thumbs.mjs            (run from frontend/ after adding or replacing a screenshot)
 *
 * The widths must match PLATE_WIDTHS in src/components/work/project-conveyor.tsx.
 */
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const sharp = createRequire(join(process.cwd(), "x.js"))("sharp");
const DIR = join(process.cwd(), "public", "projects");
const WIDTHS = [160, 320, 480];

for (const file of readdirSync(DIR)) {
  if (!file.endsWith(".webp") || /-\d+\.webp$/.test(file)) continue;
  const base = file.slice(0, -".webp".length);
  for (const w of WIDTHS) {
    const out = join(DIR, `${base}-${w}.webp`);
    const info = await sharp(join(DIR, file)).resize({ width: w, kernel: "lanczos3" }).webp({ quality: 82, effort: 6 }).toFile(out);
    console.log(`${base}-${w}.webp  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(1)} KB`);
  }
}
