// Writes the owner's profile (scripts/profile-data.ts) and uploads her CV PDFs, like the admin panel would.
// Run from backend/:  npx tsx scripts/upsert-profile.ts [--dry-run] [--env <path to .env>] [--cv-az <pdf>] [--cv-en <pdf>]
//   --dry-run  validates and prints the profile JSON and CV file names/sizes; no database connection, no writes.
//   --cv-az / --cv-en  PDF paths (defaults in profile-data.ts; an empty path skips that language).
// Idempotent: run it again to overwrite. Never prints environment values or the connection string.
import dns from "node:dns";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import mongoose from "mongoose";
import { ProfileInput } from "../src/app.js";
import { connectDb, Cv, Profile } from "../src/models.js";
import { CV_DEFAULTS, PROFILE } from "./profile-data.js";

const MAX_CV = 2 * 1024 * 1024; // same limit as PUT /api/cv/:lang (express.raw limit "2mb")
const LANGS = ["az", "en"] as const;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const argValue = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? "") : undefined;
};
const envPath = argValue("--env") || ".env";
if (existsSync(envPath)) process.loadEnvFile(envPath); // values are never printed

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "error");

/** Connects with the app's connectDb. Some Windows resolvers refuse the SRV lookup of mongodb+srv URIs: retry once via public DNS. */
async function connect() {
  try {
    await connectDb();
  } catch (e) {
    if ((e as { syscall?: string }).syscall !== "querySrv") throw safeDbError(e);
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
    await connectDb().catch((e2) => Promise.reject(safeDbError(e2)));
  }
}
// only the error type and code: driver messages can contain the host name
const safeDbError = (e: unknown) =>
  new Error(`database not reachable (${e instanceof Error ? e.name : "error"}${(e as { code?: string })?.code ? ` ${(e as { code?: string }).code}` : ""})`);

type CvFile = { lang: (typeof LANGS)[number]; fileName: string; data: Buffer };

/** Reads and checks a CV the same way the admin upload route does: PDF magic bytes, at most 2 MB, name up to 100 chars. */
function loadCv(lang: (typeof LANGS)[number], path: string): CvFile {
  if (!existsSync(path)) throw new Error(`cv ${lang}: file not found (${basename(path)})`);
  const data = readFileSync(path);
  if (data.subarray(0, 5).toString() !== "%PDF-") throw new Error(`cv ${lang}: not a PDF`);
  if (data.length > MAX_CV) throw new Error(`cv ${lang}: ${kb(data.length)} is over the 2 MB limit`);
  return { lang, fileName: basename(path).slice(0, 100), data };
}
const kb = (n: number) => `${Math.round(n / 1024)} KB`;

async function main() {
  // validate everything before any connection, with the same schema as PUT /api/profile
  const profile = ProfileInput.parse(PROFILE);
  const cvs = LANGS.flatMap((lang) => {
    const path = argValue(`--cv-${lang}`) ?? CV_DEFAULTS[lang];
    return path ? [loadCv(lang, path)] : [];
  });

  if (dryRun) {
    console.log(`profile would write:\n${JSON.stringify(profile, null, 2)}`);
    for (const lang of LANGS) {
      const cv = cvs.find((c) => c.lang === lang);
      console.log(cv ? `cv ${lang} would upload: ${cv.fileName} (${kb(cv.data.length)}, ${cv.data.length} bytes)` : `cv ${lang}: skipped (no file given)`);
    }
    return 0;
  }

  await connect();
  let failed = 0;
  try {
    await Profile.findByIdAndUpdate("main", profile, { upsert: true, new: true, runValidators: true });
    console.log("profile: ok");
  } catch (e) {
    failed++;
    console.log(`profile: error (${errMsg(e)})`);
  }
  for (const { lang, fileName, data } of cvs) {
    try {
      await Cv.findByIdAndUpdate(lang, { fileName, data, size: data.length }, { upsert: true });
      console.log(`cv ${lang}: ok (${kb(data.length)})`);
    } catch (e) {
      failed++;
      console.log(`cv ${lang}: error (${errMsg(e)})`);
    }
  }
  return failed;
}

main()
  .then((failed) => {
    process.exitCode = failed ? 1 : 0;
  })
  .catch((e) => {
    console.log(`error: ${errMsg(e)}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
