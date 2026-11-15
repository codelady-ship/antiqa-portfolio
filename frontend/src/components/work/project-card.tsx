"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { withNames } from "@/components/ui/no-translate";
import { formatDate } from "@/lib/date";
import { hasThumb } from "@/lib/seed";
import { shot } from "@/lib/shot";
import type { Project } from "@/lib/types";
import { isSafeFrame } from "./frame";
import { langColor } from "./lang-colors";

type Props = { project: Project; index: number; locale: "az" | "en"; onOpen: () => void };

// each card sits on its own pastel mat (#32); featured cards get pink + an offset ink shadow
const MATS = ["bg-lilac-soft", "bg-mint-soft", "bg-peach-soft", "bg-butter-soft"];

/**
 * Card: screenshot thumbnail; on hover (mouse only, after a short pause) the live site
 * loads in a scaled iframe. "View demo" opens the modal. Featured projects stand out with a
 * pink mat, an offset ink shadow and a label; the rest rotate through four pastel mats.
 */
export function ProjectCard({ project: p, index, locale, onOpen }: Props) {
  const t = useTranslations("Work");
  const card = useRef<HTMLElement>(null);
  const timer = useRef<number>(0);
  const [live, setLive] = useState(false);
  const summary = p.summary?.[locale] || p.description;
  const mat = p.featured ? "bg-pink-soft" : MATS[index % MATS.length];
  // no screenshot (no demo, a known-blank site, or the screenshot failed): a pastel initial tile
  const [broken, setBroken] = useState(false);
  const thumb = !!p.demoUrl && hasThumb(p.repoUrl) && !broken;
  const tile = MATS[(index + 1) % MATS.length];
  // tech names inside the summary stay as written when the page is machine-translated (#21)
  const names = [...p.languages.map((l) => l.name), p.title];

  const enter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !p.demoUrl || !isSafeFrame(p.demoUrl)) return;
    timer.current = window.setTimeout(() => setLive(true), 380);
  };
  const leave = () => {
    clearTimeout(timer.current);
    setLive(false);
  };

  return (
    <Reveal index={index % 3} className="h-full">
      <article
        ref={card}
        onPointerEnter={enter}
        onPointerLeave={leave}
        className={`group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-surface transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 motion-reduce:hover:translate-y-0 ${
          p.featured ? "border-2 border-ink shadow-[5px_5px_0_var(--ink)] hover:shadow-[7px_7px_0_var(--ink)]" : "border border-line shadow-[var(--shadow)]"
        }`}
      >
        {/* the screenshot sits on a pastel mat, like a print on coloured card */}
        <div className={`px-3 pt-3 ${mat}`}>
          <div className="relative aspect-[16/10] overflow-hidden rounded-t-2xl bg-bg-2">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote screenshot service, sized by CSS
            <img
              src={shot(p.demoUrl!, p.featured ? 960 : 640)}
              alt={t("shotAlt", { title: p.title })}
              loading="lazy"
              decoding="async"
              onError={() => setBroken(true)}
              className="absolute inset-0 size-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : (
            <span aria-hidden className={`display absolute inset-0 grid place-items-center text-7xl font-bold text-rose ${tile}`}>
              <span className="grid size-28 place-items-center rounded-full bg-surface shadow-[var(--shadow)]">{p.title.charAt(0)}</span>
            </span>
          )}
          {live && p.demoUrl && (
            <iframe
              src={p.demoUrl}
              title=""
              aria-hidden
              tabIndex={-1}
              loading="lazy"
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
              className="pointer-events-none absolute top-0 left-0 h-[400%] w-[400%] origin-top-left scale-25 border-0 bg-white opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            />
          )}
          <span className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-semibold shadow-sm">
            {p.demoUrl ? (
              <>
                <span aria-hidden className="size-2 rounded-full bg-mint" /> {t("live")}
              </>
            ) : (
              t("code")
            )}
          </span>
          {p.featured && (
            <span className="absolute top-3 right-3 z-10 rotate-3 rounded-full border-2 border-ink bg-butter-soft px-3 py-0.5 text-xs font-bold">★ {t("featured")}</span>
          )}
          </div>
        </div>

        <div className="relative z-20 flex flex-1 flex-col gap-3 p-5 sm:p-6">
          <div className="flex items-center justify-between text-xs font-medium text-muted">
            <span>{p.createdAt ? new Date(p.createdAt).getUTCFullYear() : ""}</span>
            <span translate="no" lang="en" className="notranslate">
              {p.languages[0]?.name}
            </span>
          </div>
          <h3 translate="no" lang="en" className="display notranslate text-2xl leading-tight font-bold sm:text-[1.75rem]">
            {p.title}
          </h3>
          {/* always three lines tall, so cards in one row end level */}
          <p className="line-clamp-3 min-h-[3lh] text-sm leading-relaxed text-muted">{summary ? withNames(summary, names) : null}</p>
          {p.topics.length > 0 ? (
            // one line on every card (all topics are listed in the modal details)
            <ul translate="no" className="notranslate flex h-6 items-center gap-1.5 overflow-hidden">
              {p.topics.slice(0, 2).map((tp) => (
                <li key={tp} className="min-w-0 truncate rounded-full bg-lilac-soft px-2.5 py-0.5 text-xs font-medium">
                  {tp}
                </li>
              ))}
              {p.topics.length > 2 && (
                <li className="shrink-0 rounded-full bg-lilac-soft px-2.5 py-0.5 text-xs font-medium">
                  <span aria-hidden>+{p.topics.length - 2}</span>
                  <span className="sr-only">{t("more", { n: p.topics.length - 2 })}</span>
                </li>
              )}
            </ul>
          ) : (
            // same height without topics, so the cards in one row stay level
            <div aria-hidden className="h-6" />
          )}
          {p.languages.length > 0 && (
            <div className="mt-auto pt-2">
              <div className="flex h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                {p.languages.map((l) => (
                  <i key={l.name} style={{ width: `${l.percent}%`, background: langColor(l.name) }} />
                ))}
              </div>
              <ul translate="no" className="notranslate mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                {p.languages.slice(0, 4).map((l) => (
                  <li key={l.name} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: langColor(l.name) }} />
                    {l.name} {l.percent.toFixed(0)}%
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line pt-4 text-sm">
            <span className="text-muted">
              {p.createdAt && <time dateTime={p.createdAt}>{formatDate(p.createdAt, locale, "short")}</time>}
              {p.stars > 0 && <span className="ml-3">★ {p.stars}</span>}
            </span>
            <span className="-my-2 flex items-center gap-1">
              <a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-11 items-center justify-center px-1.5 text-muted transition-colors hover:text-ink">
                {t("code")} ↗
              </a>
              {p.backendUrl && (
                <a href={p.backendUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-11 items-center justify-center px-1.5 text-muted transition-colors hover:text-ink">
                  {t("backend")} ↗
                </a>
              )}
            </span>
          </div>
          {!!p.links?.length && (
            // one line: the first link + "+N" (every link is listed in the modal details)
            <ul aria-label={t("links")} className="-mt-2 -ml-1.5 flex items-center gap-x-1">
              <li className="min-w-0">
                <a
                  href={p.links[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  translate="no"
                  className="notranslate flex min-h-11 items-center px-1.5 text-xs font-medium text-violet underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  <span className="truncate">{p.links[0].label}</span>&nbsp;↗
                </a>
              </li>
              {p.links.length > 1 && (
                <li className="shrink-0 text-xs text-muted">
                  <span aria-hidden>+{p.links.length - 1}</span>
                  <span className="sr-only">{t("more", { n: p.links.length - 1 })}</span>
                </li>
              )}
            </ul>
          )}
          <button
            type="button"
            onClick={onOpen}
            data-open-project={p.id}
            className={`min-h-11 rounded-full border-2 border-ink py-2.5 text-sm font-semibold transition-colors ${p.featured ? "bg-accent text-on-accent hover:bg-ink hover:text-bg" : "bg-surface hover:bg-pink-soft"}`}
          >
            {p.demoUrl ? t("demo") : t("readme")} →<span className="sr-only">: {p.title}</span>
          </button>
        </div>
      </article>
    </Reveal>
  );
}
