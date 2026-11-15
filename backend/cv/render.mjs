// Renders cv-en.html / cv-az.html to the PDFs next to them with headless Chromium (A4, fonts embedded).
// Playwright is not a project dependency: run with any installed copy, e.g.
//   NODE_PATH=<dir containing node_modules/playwright> node backend/cv/render.mjs
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const dir = dirname(fileURLToPath(import.meta.url));
const jobs = [
  ["cv-en.html", "Antiqa_Calilova_CV_EN.pdf"],
  ["cv-az.html", "Antiqa_Calilova_CV_AZ.pdf"],
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [html, pdf] of jobs) {
    await page.goto(pathToFileURL(join(dir, html)).href, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: join(dir, pdf), format: "A4", preferCSSPageSize: true, printBackground: true });
    console.log(`${pdf}: ${Math.round(statSync(join(dir, pdf)).size / 1024)} KB`);
  }
} finally {
  await browser.close();
}
