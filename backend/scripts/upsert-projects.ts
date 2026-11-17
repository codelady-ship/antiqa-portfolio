// Adds or refreshes the owner's featured projects (GitHub snapshot + az/en summary + order + links).
// Run from backend/:  GITHUB_TOKEN=$(gh auth token) npx tsx scripts/upsert-projects.ts [--dry-run] [--only a,b] [--env <path to .env>]
//   --dry-run  fetches GitHub data and prints what would be written; no database writes
//              (if MONGODB_URI is set it only reads, to say "new" or "update").
//   --only     comma-separated repo names: run just these entries (e.g. --only jeparla)
//   --refresh-all  also re-reads EVERY other project in the database from GitHub (homepage →
//              live link, description, languages, stars, dates); owner overrides stay. Use it after
//              repo fixes change homepages or descriptions. Warns when a demo override hides a new homepage.
//   --hide a,b / --show a,b  only sets the "hidden" flag of these projects (no GitHub calls), e.g.
//              --hide Food-Wagon-delivery-figma,net-pro-group-fiqma,exam-task-react
//   --showcase only sets the "fullStack" flag (no GitHub calls): true for SHOWCASE, false for every
//              other project, so the home page belt shows the full-stack work and not the early
//              practice tasks (those stay in the database and on GitHub). With --dry-run: prints the plan.
// Private repos (allowPrivate) need a GITHUB_TOKEN that can read them; the site shows them
// without a code link or README (see present() in src/app.ts).
// After any database write it expires the site's cached pages (POST <SITE_URL>/admin-revalidate with
// "Authorization: Bearer $CRON_SECRET"), so the change shows at once instead of when the cache runs
// out. Needs CRON_SECRET (the same value on the site's Vercel project); SITE_URL defaults to
// https://antiqa-portfolio.vercel.app. --no-revalidate skips it.
// Idempotent: run it again to refresh. Never prints environment values or the connection string.
import dns from "node:dns";
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { ProjectPatch, sync } from "../src/app.js";
import { connectDb, Project } from "../src/models.js";
import { fetchSnapshot, parseRepoUrl } from "../src/services/github.js";

type Entry = { repo: string; patch: Record<string, unknown>; allowPrivate?: boolean };

/**
 * The projects on the home page belt (owner, 2026-11-16: "təzə vaxtlar yazdığım taskları qoyma,
 * full stack olanları qoy"): a frontend and a backend of her own. Keep in sync with
 * SHOWCASE_FALLBACK in frontend/src/components/work/project-conveyor.tsx.
 */
export const SHOWCASE = [
  "planera", // Next.js + Spring Boot + PostgreSQL
  "hypedomino", // Unity client, Go server, PostgreSQL, Redis, Next.js admin
  "jeparla", // Next.js + Spring Boot + PostgreSQL (coming soon)
  "masapay", // Next.js + Spring Boot + PostgreSQL + Redis
  "Curtain-shop-web-site-frontend", // Perde.az: React + Spring Boot backend repo
  "codelady-skills", // "Codelady Skills": the skills site (Next.js, Supabase, Cloudflare Workers, Gemini) + the skills
  // owner, 2026-11-17: the finished projects with a Node.js + Express + MongoDB backend
  "Ecommerse-app", // HUELINE: React + GSAP, Express + MongoDB
  "My-Fitness-App", // Pulsa: Next.js, Express + MongoDB
  "My-Quiz-App", // Kod Sınağı: React + Vite, Express + MongoDB
  "hello-fresh-with-react", // HelloFresh clone: React + Vite, Express + MongoDB
  "net-pro-group-fiqma", // Net Pro Group: HTML/CSS/JS, Express + MongoDB
  "AFN-rent-a-car-fiqma", // AFN Rent a Car: React + TypeScript, Express + MongoDB
  // owner, 2026-11-17: Programmers List (task7/task6) and this portfolio are off the belt
];

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
      // its demo page cannot be framed (X-Frame-Options: DENY): the modal's Demo tab shows an
      // "open in a new tab" card for it (demoNoFrame, set on sync)
      demoOverride: "https://ideyanest.com/az/projects/ismat-jahangirov/hypedomino-real-time-onlayn-domino-oyunu",
      summary: {
        az: "Real vaxtda onlayn çoxoyunçulu mobil domino oyunu. Unity (C#) klienti, WebSocket və protobuf ilə işləyən Go serveri, PostgreSQL, Redis və Next.js admin paneli var.",
        en: "A real-time online multiplayer mobile domino game, with a Unity (C#) client, a Go server over WebSocket and protobuf, PostgreSQL, Redis and a Next.js admin panel.",
      },
    },
  },
  {
    // private repo (no code link); live since 2026-11-17: the merchant area (it opens on its login page)
    repo: "https://github.com/codelady-ship/jeparla",
    allowPrivate: true,
    patch: {
      title: "Jeparla",
      featured: true,
      hidden: false,
      comingSoon: false,
      demoOverride: "https://jeparla.duckdns.org/az/merchant",
      order: 25,
      summary: {
        az: "Qızıl, gümüş və brilyant zərgərlik mağazaları üçün çoxmağazalı kataloq: əyar, çəki, qiymət və brilyant filtrləri, AMB-nin gündəlik metal məzənnəsinə bağlı avtomatik qiymət, “Jeparla Verified” yoxlama statusları, mağaza kabineti və admin paneli. Next.js + TypeScript, Java Spring Boot və PostgreSQL üzərində qurulur.",
        en: "A multi-shop catalogue for gold, silver and diamond jewellery stores: filters by purity, weight, price and diamond details, prices tied to the Central Bank's daily metal rates, “Jeparla Verified” checks, a shop dashboard and an admin panel. Being built with Next.js + TypeScript, Java Spring Boot and PostgreSQL.",
      },
    },
  },
  {
    repo: "https://github.com/codelady-ship/masapay",
    patch: {
      featured: true,
      hidden: false,
      order: 20,
      // GitHub Pages (live since 2026-11-17); liveOrSkip still leaves it out if it ever stops answering 200,
      // so the card stays code-only instead of linking to a 404
      demoOverride: "https://codelady-ship.github.io/masapay/",
      summary: {
        az: "Komanda layihəsi. Restoranlar üçün QR əsaslı hesab bölmə və ödəniş platforması: müştəri masadakı QR kodu skan edib canlı hesabı görür, hesabı bölür, bəxşiş əlavə edir və Payriff ilə ödəyir. React + TypeScript, Java Spring Boot, PostgreSQL və WebSocket üzərində qurulub.",
        en: "Team project. A QR-based bill-splitting and payment platform for restaurants: guests scan the table's QR code, see the live bill, split it, add a tip and pay via Payriff. Built with React + TypeScript, Java Spring Boot, PostgreSQL and WebSocket.",
      },
    },
  },
  {
    // curtain shop (pərdə): React + Vite frontend on GitHub Pages, Spring Boot backend repo
    repo: "https://github.com/codelady-ship/Curtain-shop-web-site-frontend",
    patch: {
      title: "Perde.az",
      featured: true,
      hidden: false,
      order: 15,
      demoOverride: "https://codelady-ship.github.io/Curtain-shop-web-site-frontend/",
      backendUrl: "https://github.com/codelady-ship/Curtain-shop-web-site-backend",
      summary: {
        az: "Pərdə mağazası üçün sayt: məhsul kataloqu, kampaniya və müraciət formaları, məhsulları, müraciətləri və promo kodları idarə edən admin paneli. Frontend React + Vite, backend Java Spring Boot və PostgreSQL üzərində qurulub.",
        en: "A website for a curtain shop: a product catalogue, campaign and lead forms, and an admin panel for products, leads and promo codes. Built with a React + Vite frontend and a Java Spring Boot + PostgreSQL backend.",
      },
      links: [{ label: "Backend (Spring Boot)", url: "https://github.com/codelady-ship/Curtain-shop-web-site-backend" }],
    },
  },
  {
    // owner, 2026-11-17: "skillərlə bağlı saytı da qoy portfolioya". Its own public repo (MIT) and
    // live site since 2026-11-17; it replaces the old scholarship-visa-scam-checker record (hide that
    // one: --hide scholarship-visa-scam-checker)
    repo: "https://github.com/codelady-ship/codelady-skills",
    patch: {
      title: "Codelady Skills",
      featured: true,
      hidden: false,
      comingSoon: false,
      demoOverride: "https://codelady-ship.github.io/codelady-skills/az/",
      order: 10,
      summary: {
        az: "Claude AI skill-lərim üçün sayt: hər skill-in öz iş paneli var (səsləndirmə, fırıldaq yoxlaması, xaricdə təhsil, viza, iş müraciəti), müəlliflər üçün marketplace və ödəniş. Next.js + TypeScript, Supabase, Cloudflare Workers və Gemini API üzərində qurulur.",
        en: "A website for my Claude AI skills: each skill has its own working panel (voiceover, scam check, study abroad, visa, job applications), plus a marketplace with payments for skill authors. Being built with Next.js + TypeScript, Supabase, Cloudflare Workers and the Gemini API.",
      },
      links: [],
    },
  },
  {
    // full stack: frontend + Node.js / Express / MongoDB API in backend/ (owner, 2026-11-17: on the belt)
    repo: "https://github.com/codelady-ship/Ecommerse-app",
    patch: {
      title: "HUELINE",
      featured: true,
      hidden: false,
      order: 14,
      demoOverride: "https://codelady-ship.github.io/Ecommerse-app/",
      summary: {
        az: "Uydurma qadın geyimi brendi HUELINE üçün lookbook və mağaza: kataloq, səbət, seçilmişlər, demo sifariş və bülleten. Hərəkətli React frontend (GSAP, Lenis) və Node.js + Express + MongoDB API. Demo layihədir, real ödəniş yoxdur.",
        en: "A lookbook and shop for HUELINE, a fictional womenswear label: catalogue, bag, saved list, demo checkout and newsletter. A motion-heavy React frontend (GSAP, Lenis) with a Node.js + Express + MongoDB API. A demo: nothing is for sale.",
      },
    },
  },
  {
    // full stack: frontend + Node.js / Express / MongoDB API in backend/ (owner, 2026-11-17: on the belt)
    repo: "https://github.com/codelady-ship/My-Fitness-App",
    patch: {
      title: "Pulsa",
      featured: true,
      hidden: false,
      order: 13,
      demoOverride: "https://my-fitness-app-tau-drab.vercel.app/",
      summary: {
        az: "Ürək ritminə əsaslanan kardio-məşq tətbiqi: landing, proqramlar, məşqçilər, qiymətlər, giriş/qeydiyyat və istifadəçi/admin paneli (ürək göstəriciləri, gündəlik plan, üzvlər, işçilər). Next.js frontend və Node.js + Express + MongoDB API.",
        en: "A heart-rate based cardio coaching app: landing page, programmes, coaches, pricing, sign-in and a user/admin dashboard (heart metrics, daily plan, members, staff). A Next.js frontend with a Node.js + Express + MongoDB API.",
      },
    },
  },
  {
    // full stack: frontend + Node.js / Express / MongoDB API in backend/ (owner, 2026-11-17: on the belt)
    repo: "https://github.com/codelady-ship/My-Quiz-App",
    patch: {
      title: "Kod Sınağı · Code Check",
      featured: true,
      hidden: false,
      order: 12,
      demoOverride: "https://codelady-ship.github.io/My-Quiz-App/",
      summary: {
        az: "HTML, CSS, JavaScript və React üzrə iki dilli (az/en) viktorina: hər raundda 10 təsadüfi sual, taymer, cavabların təhlili və onlayn liderlər cədvəli. React + Vite frontend və Node.js + Express + MongoDB API.",
        en: "A bilingual (az/en) web-development quiz on HTML, CSS, JavaScript and React: 10 random questions a round, a timer, answer review and an online leaderboard. A React + Vite frontend with a Node.js + Express + MongoDB API.",
      },
    },
  },
  {
    // full stack: frontend + Node.js / Express / MongoDB API in backend/ (owner, 2026-11-17: on the belt)
    repo: "https://github.com/codelady-ship/hello-fresh-with-react",
    patch: {
      title: "HelloFresh clone (practice)",
      featured: true,
      hidden: false,
      order: 11,
      demoOverride: "https://codelady-ship.github.io/hello-fresh-with-react/",
      summary: {
        az: "Təlim layihəsi: HelloFresh saytının çoxsəhifəli klonu: planlar, reseptlər, abunə və hədiyyə kartları. React, React Router, Vite və Tailwind CSS frontend, Node.js + Express + MongoDB API. HelloFresh ilə əlaqəsi yoxdur.",
        en: "Practice project: a multi-page clone of the HelloFresh meal-kit site with plans, recipes, subscriptions and gift cards. A React, React Router, Vite and Tailwind CSS frontend with a Node.js + Express + MongoDB API. Not affiliated with HelloFresh.",
      },
    },
  },
  {
    // full stack: frontend + Node.js / Express / MongoDB API in backend/ (owner, 2026-11-17: on the belt)
    repo: "https://github.com/codelady-ship/net-pro-group-fiqma",
    patch: {
      title: "Net Pro Group",
      featured: true,
      hidden: false,
      order: 9,
      demoOverride: "https://codelady-ship.github.io/net-pro-group-fiqma/",
      summary: {
        az: "Figma dizaynı əsasında İT və şəbəkə avadanlıqları şirkəti üçün çoxsəhifəli, responsiv sayt (təlim layihəsi). Əlaqə və məhsul sorğuları Node.js + Express + MongoDB API-yə yazılır; admin üçün status, qeyd və statistika.",
        en: "A multi-page, responsive site for an IT and network equipment company, built from a Figma design (practice project). Contact and product requests go to a Node.js + Express + MongoDB API, with statuses, notes and stats for the admin.",
      },
    },
  },
  {
    // full stack: frontend + Node.js / Express / MongoDB API in backend/ (owner, 2026-11-17: on the belt)
    repo: "https://github.com/codelady-ship/AFN-rent-a-car-fiqma",
    patch: {
      title: "AFN Rent a Car",
      featured: true,
      hidden: false,
      order: 8,
      demoOverride: "https://codelady-ship.github.io/AFN-rent-a-car-fiqma/",
      summary: {
        az: "Bakı üçün avtomobil icarəsi saytı (Figma dizaynı əsasında təlim layihəsi): avtopark və filtrlər, avtomobil səhifəsi, onlayn rezervasiya (qiyməti server hesablayır, eyni günlərə ikinci rezervasiya mümkün deyil). React + TypeScript frontend və Node.js + Express + MongoDB API.",
        en: "A car rental site for Baku, built from a Figma design (practice project): fleet with filters, car pages and online booking (the server prices it and blocks double bookings). A React + TypeScript frontend with a Node.js + Express + MongoDB API.",
      },
    },
  },
  {
    // this site: Next.js frontend + Express/MongoDB API, both on Vercel
    repo: "https://github.com/codelady-ship/antiqa-portfolio",
    patch: {
      title: "Antiqa Portfolio",
      featured: true,
      hidden: false,
      order: 5,
      demoOverride: "https://antiqa-portfolio.vercel.app/",
      summary: {
        az: "Bu sayt: layihələrimi GitHub-dan özü oxuyan portfolio. Next.js + TypeScript frontend, Express və MongoDB API, layihələri, CV-ləri və profili idarə edən admin paneli, az/en dil dəstəyi.",
        en: "This site: a portfolio that reads my projects from GitHub by itself. A Next.js + TypeScript frontend, an Express + MongoDB API, an admin panel for projects, CVs and the profile, in Azerbaijani and English.",
      },
    },
  },
];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const envIdx = args.indexOf("--env");
const envPath = envIdx >= 0 ? args[envIdx + 1] : ".env";
const onlyIdx = args.indexOf("--only");
const listArg = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? String(args[i + 1] ?? "").split(",").map((x) => x.trim()).filter(Boolean) : null;
};
const refreshAll = args.includes("--refresh-all");
const hide = listArg("--hide");
const show = listArg("--show");
const showcase = args.includes("--showcase");
const only = onlyIdx >= 0 ? new Set(String(args[onlyIdx + 1] ?? "").toLowerCase().split(",").filter(Boolean)) : null;
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

/**
 * A live link (demoOverride) that does not answer 200 yet (e.g. a GitHub Pages site whose PR is not
 * merged) is left out of the write, so the project keeps its current link instead of a dead one.
 * Run the script again once the site is up.
 */
async function liveOrSkip(label: string, patch: Record<string, unknown>) {
  const url = patch.demoOverride;
  if (typeof url !== "string" || !url) return patch;
  const status = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) })
    .then((r) => {
      void r.body?.cancel();
      return r.status;
    })
    .catch(() => 0);
  if (status === 200) return patch;
  console.log(`${label}: live link ${url} answered ${status || "no response"}; left out (run again when it is up)`);
  const { demoOverride: _skip, ...rest } = patch;
  void _skip;
  return rest;
}

/** --hide / --show: flip the hidden flag only (case-insensitive repo names). */
async function setHidden(names: string[], hidden: boolean) {
  await connect();
  let failed = 0;
  for (const name of names) {
    const r = await Project.updateOne({ name }, { $set: { hidden } }).collation({ locale: "en", strength: 2 });
    if (!r.matchedCount) failed++;
    console.log(`${name}: ${r.matchedCount ? (hidden ? "hidden" : "shown") : "not found"}`);
  }
  return failed;
}

/** --showcase: fullStack = true for SHOWCASE, false for the rest (case-insensitive names). */
async function setShowcase() {
  const want = new Set(SHOWCASE.map((n) => n.toLowerCase()));
  if (dryRun && !process.env.MONGODB_URI) {
    console.log(`would set fullStack=true for: ${SHOWCASE.join(", ")}; false for every other project`);
    return 0;
  }
  await connect();
  const all = (await Project.find({}, { name: 1, fullStack: 1, hidden: 1 }).lean()) as any[];
  for (const p of all) {
    const on = want.has(String(p.name).toLowerCase());
    if (!dryRun && p.fullStack !== on) await Project.updateOne({ _id: p._id }, { $set: { fullStack: on } });
    console.log(`${p.name}: ${on ? "on the belt" : "-"}${p.hidden ? " (hidden)" : ""}${dryRun ? " (dry run)" : ""}`);
  }
  const missing = SHOWCASE.filter((n) => !all.some((p) => String(p.name).toLowerCase() === n.toLowerCase()));
  if (missing.length) console.log(`not in the database yet (add them first, e.g. --only antiqa-portfolio): ${missing.join(", ")}`);
  return 0;
}

/** Expires the site's cached profile / project data (frontend app/admin-revalidate). Never prints the secret. */
async function revalidateSite() {
  if (dryRun || args.includes("--no-revalidate")) return;
  const site = (process.env.SITE_URL || "https://antiqa-portfolio.vercel.app").replace(/\/$/, "");
  // the token only ever goes over https
  if (!/^https:\/\//i.test(site)) {
    console.log("site cache: not expired (SITE_URL must be https; the token is never sent over plain http)");
    return;
  }
  if (!process.env.CRON_SECRET) {
    console.log("site cache: not expired (CRON_SECRET is not set); the site shows the change within a few minutes");
    return;
  }
  try {
    const r = await fetch(`${site}/admin-revalidate`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    console.log(`site cache: ${r.ok ? "expired, the change is live" : `not expired (HTTP ${r.status})`}`);
  } catch (e) {
    console.log(`site cache: not expired (${errMsg(e)})`);
  }
}

async function main() {
  const failed = await run();
  await revalidateSite();
  return failed;
}

async function run() {
  if (showcase) return setShowcase();
  if (hide || show) {
    if (dryRun) throw new Error("--hide/--show write directly; there is no dry run");
    return (hide ? await setHidden(hide, true) : 0) + (show ? await setHidden(show, false) : 0);
  }
  // validate everything first with the same rules as the admin PATCH
  const plan = ENTRIES.map((e) => {
    const ref = parseRepoUrl(e.repo);
    if (!ref) throw new Error(`bad repo url: ${e.repo}`);
    return { ref, patch: ProjectPatch.parse(e.patch), allowPrivate: !!e.allowPrivate };
  }).filter((e) => !only || only.has(e.ref.name.toLowerCase()));
  if (!plan.length) throw new Error("--only matched no entry");

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
    for (const { ref, patch, allowPrivate } of plan) {
      try {
        const s = await fetchSnapshot(ref, { allowPrivate });
        const state = db ? ((await Project.exists({ owner: ref.owner, name: ref.name }).collation({ locale: "en", strength: 2 })) ? "update" : "new") : "?";
        console.log(`\n${s.owner}/${s.name}: ok (${state})`);
        console.log(`  github: ${s.description || "(no description)"} | homepage: ${s.homepage ?? "-"} | topics: ${s.topics.join(", ") || "-"}${s.private ? " | PRIVATE (no code link, no README)" : ""}`);
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
    for (const { ref, patch, allowPrivate } of plan) {
      const label = `${ref.owner}/${ref.name}`;
      try {
        let p: any = await Project.findOne(ref).collation({ locale: "en", strength: 2 });
        const created = !p;
        p ??= new Project({ ...ref, repoUrl: `https://github.com/${ref.owner}/${ref.name}` });
        p.set(await liveOrSkip(label, patch));
        await sync(p); // same GitHub snapshot + sanitizing as POST /api/projects; saves
        const err = p.syncError || (p.privateRepo && !allowPrivate ? "private repository: set allowPrivate on the entry" : "");
        if (err) {
          if (created) await p.deleteOne();
          throw new Error(err);
        }
        console.log(`${label}: ok (${created ? "created" : "updated"})`);
      } catch (e) {
        failed++;
        console.log(`${label}: error (${errMsg(e)})`);
      }
    }
    if (refreshAll) {
      const mine = new Set(plan.map((p) => `${p.ref.owner}/${p.ref.name}`.toLowerCase()));
      const rest = (await Project.find()).filter((p: any) => !mine.has(`${p.owner}/${p.name}`.toLowerCase()));
      for (const p of rest as any[]) {
        await sync(p);
        const hp = p.gh?.homepage || "";
        const note = p.demoOverride && hp && p.demoOverride !== hp ? ` — note: demo override ${p.demoOverride} wins over the new homepage ${hp}` : "";
        if (p.syncError) failed++;
        console.log(`${p.owner}/${p.name}: ${p.syncError ? `error (${p.syncError})` : "refreshed"}${p.hidden ? " (hidden)" : ""}${note}`);
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
