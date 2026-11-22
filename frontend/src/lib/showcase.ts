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
  planera: { az: "https://planera-az.vercel.app" },
  "share-rental": { en: "https://share-rental.vercel.app/en" },
  // the old record keeps the address its stored /az demo has
  "kirayla-rental": { en: "https://kirayla-rental.vercel.app/en" },
};

/** The project as the given locale shows it: its name in that language and its localized demo. */
export function localizeProject(p: Project, locale: "az" | "en"): Project {
  const key = p.name.toLowerCase();
  const title = TITLES[key]?.[locale];
  const demo = p.demoUrl ? DEMOS[key]?.[locale] : undefined;
  return title || demo ? { ...p, ...(title && { title }), ...(demo && { demoUrl: demo }) } : p;
}

export const localizeProjects = (list: Project[], locale: "az" | "en") => list.map((p) => localizeProject(p, locale));
