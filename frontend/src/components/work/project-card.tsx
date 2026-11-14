"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, type CSSProperties } from "react";
import { Reveal } from "@/components/motion/reveal";
import { formatDate } from "@/lib/date";
import { shot } from "@/lib/shot";
import type { Project } from "@/lib/types";
import { isSafeFrame } from "./frame";
import { langColor } from "./lang-colors";

type Props = { project: Project; index: number; locale: "az" | "en"; onOpen: () => void };

/**
 * Card: screenshot thumbnail; on hover (mouse only, after a short pause) the live site
 * loads in a scaled iframe. "View demo" opens the modal. Tilt + spotlight follow the cursor.
 */
export function ProjectCard({ project: p, index, locale, onOpen }: Props) {
  const t = useTranslations("Work");
  const card = useRef<HTMLElement>(null);
  const timer = useRef<number>(0);
  const [live, setLive] = useState(false);
  const summary = p.summary?.[locale] || p.description;

  const enter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !p.demoUrl || !isSafeFrame(p.demoUrl)) return;
    timer.current = window.setTimeout(() => setLive(true), 380);
  };
  const leave = () => {
    clearTimeout(timer.current);
    setLive(false);
    const el = card.current;
    if (el) el.style.transform = "";
  };
  const move = (e: React.PointerEvent) => {
    const el = card.current;
    if (!el || e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width,
      y = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(1000px) rotateX(${(0.5 - y) * 5}deg) rotateY(${(x - 0.5) * 5}deg) translateY(-4px)`;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  };

  return (
    <Reveal index={index % 3} className="h-full">
      <article
        ref={card}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onPointerMove={move}
        className="group relative flex h-full flex-col overflow-hidden rounded-[1.6rem] border border-line bg-surface shadow-[var(--shadow)] backdrop-blur-xl transition-[transform,border-color] duration-300 ease-out focus-within:border-violet/60 hover:border-violet/40"
      >
        {/* spotlight */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: "radial-gradient(500px circle at var(--mx,50%) var(--my,50%), color-mix(in srgb, var(--violet) 14%, transparent), transparent 60%)" } as CSSProperties}
        />
        <div className={`relative overflow-hidden bg-bg-2 ${p.featured ? "aspect-[16/8]" : "aspect-[16/10]"}`}>
          {p.demoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote screenshot service, sized by CSS
            <img
              src={shot(p.demoUrl, p.featured ? 960 : 640)}
              alt={t("shotAlt", { title: p.title })}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : (
            <span aria-hidden className="display absolute inset-0 grid place-items-center text-7xl" style={{ background: "var(--grad)", color: "var(--bg)" }}>
              {p.title.charAt(0)}
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
          <span className="absolute top-4 left-4 z-10 rounded-full bg-bg/80 px-3 py-1 text-[11px] tracking-[0.14em] uppercase backdrop-blur">
            {p.demoUrl ? (
              <>
                <span className="text-emerald-500">●</span> {t("live")}
              </>
            ) : (
              t("code")
            )}
          </span>
        </div>

        <div className="relative z-20 flex flex-1 flex-col gap-3 p-5 sm:p-6">
          <div className="flex items-center justify-between text-[11px] tracking-[0.16em] text-muted uppercase">
            <span>{p.createdAt ? new Date(p.createdAt).getUTCFullYear() : ""}</span>
            <span>{p.languages[0]?.name}</span>
          </div>
          <h3 className="display text-2xl leading-none sm:text-3xl">{p.title}</h3>
          {summary && <p className="line-clamp-3 text-sm text-muted">{summary}</p>}
          {p.topics.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {p.topics.slice(0, 5).map((tp) => (
                <li key={tp} className="rounded-full bg-violet/10 px-2.5 py-0.5 text-[11px] text-violet">
                  {tp}
                </li>
              ))}
            </ul>
          )}
          {p.languages.length > 0 && (
            <div className="mt-auto pt-2">
              <div className="flex h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                {p.languages.map((l) => (
                  <i key={l.name} style={{ width: `${l.percent}%`, background: langColor(l.name) }} />
                ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
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
          <button
            type="button"
            onClick={onOpen}
            data-open-project={p.id}
            className="relative isolate overflow-hidden rounded-full border border-line py-3 text-sm font-medium transition-colors after:absolute after:inset-0 after:-z-10 after:translate-y-full after:bg-ink after:transition-transform after:duration-500 hover:text-bg hover:after:translate-y-0 focus-visible:text-bg focus-visible:after:translate-y-0"
          >
            {p.demoUrl ? t("demo") : t("readme")} →<span className="sr-only">: {p.title}</span>
          </button>
        </div>
      </article>
    </Reveal>
  );
}
