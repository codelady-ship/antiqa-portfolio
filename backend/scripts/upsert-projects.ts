// Adds or refreshes the owner's featured projects (GitHub snapshot + az/en summary + order + links).
// Run from backend/:  GITHUB_TOKEN=$(gh auth token) npx tsx scripts/upsert-projects.ts [--dry-run] [--only a,b] [--env <path to .env>]
//   --dry-run  fetches GitHub data and prints what would be written; no database writes
//              (if MONGODB_URI is set it only reads, to say "new" or "update").
//   --only     comma-separated repo names: run just these entries (e.g. --only jeparla)
//   --refresh-all  also re-reads EVERY other project in the database from GitHub (homepage →
//              live link, description, languages, stars, dates); owner overrides stay. Use it after
//              repo fixes change homepages or descriptions. Warns when a demo override hides a new homepage.
//   A full run (no --only) also hides the RETIRED records (hidden: true, nothing is deleted), e.g. the old
//              private scholarship-visa-scam-checker record that showed Codelady Skills twice (#67).
//   --hide a,b / --show a,b  only sets the "hidden" flag of these projects (no GitHub calls), e.g.
//              --hide exam-task-react,React-Routing-task4
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

/** existingOnly: update the record if it is in the database, never create it; azOnly: of the summary, write only az */
type Entry = { repo: string; patch: Record<string, unknown>; allowPrivate?: boolean; existingOnly?: boolean; azOnly?: boolean };

/**
 * The projects on the home page belt (owner, 2026-11-16: "təzə vaxtlar yazdığım taskları qoyma,
 * full stack olanları qoy"): a frontend and a backend of her own. Keep in sync with
 * SHOWCASE_FALLBACK in frontend/src/lib/showcase.ts.
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
  "My-Quiz-App", // Code Check (az: Kod Sınağı, frontend lib/showcase.ts): React + Vite, Express + MongoDB
  "hello-fresh-with-react", // HelloFresh clone: React + Vite, Express + MongoDB
  "net-pro-group-fiqma", // Net Pro Group: HTML/CSS/JS, Express + MongoDB
  "AFN-rent-a-car-fiqma", // AFN Rent a Car: React + TypeScript, Express + MongoDB
  // owner, 2026-11-18: full stack now (frontend/ + backend/ + render.yaml)
  "ember-olive-menu", // Ember & Olive: React + Three.js + GSAP (Vite), Express + MongoDB
  "Food-Wagon-delivery-figma", // Food Wagon: React + TypeScript + Tailwind (Vite), Express + MongoDB
  // owner, 2026-11-21: her new project
  "share-rental", // Share (formerly Kirayla): Next.js + Spring Boot + PostgreSQL
  // the same project under its old repo name: keeps the belt right until the renamed record exists;
  // hide the old record after the rename (--hide kirayla-rental)
  "kirayla-rental",
  // owner, 2026-11-17: Programmers List (task7/task6) and this portfolio are off the belt
];

const ENTRIES: Entry[] = [
  {
    repo: "https://github.com/codelady-ship/planera",
    patch: {
      featured: true,
      // read-only demo admin (planera #141): /panel redirects to the login page with the demo button
      adminUrl: "https://planera-az.vercel.app/panel",
      adminHint: "“Demo admin kimi bax” → demo@planera.az / demo1234 (read-only)",
      hidden: false,
      order: 40,
      // the stored link was the old domain randevum-seven.vercel.app, which only redirects here (#67)
      demoOverride: "https://planera-az.vercel.app",
      summary: {
        az: "Onlayn randevu platforması: xidmət göstərəni tap, boş saatı seç və randevunu bir neçə kliklə götür. Frontend Next.js və TypeScript, backend Java Spring Boot və PostgreSQL üzərində qurulub.",
        en: "An online booking platform: find a service provider, pick a free slot and book an appointment in a few clicks. Built with a Next.js + TypeScript frontend and a Java Spring Boot + PostgreSQL backend.",
      },
    },
  },
  {
    // owner, 2026-11-21: on the belt. The live site is browse-only for now (the API is not deployed yet:
    // it shows the bundled snapshot of the seed), so no adminUrl / adminHint until the API is up. It can
    // be framed (its CSP frame-ancestors names the portfolio). English demo: /en (frontend lib/showcase.ts)
    // owner, 2026-11-22: renamed Kirayla → Share (repo kirayla-rental → share-rental, demo share-rental.vercel.app)
    repo: "https://github.com/codelady-ship/share-rental",
    patch: {
      title: "Share",
      featured: true,
      hidden: false,
      order: 35,
      demoOverride: "https://share-rental.vercel.app/az",
      summary: {
        az: "Bakı, Gəncə və Sumqayıt üçün əşya kirayəsi platforması: fotoaparat, drel, çadır və ya velosipedini günlük kirayəyə ver; kirayəçi tarix seçir, sahibi qəbul və ya rədd edir. Filtrli axtarış, boş günlər təqvimi, rəylər, mesajlaşma, elan sahibi və admin panelləri. Next.js + TypeScript frontend, Java 21 + Spring Boot və PostgreSQL API.",
        en: "A peer-to-peer rental marketplace for Baku, Ganja and Sumgait: list a camera, a drill, a tent or a bike by the day; renters pick dates and the owner accepts or declines. Search with filters, an availability calendar, reviews, messaging, and host and admin dashboards. A Next.js + TypeScript frontend with a Java 21 + Spring Boot + PostgreSQL API.",
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
    // private repo (no code link); live since 2026-11-17. Owner, 2026-11-21: the demo opens on the home page
    // (its hero), not on the merchant area, which starts with a login page
    repo: "https://github.com/codelady-ship/jeparla",
    allowPrivate: true,
    patch: {
      title: "Jeparla",
      featured: true,
      hidden: false,
      comingSoon: false,
      demoOverride: "https://jeparla.duckdns.org/az",
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
        // the pitch first: the belt caption shows the first ~180 characters (#67: it read only "Komanda layihəsi.")
        az: "Restoranlar üçün QR əsaslı hesab bölmə və ödəniş platforması: müştəri masadakı QR kodu skan edib canlı hesabı görür, hesabı bölür, bəxşiş əlavə edir və Payriff ilə ödəyir. Komanda layihəsidir; React + TypeScript, Java Spring Boot, PostgreSQL və WebSocket üzərində qurulub.",
        en: "A QR-based bill-splitting and payment platform for restaurants: guests scan the table's QR code, see the live bill, split it, add a tip and pay via Payriff. A team project built with React + TypeScript, Java Spring Boot, PostgreSQL and WebSocket.",
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
      adminUrl: "https://codelady-ship.github.io/Curtain-shop-web-site-frontend/admin/", // public demo admin (read-only role or in-browser sandbox)
      adminHint: "“Demo admin” → demo / demo1234 (read-only)",
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
    // one: it is in RETIRED, so a full run hides it)
    repo: "https://github.com/codelady-ship/codelady-skills",
    patch: {
      title: "Codelady Skills",
      featured: true,
      hidden: false,
      comingSoon: false,
      demoOverride: "https://codelady-ship.github.io/codelady-skills/az/",
      adminUrl: "https://codelady-ship.github.io/codelady-skills/az/admin/?demo=1", // signs in as the demo admin (in-browser sample data)
      adminHint: "Opens as the demo admin (admin@mock.test): sample data, changes are not saved",
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
      adminUrl: "https://codelady-ship.github.io/Ecommerse-app/admin/", // public demo admin (read-only role or in-browser sandbox)
      adminHint: "“Demo admin” → demo@hueline.az / demo1234 (read-only)",
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
      // starts the read-only demo admin by itself (My-Fitness-App #8); frameable after its #7 (frame-ancestors)
      adminUrl: "https://my-fitness-app-tau-drab.vercel.app/login?demo=admin",
      adminHint: "Opens as the demo admin (demo-admin@pulsa.example / pulsa-demo-admin), read-only",
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
      title: "Code Check",
      featured: true,
      hidden: false,
      order: 12,
      demoOverride: "https://codelady-ship.github.io/My-Quiz-App/",
      adminUrl: "https://codelady-ship.github.io/My-Quiz-App/#/admin", // public demo admin (read-only role or in-browser sandbox)
      adminHint: "“Demo admin” → demo@codecheck.az / demo1234 (read-only)",
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
      adminUrl: "https://codelady-ship.github.io/hello-fresh-with-react/#/admin", // public demo admin (read-only role or in-browser sandbox)
      adminHint: "“Demo admin” → demo@hellofresh-clone.az / demo1234 (read-only)",
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
      adminUrl: "https://codelady-ship.github.io/net-pro-group-fiqma/admin.html", // public demo admin (read-only role or in-browser sandbox)
      adminHint: "“Demo admin” → demo@netprogroup.az / demo1234 (read-only)",
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
      adminUrl: "https://codelady-ship.github.io/AFN-rent-a-car-fiqma/admin", // public demo admin (read-only role or in-browser sandbox)
      adminHint: "“Demo admin” → admin@afn.demo / demo12345 (read-only)",
      summary: {
        az: "Bakı üçün avtomobil icarəsi saytı (Figma dizaynı əsasında təlim layihəsi): avtopark və filtrlər, avtomobil səhifəsi, onlayn rezervasiya (qiyməti server hesablayır, eyni günlərə ikinci rezervasiya mümkün deyil). React + TypeScript frontend və Node.js + Express + MongoDB API.",
        en: "A car rental site for Baku, built from a Figma design (practice project): fleet with filters, car pages and online booking (the server prices it and blocks double bookings). A React + TypeScript frontend with a Node.js + Express + MongoDB API.",
      },
    },
  },
  {
    // full stack: frontend/ + Node.js / Express / MongoDB API in backend/ (owner, 2026-11-18: on the belt)
    repo: "https://github.com/codelady-ship/ember-olive-menu",
    patch: {
      title: "Ember & Olive",
      featured: true,
      hidden: false,
      order: 7,
      demoOverride: "https://codelady-ship.github.io/ember-olive-menu/",
      adminUrl: "https://codelady-ship.github.io/ember-olive-menu/#/admin", // public demo admin (read-only role or in-browser sandbox)
      adminHint: "“Demo admin” → demo@ember-olive.demo / demo1234 (read-only)",
      summary: {
        az: "Uydurma Ember & Olive restoranı üçün sayt: menyu dəri kitabdır, səhifəni çevirəndə imza yeməkləri 3D olaraq səhifədən qalxır. Masa rezervasiyası, sifariş, bülleten və menyu idarəsi; React + Three.js + GSAP frontend və Node.js + Express + MongoDB API.",
        en: "A site for Ember & Olive, a fictional restaurant: the menu is a leather book, and signature dishes rise off the page in 3D as you turn it. Table bookings, takeaway orders, a newsletter and menu management; a React + Three.js + GSAP frontend with a Node.js + Express + MongoDB API.",
      },
    },
  },
  {
    // full stack since 2026-11-18: frontend/ + Node.js / Express / MongoDB API in backend/ (owner: on the belt)
    repo: "https://github.com/codelady-ship/Food-Wagon-delivery-figma",
    patch: {
      title: "Food Wagon",
      featured: true,
      hidden: false,
      order: 6,
      demoOverride: "https://codelady-ship.github.io/Food-Wagon-delivery-figma/",
      adminUrl: "https://codelady-ship.github.io/Food-Wagon-delivery-figma/admin.html", // public demo admin (read-only role or in-browser sandbox)
      adminHint: "“Demo admin” → admin@foodwagon.demo / demo-admin (read-only)",
      summary: {
        az: "Bakı üçün demo yemək çatdırılması saytı: restoran axtarışı və filtrlər, səbət, sifarişin canlı izlənməsi, sevimlilər, rəylər və admin panel. Figma təlim səhifəsindən full stack layihəyə çevrilib: React + TypeScript + Tailwind frontend və Node.js + Express + MongoDB API. Demo layihədir, real sifariş yoxdur.",
        en: "A demo food delivery site for Baku: restaurant search and filters, cart, live order tracking, favourites, reviews and an admin panel. Rebuilt from a Figma practice page into a full-stack app: a React + TypeScript + Tailwind frontend with a Node.js + Express + MongoDB API. A demo: no real orders.",
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
  // #67: the earlier practice projects had no AZ summary, so /az/about showed their English GitHub
  // description. Only summary.az is written: the stored summary.en (empty = the GitHub description) and
  // their flags, order and links stay as they are. Like every entry (and like an admin save), the update
  // also calls sync(p), which re-reads the GitHub description, languages, homepage and README. The same
  // texts are the site's fallback (SUMMARIES_AZ in frontend/src/lib/showcase.ts): keep the two in sync.
  ...summaryOnly({
    "my-portfolio": "İlk portfolio saytım: interaktiv 3D modellər, bacarıqlarım və kurslarım, canlı demo və kod linkləri olan layihələr, əlaqə forması. React, Tailwind CSS və Three.js ilə qurulub; indiki portfoliom bu saytdır.",
    "basic-task-with-Html-Css-Js": "Actify: gündəlik vərdişləri izləmək üçün kiçik tətbiq. Vərdişini əlavə edirsən, hər gün qeyd edirsən və neçə gün ardıcıl davam etdiyini (streak) görürsən; hazır çağırışlar da var. Sadə HTML, CSS və JavaScript, məlumatlar brauzerdə saxlanır.",
    "rock-paper-scissors": "Kompüterə qarşı “Daş-qayçı-kağız” oyunu: xal lövhəsi, son 10 raundun tarixçəsi, klaviatura düymələri (R, P, S) və oyunu sıfırlama. Sadə HTML, CSS və JavaScript ilə yazılıb; səhifəni yeniləsən də hesab itmir.",
    "task7-front-end-for-task6-": "Proqramçılar siyahısı: ada və ya stack-ə görə axtarış, stack filtrləri, ada və yaşa görə sıralama, yeni proqramçı əlavə etmək üçün yoxlamalı forma. Next.js + TypeScript frontend və Express + MongoDB API (task6); API olmayanda demo rejimində işləyir.",
    "next-js-task-first": "Next.js-də iki render üsulunu yan-yana müqayisə edən təlim layihəsi: eyni istifadəçi siyahısı bir səhifədə serverdə (SSR), digərində brauzerdə (CSR) yüklənir; next/image nümunələri də var. Next.js App Router, TypeScript və Tailwind CSS.",
    "React-Routing-task4": "RouteShop: React Router ilə marşrutlaşdırma təcrübəsi. DummyJSON API-dən gələn məhsullar, hər məhsulun öz səhifəsi (/product/:id), istifadəçilər siyahısı və 404 səhifəsi. React, React Router və Vite.",
    "exam-task-react": "React imtahan tapşırığı: uydurma “Start Up” xidməti üçün birsəhifəlik landing. Mobil menyu, xidmətlər, üstünlüklər, qiymət planları və yoxlamalı demo əlaqə forması var. React + Vite.",
    "hello-fresh": "Təlim layihəsi: HelloFresh açılış səhifəsinin HTML, CSS və JavaScript ilə hazırlanmış responsiv klonu. Menyu kartları, planlar və plan sorğuları üçün arxasında Java Spring Boot REST API var; API qoşulmayanda səhifə öz statik məzmunu ilə açılır. HelloFresh ilə əlaqəsi yoxdur.",
    "fiqma6-responsivlik-task": "Təlim layihəsi: Figma dizaynı əsasında məktəb profili səhifəsi (mətnlər dizayndakı kimi indoneziya dilindədir). Foto qalereya, məlumat kartları, əlçatan cədvəllər və mobil menyu; 390 px-dən 1920 px-ədək ekranlarda yoxlanılıb. HTML, CSS və JavaScript.",
  }),
];

/** entries that set only summary.az of an existing repo (summary.en keeps its stored value) */
function summaryOnly(byRepo: Record<string, string>): Entry[] {
  return Object.entries(byRepo).map(([name, az]) => ({ repo: `https://github.com/codelady-ship/${name}`, patch: { summary: { az } }, existingOnly: true, azOnly: true }));
}

/**
 * Records a full run hides (hidden: true; they stay in the database). scholarship-visa-scam-checker:
 * the old private record of Codelady Skills, replaced by the codelady-skills entry above; it showed the
 * project twice on /about and /llms*.txt (#67). --show <name> brings one back.
 */
export const RETIRED = ["scholarship-visa-scam-checker"];

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
  let out = patch;
  // the admin link the same way: an admin page whose PR is not deployed yet gets no Admin tab (adminHint goes with it)
  for (const [key, name, drop] of [
    ["demoOverride", "live link", ["demoOverride"]],
    ["adminUrl", "admin link", ["adminUrl", "adminHint"]],
  ] as const) {
    const url = out[key];
    if (typeof url !== "string" || !url) continue;
    const status = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) })
      .then((r) => {
        void r.body?.cancel();
        return r.status;
      })
      .catch(() => 0);
    if (status === 200) continue;
    console.log(`${label}: ${name} ${url} answered ${status || "no response"}; left out (run again when it is up)`);
    out = Object.fromEntries(Object.entries(out).filter(([k]) => !(drop as readonly string[]).includes(k)));
  }
  return out;
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
    return { ref, patch: ProjectPatch.parse(e.patch), allowPrivate: !!e.allowPrivate, existingOnly: !!e.existingOnly, azOnly: !!e.azOnly };
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
    for (const { ref, patch, allowPrivate, existingOnly } of plan) {
      try {
        const s = await fetchSnapshot(ref, { allowPrivate });
        const state = db ? ((await Project.exists({ owner: ref.owner, name: ref.name }).collation({ locale: "en", strength: 2 })) ? "update" : existingOnly ? "not in the database: skipped" : "new") : "?";
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
    if (!only) console.log(`\nwould hide (RETIRED): ${RETIRED.join(", ")}`);
  } else {
    await connect();
    for (const { ref, patch, allowPrivate, existingOnly, azOnly } of plan) {
      const label = `${ref.owner}/${ref.name}`;
      try {
        let p: any = await Project.findOne(ref).collation({ locale: "en", strength: 2 });
        if (!p && existingOnly) {
          console.log(`${label}: not in the database, skipped (this entry only updates)`);
          continue;
        }
        const created = !p;
        p ??= new Project({ ...ref, repoUrl: `https://github.com/${ref.owner}/${ref.name}` });
        // azOnly: ProjectPatch fills a missing en with "", so put the stored en back (#67: EN stays as it was)
        const own = azOnly && patch.summary ? { ...patch, summary: { az: patch.summary.az, en: p.summary?.en ?? "" } } : patch;
        p.set(await liveOrSkip(label, own));
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
    // a full run (not --only) also hides the retired records; a name no longer in the database is fine
    if (!only) {
      for (const name of RETIRED) {
        const r = await Project.updateOne({ owner: "codelady-ship", name }, { $set: { hidden: true } }).collation({ locale: "en", strength: 2 });
        console.log(`${name}: ${r.matchedCount ? "hidden (retired)" : "not in the database"}`);
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
