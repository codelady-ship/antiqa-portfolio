"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { PersonaClip } from "@/components/persona/clip";
import { PERSONA } from "@/components/persona/config";
import { SushiConveyorMenu, type ConveyorDish } from "@/components/ui/sushi-conveyor-menu";
import { blurb } from "@/lib/blurb";
import { hasThumb } from "@/lib/seed";
import { MIN_LANGUAGE_PERCENT } from "@/lib/showcase";
import { shot } from "@/lib/shot";
import type { Project } from "@/lib/types";

// which projects go on the belt lives in lib/showcase.ts (About counts the same list)
export { onBelt } from "@/lib/showcase";
export { blurb } from "@/lib/blurb";

/**
 * Fixed screenshots instead of the live-site shot (mShots), by repo name: Codelady Skills was shot
 * from its own build (its first view is an animated intro); HUELINE's first view is a loading
 * screen for mShots and HypeDomino has no web demo (a Unity game), so both were captured with
 * Playwright on 2026-11-18 (HUELINE: its live site; HypeDomino: the game screen on its IdeyaNest page).
 * Food Wagon and Ember & Olive: their live sites' first view (Playwright, 2026-11-18; Food Wagon's
 * "demo mode" note closed, Ember & Olive's open menu book).
 */
const THUMBS: Record<string, string> = {
  "codelady-skills": "/projects/codelady-skills.webp",
  "ecommerse-app": "/projects/hueline.webp",
  hypedomino: "/projects/hypedomino.webp",
  "food-wagon-delivery-figma": "/projects/food-wagon.webp",
  "ember-olive-menu": "/projects/ember-olive.webp",
  // the hero of its home page (Playwright, 2026-11-21; owner: the card shows the main screen, not the login)
  jeparla: "/projects/jeparla.webp",
  // the first view of its live home page: the listing cards, the wordmark and the search (Playwright, 2026-11-21)
  "share-rental": "/projects/kirayla.webp",
  // the same project under its old repo name (renamed Kirayla → Share, 2026-11-22), until that record is hidden
  "kirayla-rental": "/projects/kirayla.webp",
};
/**
 * the plates draw these 960 px screenshots at 30–150 px, so they load the small copies made by
 * scripts/project-thumbs.mjs (<name>-160 / -320 / -480.webp); the project dialog keeps the full picture
 */
const PLATE_WIDTHS = [160, 320, 480];
const plateSrcSet = (src?: string) => src && PLATE_WIDTHS.map((w) => `${src.replace(/\.webp$/, `-${w}.webp`)} ${w}w`).join(", ");
/**
 * the stack chips, where the repo's languages / topics do not tell it: the repo behind the record is
 * not the project's own code (Codelady Skills), its topics are from before a rebuild (Food Wagon:
 * "html, css, javascript") or it has no topics (Ember & Olive)
 */
const STACK: Record<string, string[]> = {
  "codelady-skills": ["Next.js", "TypeScript", "Supabase", "Cloudflare Workers", "Gemini API", "Claude Skills"],
  "food-wagon-delivery-figma": ["React", "TypeScript", "Tailwind CSS", "Vite", "Node.js", "Express", "MongoDB"],
  "ember-olive-menu": ["React", "TypeScript", "Three.js", "GSAP", "Vite", "Node.js", "Express", "MongoDB"],
  // no topics, and its languages alone read "TypeScript, Java, JavaScript"
  "share-rental": ["Next.js", "TypeScript", "Tailwind CSS", "Java 21", "Spring Boot", "PostgreSQL", "Flyway", "JWT", "Playwright"],
  "kirayla-rental": ["Next.js", "TypeScript", "Tailwind CSS", "Java 21", "Spring Boot", "PostgreSQL", "Flyway", "JWT", "Playwright"],
};

/** topics that say nothing about the stack */
const NOISE = new Set(["portfolio", "github-pages", "practice-project", "landing-page", "responsive-design", "responsive", "vercel", "ecommerce", "azerbaijani", "bilingual"]);

/** plate ring colour: 1 rose = live demo, 2 violet = code only, 4 gold = coming soon */
const tierOf = (p: Project) => (p.comingSoon ? 4 : p.demoUrl ? 1 : 2);
const TIER_DOT: Record<number, string> = { 1: "bg-rose", 2: "bg-violet", 4: "bg-gold" };

const stackOf = (p: Project) => {
  const own = STACK[p.name.toLowerCase()];
  if (own) return own;
  const langs = p.languages.filter((l) => l.percent >= MIN_LANGUAGE_PERCENT).map((l) => l.name);
  const topics = p.topics.filter((x) => !NOISE.has(x) && !langs.some((l) => l.toLowerCase() === x));
  return [...langs, ...topics].slice(0, 9);
};

const button =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-ink px-5 py-2 text-sm font-semibold shadow-[3px_3px_0_var(--ink)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose motion-reduce:transition-none";

/**
 * Projects: her full-stack work goes round on a conveyor belt (SushiConveyorMenu, 21st.dev) and she
 * stands in the middle (owner, 2026-11-17): on desktop as video, pointing at the hovered plate (the
 * clip mirrored for plates on the other side). The left column shows the hovered / focused project
 * (title, summary, stack, links; the first project until one is picked). A click on a plate opens
 * the project modal (DemoModal), as before the belt.
 */
export function ProjectConveyor({
  projects,
  locale,
  header,
  onDetails,
  githubUrl,
  aiNote,
}: {
  projects: Project[];
  locale: "az" | "en";
  header: ReactNode;
  onDetails: (p: Project) => void;
  githubUrl: string;
  aiNote?: string;
}) {
  const t = useTranslations("Work");
  const [shown, setShown] = useState(0);
  const [side, setSide] = useState<"left" | "right" | null>(null);
  const center = useRef<HTMLDivElement>(null);

  const items: ConveyorDish[] = projects.map((p) => ({
    id: p.id,
    name: p.title,
    description: blurb(p, locale) || undefined,
    tier: tierOf(p),
    image: THUMBS[p.name.toLowerCase()] ?? (p.demoUrl && hasThumb(p.repoUrl) ? shot(p.demoUrl, 480) : undefined),
    srcSet: plateSrcSet(THUMBS[p.name.toLowerCase()]),
    cover: true,
    initial: p.title.charAt(0),
    details: stackOf(p),
  }));

  // the lifted plate: show it on the left, and she points at it (left or right of her)
  const onActive = useCallback((i: number | null) => {
    if (i === null) return setSide(null);
    setShown(i);
    const me = center.current;
    const plate = me?.closest("[data-stage]")?.querySelector<HTMLElement>(`[data-dish="${i}"]`);
    if (!me || !plate) return setSide(null);
    const a = me.getBoundingClientRect(),
      b = plate.getBoundingClientRect();
    setSide(b.left + b.width / 2 < a.left + a.width / 2 ? "left" : "right");
  }, []);

  const p = projects[Math.min(shown, projects.length - 1)];
  const stack = p ? stackOf(p) : [];
  const info = p && (
    // key: a new project slides in (globals.css .project-info)
    <div key={p.id} className="project-info rounded-[2rem] border border-line bg-surface p-6 text-left shadow-[var(--shadow)]">
      <p className="flex items-center gap-2 text-xs font-medium text-muted">
        <span aria-hidden className={`size-2.5 rounded-full ${TIER_DOT[tierOf(p)]}`} />
        {p.comingSoon ? t("legendSoon") : p.demoUrl ? t("legendLive") : t("legendCode")}
      </p>
      <h3 translate="no" className="display mt-2 text-2xl leading-tight font-semibold text-balance">{p.title}</h3>
      {blurb(p, locale) && <p className="mt-2 text-[0.95rem] leading-relaxed text-pretty text-muted">{blurb(p, locale)}</p>}
      {stack.length > 0 && (
        <ul translate="no" lang="en" className="notranslate mt-4 flex flex-wrap gap-1.5">
          {stack.map((s) => (
            <li key={s} className="rounded-full border border-line bg-bg-2 px-2.5 py-1 text-xs font-medium">
              {s}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {p.comingSoon ? (
          <span className="rounded-full bg-butter-soft px-4 py-2 text-sm font-semibold text-ink">{t("comingSoon")}</span>
        ) : (
          p.demoUrl && (
            <a href={p.demoUrl} target="_blank" rel="noopener noreferrer" className={`${button} bg-accent text-on-accent`}>
              {t("live")} <span aria-hidden>↗</span>
            </a>
          )
        )}
        {p.repoUrl && (
          <a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className={`${button} bg-surface text-ink`}>
            <span translate="no" className="notranslate">
              GitHub
            </span>{" "}
            <span aria-hidden>↗</span>
          </a>
        )}
        <button type="button" onClick={() => onDetails(p)} className="min-h-11 px-2 text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">
          {t("details")}
        </button>
      </div>
    </div>
  );

  const figure = (
    <div ref={center} className="relative w-full">
      {/* desktop: her video, pointing; smaller screens: its still frame, the same pink-suit cut-out
          (review 2026-11-18: phones and tablets showed a different photo in an arch) */}
      <PersonaClip clip={PERSONA.point} mode="point" point={side} />
    </div>
  );

  return (
    <SushiConveyorMenu
      items={items}
      header={header}
      beltLabel={t("beltLabel")}
      caption={t("beltCaption")}
      centerpiece={figure}
      centerWidth={1.15}
      // the look for ~6 projects; autoDensity fits any count from the data (1 … ~20)
      spacing={1.6}
      curve={1.5}
      autoDensity
      // measured belt sizes (width / height) for these props: phones ~1.6, tablets ~2.07, ≥ 1024 ~1.74
      initialClass="aspect-[1.6] sm:aspect-[2.07] lg:aspect-[1.74]"
      technicalDetails
      speed={22}
      labels={{ add: t("details"), close: t("close"), previous: t("previous"), next: t("next"), pause: t("pause") }}
      onActiveChange={onActive}
      onPick={(i) => projects[i] && onDetails(projects[i])}
      info={info}
      action={
        // inline-flex + min-h-11: a 44 px tall tap target without changing the text
        <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-rose underline underline-offset-4 hover:no-underline">
          {t("allOnGithub")} <span aria-hidden>&nbsp;↗</span>
        </a>
      }
      // the "AI video" note sits under the belt, centred under her (review 2026-11-18: it floated at
      // the far left under the GitHub link); desktop only, where she is a video
      note={aiNote && <span className="hidden text-xs text-muted lg:block">{aiNote}</span>}
    />
  );
}
