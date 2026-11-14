// Adds or refreshes the owner's featured projects (GitHub snapshot + az/en summary + order + links).
// Run from backend/:  npx tsx scripts/upsert-projects.ts [--dry-run] [--env <path to .env>]
//   --dry-run  fetches GitHub data and prints what would be written; no database writes
//              (if MONGODB_URI is set it only reads, to say "new" or "update").
// Idempotent: run it again to refresh. Never prints environment values or the connection string.
import dns from "node:dns";
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { ProjectPatch, sync } from "../src/app.js";
import { connectDb, Project } from "../src/models.js";
import { fetchSnapshot, parseRepoUrl } from "../src/services/github.js";

type Entry = { repo: string; patch: Record<string, unknown> };

const ENTRIES: Entry[] = [
  {
    repo: "https://github.com/codelady-ship/planera",
    patch: {
      featured: true,
      hidden: false,
      order: 40,
      summary: {
        az: "Onlayn randevu platforması: xidmət göstərəni tap, boş saatı seç və randevunu bir neçə kliklə götür. Frontend Next.js və TypeScript, backend Java Spring Boot və PostgreSQL üzərində qurulub.",
        en: "An online booking platform: find a service provider, pick a free slot and book an appointment in a few clicks. Built with a Next.js + TypeScript frontend and a Java Spring Boot + PostgreSQL backend.",
      },
    },
  },
  {
    repo: "https://github.com/codelady-ship/hypedomino",
    patch: {
      title: "HypeDomino",
      featured: true,
      hidden: false,
      order: 30,
      summary: {
        az: "Real vaxtda onlayn çoxoyunçulu mobil domino oyunu. Unity (C#) klienti, WebSocket və protobuf ilə işləyən Go serveri, PostgreSQL, Redis və Next.js admin paneli var.",
        en: "A real-time online multiplayer mobile domino game, with a Unity (C#) client, a Go server over WebSocket and protobuf, PostgreSQL, Redis and a Next.js admin panel.",
      },
    },
  },
  {
    repo: "https://github.com/codelady-ship/masapay",
    patch: {
      featured: true,
      hidden: false,
      order: 20,
      summary: {
        az: "Komanda layihəsi. Restoranlar üçün QR əsaslı hesab bölmə və ödəniş platforması: müştəri masadakı QR kodu skan edib canlı hesabı görür, hesabı bölür, bəxşiş əlavə edir və Payriff ilə ödəyir. React + TypeScript, Java Spring Boot, PostgreSQL və WebSocket üzərində qurulub.",
        en: "Team project. A QR-based bill-splitting and payment platform for restaurants: guests scan the table's QR code, see the live bill, split it, add a tip and pay via Payriff. Built with React + TypeScript, Java Spring Boot, PostgreSQL and WebSocket.",
      },
    },
  },
  {
    repo: "https://github.com/codelady-ship/scholarship-visa-scam-checker",
    patch: {
      title: "Claude AI Skills",
      featured: true,
      hidden: false,
      order: 10,
      summary: {
        az: "Agensi marketplace-i üçün hazırladığım üç pulsuz Claude AI skill-i: təqaüd və viza fırıldaqlarını yoxlayan köməkçi, Azərbaycan dilində səsləndirmə studiyası və Photoshop dizayn məşqçisi.",
        en: "Three free Claude AI skills I built for the Agensi marketplace: a scholarship and visa scam checker, an Azerbaijani voiceover studio and a Photoshop design coach.",
      },
      links: [
        { label: "Scholarship & Visa Scam Checker", url: "https://github.com/codelady-ship/scholarship-visa-scam-checker" },
        { label: "Azerbaijani Voiceover Studio", url: "https://github.com/codelady-ship/azerbaijani-voiceover-studio" },
        { label: "Photoshop Design Coach", url: "https://github.com/codelady-ship/photoshop-design-coach" },
      ],
    },
  },
];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const envIdx = args.indexOf("--env");
const envPath = envIdx >= 0 ? args[envIdx + 1] : ".env";
if (envPath && existsSync(envPath)) process.loadEnvFile(envPath); // values are never printed

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

async function main() {
  // validate everything first with the same rules as the admin PATCH
  const plan = ENTRIES.map((e) => {
    const ref = parseRepoUrl(e.repo);
    if (!ref) throw new Error(`bad repo url: ${e.repo}`);
    return { ref, patch: ProjectPatch.parse(e.patch) };
  });

  let failed = 0;
  if (dryRun) {
    // read-only DB check, only when a connection is configured
    let db = false;
    if (process.env.MONGODB_URI) {
      try {
        await connect();
        db = true;
      } catch (e) {
        console.log(`${errMsg(e)}, skipping the read-only check`);
      }
    }
    for (const { ref, patch } of plan) {
      try {
        const s = await fetchSnapshot(ref);
        const state = db ? ((await Project.exists({ owner: ref.owner, name: ref.name }).collation({ locale: "en", strength: 2 })) ? "update" : "new") : "?";
        console.log(`\n${s.owner}/${s.name}: ok (${state})`);
        console.log(`  github: ${s.description || "(no description)"} | homepage: ${s.homepage ?? "-"} | topics: ${s.topics.join(", ") || "-"}`);
        console.log(`  languages: ${s.languages.map((l) => `${l.name} ${l.percent}%`).join(", ") || "-"} | readme: ${s.readmeHtml ? "yes" : "no"}`);
        console.log(`  would write: ${JSON.stringify(patch, null, 2).replace(/\n/g, "\n  ")}`);
      } catch (e) {
        failed++;
        console.log(`${ref.owner}/${ref.name}: error (${errMsg(e)})`);
      }
    }
    if (db) {
      const others = await Project.find({ featured: true, hidden: false }, { owner: 1, name: 1, order: 1 }).lean();
      const mine = new Set(plan.map((p) => `${p.ref.owner}/${p.ref.name}`.toLowerCase()));
      const rest = others.filter((o: any) => !mine.has(`${o.owner}/${o.name}`.toLowerCase()));
      console.log(`\nother featured projects: ${rest.map((o: any) => `${o.name} (order ${o.order ?? 0})`).join(", ") || "none"}`);
    }
  } else {
    await connect();
    for (const { ref, patch } of plan) {
      const label = `${ref.owner}/${ref.name}`;
      try {
        let p: any = await Project.findOne(ref).collation({ locale: "en", strength: 2 });
        const created = !p;
        p ??= new Project({ ...ref, repoUrl: `https://github.com/${ref.owner}/${ref.name}` });
        p.set(patch);
        await sync(p); // same GitHub snapshot + sanitizing as POST /api/projects; saves
        if (p.syncError) {
          if (created) await p.deleteOne();
          throw new Error(p.syncError);
        }
        console.log(`${label}: ok (${created ? "created" : "updated"})`);
      } catch (e) {
        failed++;
        console.log(`${label}: error (${errMsg(e)})`);
      }
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
