import type { L10n, Project } from "./types";

/**
 * The full-stack projects shown on the belt (owner, 2026-11-16: "təzə vaxtlar yazdığım taskları
 * qoyma, full stack olanları qoy"). The API's `fullStack` flag decides (set by
 * `upsert-projects.ts --showcase` or the admin); a project without the flag falls back to this
 * list, so the belt is right before the seed script has run. Keep in sync with SHOWCASE in
 * backend/scripts/upsert-projects.ts.
 */
const SHOWCASE_FALLBACK = new Set(
  // owner, 2026-11-17: Programmers List (task7/task6) and this portfolio are off the belt
  ["planera", "hypedomino", "jeparla", "masapay", "curtain-shop-web-site-frontend", "codelady-skills",
   "ecommerse-app", "my-fitness-app", "my-quiz-app", "hello-fresh-with-react", "net-pro-group-fiqma", "afn-rent-a-car-fiqma",
   // owner, 2026-11-18: full stack now
   "ember-olive-menu", "food-wagon-delivery-figma",
   // owner, 2026-11-21: her new project
   "share-rental",
   // Share under its old repo name, until that record is hidden after the rename (owner, 2026-11-22)
   "kirayla-rental"].map((n) => n.toLowerCase()),
);

/** on the home page belt; also the count in About, so the two numbers always agree */
export const onBelt = (p: Project) => !p.hidden && (p.fullStack ?? SHOWCASE_FALLBACK.has(p.name.toLowerCase()));

/**
 * Names that differ per language (review 2026-11-18: /en showed "Kod Sınağı · Code Check", /az
 * "HelloFresh clone (practice)"). By repo name, lower case; wins over the database title, so each
 * locale reads in its own language whatever the stored title is.
 */
const TITLES: Record<string, L10n> = {
  "my-quiz-app": { az: "Kod Sınağı", en: "Code Check" },
  "hello-fresh-with-react": { az: "HelloFresh klonu (təlim)", en: "HelloFresh clone (practice)" },
  // renamed Kirayla → Share (owner, 2026-11-22): the record stored under the old repo name reads "Share" too
  "kirayla-rental": { az: "Share", en: "Share" },
};

/** a demo in the visitor's language, where the project has one (Planera: its README links both) */
const DEMOS: Record<string, Partial<L10n>> = {
  // both locales: the stored link may still be the old domain randevum-seven.vercel.app, which redirects to the AZ home (#67, #70)
  planera: { az: "https://planera-az.vercel.app", en: "https://planera-az.vercel.app/en" },
  "share-rental": { en: "https://share-rental.vercel.app/en" },
  // the old record keeps the address its stored /az demo has
  "kirayla-rental": { en: "https://kirayla-rental.vercel.app/en" },
  "codelady-skills": { en: "https://codelady-ship.github.io/codelady-skills/en/" },
  jeparla: { en: "https://jeparla.duckdns.org/en" },
};

/** the admin panel in the visitor's language (#70: EN visitors got the AZ panel) */
const ADMINS: Record<string, Partial<L10n>> = {
  planera: { en: "https://planera-az.vercel.app/en/panel" },
  "codelady-skills": { en: "https://codelady-ship.github.io/codelady-skills/en/admin/?demo=1" },
};

/**
 * Summaries for records that have none in the database yet (#67: /az/about showed their English
 * GitHub description). A stored summary wins. Keep in sync with ENTRIES in
 * backend/scripts/upsert-projects.ts, which writes the same texts to the database.
 */
const SUMMARIES: Record<string, L10n> = {
  masapay: {
    az: "Restoranlar üçün QR əsaslı hesab bölmə və ödəniş platforması: müştəri masadakı QR kodu skan edib canlı hesabı görür, hesabı bölür, bəxşiş əlavə edir və Payriff ilə ödəyir. Komanda layihəsidir; React + TypeScript, Java Spring Boot, PostgreSQL və WebSocket üzərində qurulub.",
    en: "A QR-based bill-splitting and payment platform for restaurants: guests scan the table's QR code, see the live bill, split it, add a tip and pay via Payriff. A team project built with React + TypeScript, Java Spring Boot, PostgreSQL and WebSocket.",
  },
  "my-portfolio": {
    az: "İlk portfolio saytım: interaktiv 3D modellər, bacarıqlarım və kurslarım, canlı demo və kod linkləri olan layihələr, əlaqə forması. React, Tailwind CSS və Three.js ilə qurulub; indiki portfoliom bu saytdır.",
    en: "My first portfolio site: interactive 3D models, my skills and courses, projects with live demos and code links, and a contact form. Built with React, Tailwind CSS and Three.js; this site is the newer version.",
  },
  "basic-task-with-html-css-js": {
    az: "Actify: gündəlik vərdişləri izləmək üçün kiçik tətbiq. Vərdişini əlavə edirsən, hər gün qeyd edirsən və neçə gün ardıcıl davam etdiyini (streak) görürsən; hazır çağırışlar da var. Sadə HTML, CSS və JavaScript, məlumatlar brauzerdə saxlanır.",
    en: "Actify: a small daily habit tracker. Add your habits, tick them off every day and watch your streaks grow, with ready-made challenges. Plain HTML, CSS and JavaScript; the data stays in the browser.",
  },
  "rock-paper-scissors": {
    az: "Kompüterə qarşı “Daş-qayçı-kağız” oyunu: xal lövhəsi, son 10 raundun tarixçəsi, klaviatura düymələri (R, P, S) və oyunu sıfırlama. Sadə HTML, CSS və JavaScript ilə yazılıb; səhifəni yeniləsən də hesab itmir.",
    en: "Rock Paper Scissors against the computer: a scoreboard, the last 10 rounds, keyboard shortcuts (R, P, S) and a reset button. Plain HTML, CSS and JavaScript; the score survives a page reload.",
  },
  "task7-front-end-for-task6-": {
    az: "Proqramçılar siyahısı: ada və ya stack-ə görə axtarış, stack filtrləri, ada və yaşa görə sıralama, yeni proqramçı əlavə etmək üçün yoxlamalı forma. Next.js + TypeScript frontend və Express + MongoDB API (task6); API olmayanda demo rejimində işləyir.",
    en: "A programmers directory: search by name or stack, stack filters, sorting by name or age and a validated form to add a programmer. A Next.js + TypeScript frontend for an Express + MongoDB API (task6); without the API it runs in demo mode.",
  },
  "next-js-task-first": {
    az: "Next.js-də iki render üsulunu yan-yana müqayisə edən təlim layihəsi: eyni istifadəçi siyahısı bir səhifədə serverdə (SSR), digərində brauzerdə (CSR) yüklənir; next/image nümunələri də var. Next.js App Router, TypeScript və Tailwind CSS.",
    en: "A Next.js practice project that compares two ways of rendering side by side: the same user list loads on the server (SSR) on one page and in the browser (CSR) on another, plus next/image examples. Next.js App Router, TypeScript and Tailwind CSS.",
  },
  "react-routing-task4": {
    az: "RouteShop: React Router ilə marşrutlaşdırma təcrübəsi. DummyJSON API-dən gələn məhsullar, hər məhsulun öz səhifəsi (/product/:id), istifadəçilər siyahısı və 404 səhifəsi. React, React Router və Vite.",
    en: "RouteShop: a React Router practice app. Products from the DummyJSON API, a page per product (/product/:id), a users page and a 404 route. React, React Router and Vite.",
  },
  "exam-task-react": {
    az: "React imtahan tapşırığı: uydurma “Start Up” xidməti üçün birsəhifəlik landing. Mobil menyu, xidmətlər, üstünlüklər, qiymət planları və yoxlamalı demo əlaqə forması var. React + Vite.",
    en: "A React exam task: a one-page landing for “Start Up”, a fictional service, with a mobile menu, services, features, pricing plans and a validated demo contact form. React + Vite.",
  },
  "hello-fresh": {
    az: "Təlim layihəsi: HelloFresh açılış səhifəsinin HTML, CSS və JavaScript ilə hazırlanmış responsiv klonu. Menyu kartları, planlar və plan sorğuları üçün arxasında Java Spring Boot REST API var; API qoşulmayanda səhifə öz statik məzmunu ilə açılır. HelloFresh ilə əlaqəsi yoxdur.",
    en: "Practice project: a responsive clone of the HelloFresh landing page in HTML, CSS and JavaScript, backed by a Java Spring Boot REST API for menu cards, plans and plan requests; without the API the page keeps its static content. Not affiliated with HelloFresh.",
  },
  "fiqma6-responsivlik-task": {
    az: "Təlim layihəsi: Figma dizaynı əsasında məktəb profili səhifəsi (mətnlər dizayndakı kimi indoneziya dilindədir). Foto qalereya, məlumat kartları, əlçatan cədvəllər və mobil menyu; 390 px-dən 1920 px-ədək ekranlarda yoxlanılıb. HTML, CSS və JavaScript.",
    en: "Practice project: a responsive school profile page built from a Figma design (in Indonesian, as in the design), with a photo gallery, info cards, accessible tables and a mobile menu, checked from 390 to 1920 px. HTML, CSS and JavaScript.",
  },
};

/** The project as the given locale shows it: its name, demo and admin panel in that language, and a summary where the record has none. */
export function localizeProject(p: Project, locale: "az" | "en"): Project {
  const key = p.name.toLowerCase();
  const title = TITLES[key]?.[locale];
  const demo = p.demoUrl ? DEMOS[key]?.[locale] : undefined;
  const admin = p.adminUrl ? ADMINS[key]?.[locale] : undefined;
  const fallback = SUMMARIES[key];
  const summary = fallback && !p.summary?.[locale] ? { az: p.summary?.az || fallback.az, en: p.summary?.en || fallback.en } : undefined;
  return title || demo || admin || summary
    ? { ...p, ...(title && { title }), ...(demo && { demoUrl: demo }), ...(admin && { adminUrl: admin }), ...(summary && { summary }) }
    : p;
}

export const localizeProjects = (list: Project[], locale: "az" | "en") => list.map((p) => localizeProject(p, locale));

/**
 * The projects About, /llms*.txt and the FAQ list and count (#67): no hidden record and one entry per
 * shown name. When two records show the same name (Codelady Skills: the site's public repo and the old
 * private scholarship-visa-scam-checker record), the public one stays; otherwise the first in the list.
 */
export function visibleProjects(list: Project[]): Project[] {
  const byTitle = new Map<string, Project>();
  for (const p of list) {
    if (p.hidden) continue;
    const key = p.title.trim().toLowerCase();
    const kept = byTitle.get(key);
    if (!kept || (kept.privateRepo && !p.privateRepo)) byTitle.set(key, p);
  }
  const keep = new Set(byTitle.values());
  return list.filter((p) => keep.has(p));
}

/** below this share a repo language is noise (a config script, a stray file); the home belt chips use the same cut */
export const MIN_LANGUAGE_PERCENT = 5;
/** GitHub "languages" that are build, deploy or script files, not what the project is written in (#70) */
const NOT_LANGUAGES = new Set(["dockerfile", "shell", "makefile", "procfile", "batchfile", "powershell", "cmake", "nix", "hcl"]);

/** The project's languages as About and /llms*.txt list them: at least 5 % of the code, no build files. */
export const projectLanguages = (p: Project) =>
  p.languages.filter((l) => l.percent >= MIN_LANGUAGE_PERCENT && !NOT_LANGUAGES.has(l.name.toLowerCase())).map((l) => l.name);
