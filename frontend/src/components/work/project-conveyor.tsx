"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PersonaFigure } from "@/components/persona/figure";
import { SushiConveyorMenu, type ConveyorDish } from "@/components/ui/sushi-conveyor-menu";
import { hasThumb } from "@/lib/seed";
import { shot } from "@/lib/shot";
import type { Project } from "@/lib/types";

/**
 * The full-stack projects shown on the belt (owner, 2026-11-16: "təzə vaxtlar yazdığım taskları
 * qoyma, full stack olanları qoy"). The API's `fullStack` flag decides (set by
 * `upsert-projects.ts --showcase` or the admin); a project without the flag falls back to this
 * list, so the belt is right before the seed script has run. Keep in sync with SHOWCASE there.
 */
const SHOWCASE_FALLBACK = new Set(
  ["planera", "hypedomino", "jeparla", "masapay", "curtain-shop-web-site-frontend", "task7-front-end-for-task6-", "antiqa-portfolio", "scholarship-visa-scam-checker"].map((n) =>
    n.toLowerCase(),
  ),
);
export const onBelt = (p: Project) => !p.hidden && (p.fullStack ?? SHOWCASE_FALLBACK.has(p.name.toLowerCase()));

/**
 * Screenshots for projects that have no public live URL yet (mShots needs one), by repo name:
 * Codelady Skills (the skills site, not deployed yet) was shot from its local build.
 */
const THUMBS: Record<string, string> = { "scholarship-visa-scam-checker": "/projects/codelady-skills.webp" };
/** the stack chips, where the repo behind the record is not the project's own code (its languages / topics) */
const STACK: Record<string, string[]> = {
  "scholarship-visa-scam-checker": ["Next.js", "TypeScript", "Supabase", "Cloudflare Workers", "Gemini API", "Claude Skills"],
};

/** topics that say nothing about the stack */
const NOISE = new Set(["portfolio", "github-pages", "practice-project", "landing-page", "responsive-design", "responsive", "vercel", "ecommerce", "azerbaijani", "bilingual"]);
const MIN_PERCENT = 5;

/** 1–2 sentences (≤ 180 chars) for the caption and the dialog. */
export function blurb(p: Project, locale: "az" | "en") {
  const text = (p.summary?.[locale] || p.description || "").trim();
  if (!text) return "";
  // a sentence ends at . ! ? followed by a space and a capital letter (not inside "Next.js" or "3.5")
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-ZƏÖÜÇŞİĞ“"(])/u);
  let out = sentences[0].trim();
  if (sentences[1] && out.length + sentences[1].length <= 180) out += ` ${sentences[1].trim()}`;
  return out.length > 180 ? `${out.slice(0, 177).trimEnd()}…` : out;
}

/** plate ring colour: 1 rose = live demo, 2 violet = code only, 4 gold = coming soon */
const tierOf = (p: Project) => (p.comingSoon ? 4 : p.demoUrl ? 1 : 2);

const button =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-ink px-5 py-2 text-sm font-semibold shadow-[3px_3px_0_var(--ink)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose motion-reduce:transition-none";

/**
 * Projects (#43): her full-stack work goes round on a conveyor belt (SushiConveyorMenu, 21st.dev)
 * and she stands on the island in the middle. Hover / focus stops the belt and lifts a plate; a
 * click opens it with the description, the stack (translate="no") and the live / code links.
 * The figure on the island is the "work" slot the travelling persona lands on (persona-traveler.tsx
 * reads `.ring-stage` for the landing scroll position).
 */
export function ProjectConveyor({
  projects,
  locale,
  header,
  onDetails,
  githubUrl,
}: {
  projects: Project[];
  locale: "az" | "en";
  header: ReactNode;
  onDetails: (p: Project) => void;
  githubUrl: string;
}) {
  const t = useTranslations("Work");
  const byId = new Map(projects.map((p) => [p.id, p]));

  const items: ConveyorDish[] = projects.map((p) => {
    const langs = p.languages.filter((l) => l.percent >= MIN_PERCENT).map((l) => l.name);
    const topics = p.topics.filter((x) => !NOISE.has(x) && !langs.some((l) => l.toLowerCase() === x));
    return {
      id: p.id,
      name: p.title,
      description: blurb(p, locale) || undefined,
      tier: tierOf(p),
      image: THUMBS[p.name.toLowerCase()] ?? (p.demoUrl && hasThumb(p.repoUrl) ? shot(p.demoUrl, 480) : undefined),
      cover: true,
      initial: p.title.charAt(0),
      details: STACK[p.name.toLowerCase()] ?? [...langs, ...topics].slice(0, 9),
    };
  });

  const figure = (
    // the "work" slot: the static figure shows without JS / with reduced motion, and the travelling
    // figure lands on this box (persona-traveler.tsx + globals.css .persona-live rules)
    <div data-persona-slot="work" className="relative aspect-[677/800] w-full">
      <div className="ring-figure persona-static">
        <PersonaFigure alt="" sizes="(min-width: 1024px) 200px, 140px" />
      </div>
    </div>
  );

  return (
    <SushiConveyorMenu
      className="ring-stage"
      items={items}
      header={header}
      beltLabel={t("beltLabel")}
      caption={t("beltCaption")}
      centerpiece={figure}
      centerWidth={1.15}
      spacing={1.6}
      curve={1.5}
      minPlate={64}
      // measured belt sizes (width / height) for these props: phones ~1.6, tablets ~2.07, ≥ 1024 ~1.74
      initialClass="aspect-[1.6] sm:aspect-[2.07] lg:aspect-[1.74]"
      technicalDetails
      speed={22}
      labels={{ add: t("details"), close: t("close"), previous: t("previous"), next: t("next"), pause: t("pause") }}
      action={
        <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-rose underline underline-offset-4 hover:no-underline">
          {t("allOnGithub")} <span aria-hidden>↗</span>
        </a>
      }
      renderActions={(item, close) => {
        const p = byId.get(item.id);
        if (!p) return null;
        const links: ReactNode[] = [];
        if (p.comingSoon) {
          links.push(
            <span key="soon" className="rounded-full bg-butter-soft px-4 py-2 text-sm font-semibold text-ink">
              {t("comingSoon")}
            </span>,
          );
        } else if (p.demoUrl) {
          links.push(
            <a key="live" href={p.demoUrl} target="_blank" rel="noopener noreferrer" className={`${button} bg-accent text-on-accent`}>
              {t("live")} <span aria-hidden>↗</span>
            </a>,
          );
        }
        if (p.repoUrl) {
          links.push(
            <a key="code" href={p.repoUrl} target="_blank" rel="noopener noreferrer" className={`${button} bg-surface text-ink`}>
              <span translate="no" className="notranslate">GitHub</span> <span aria-hidden>↗</span>
            </a>,
          );
        }
        links.push(
          <button
            key="more"
            type="button"
            onClick={() => {
              close();
              onDetails(p);
            }}
            className="min-h-11 px-2 text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink"
          >
            {t("details")}
          </button>,
        );
        return links;
      }}
    />
  );
}
