"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { withNames } from "@/components/ui/no-translate";
import { formatDate } from "@/lib/date";
import type { Project } from "@/lib/types";
import { isSafeFrame } from "./frame";
import { langColor } from "./lang-colors";

type Tab = "demo" | "readme";
const WIDTHS = { desktop: "100%", tablet: "820px", phone: "390px" } as const;

/** Native <dialog>: focus trap, Esc to close and inert background come from the browser. */
export function DemoModal({ project: p, locale, onClose }: { project: Project | null; locale: "az" | "en"; onClose: () => void }) {
  const t = useTranslations("Work");
  const dlg = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>("demo");
  const [device, setDevice] = useState<keyof typeof WIDTHS>("desktop");
  const [readme, setReadme] = useState<string | null>(null);
  // phones/tablets: the info sidebar is a toggle that replaces the preview, not a cramped strip
  const [info, setInfo] = useState(false);

  const canFrame = !!p?.demoUrl && isSafeFrame(p.demoUrl);

  // reset the view when another project opens (state adjusted during render, not in an effect)
  const [shown, setShown] = useState<Project | null>(null);
  if (p !== shown) {
    setShown(p);
    if (p) {
      setTab(canFrame ? "demo" : "readme");
      setDevice("desktop");
      setReadme(null);
      setInfo(false);
    }
  }

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (p) {
      if (!d.open) d.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (d.open) {
      d.close();
    }
    // never leave the page scroll-locked (e.g. unmount on a language switch)
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [p]);

  useEffect(() => {
    if (!p || tab !== "readme" || readme !== null) return;
    let off = false;
    (async () => {
      let html = "";
      try {
        const r = await fetch(`/api/projects/${p.owner}/${p.name}/readme`);
        if (r.ok) html = ((await r.json()) as { html: string }).html;
      } catch {}
      if (!off) setReadme(html);
    })();
    return () => {
      off = true;
    };
  }, [p, tab, readme]);

  const close = () => {
    document.documentElement.style.overflow = "";
    const id = p?.id;
    onClose();
    // the browser returns focus to the opener; if that failed (opener gone, hidden or inert),
    // put keyboard focus on the same project's card in the grid instead of <body>
    requestAnimationFrame(() => {
      const a = document.activeElement;
      if (id == null || (a && a !== document.body && !a.closest("[inert]"))) return;
      document.querySelector<HTMLElement>(`[data-open-project="${CSS.escape(String(id))}"]`)?.focus();
    });
  };

  return (
    <dialog
      ref={dlg}
      onClose={close}
      onClick={(e) => e.target === dlg.current && dlg.current?.close()}
      aria-labelledby="demo-title"
      className="m-auto h-[min(92dvh,940px)] max-h-none w-[min(1320px,100%-24px)] max-w-none overflow-hidden rounded-[1.8rem] border border-line bg-bg p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-md open:animate-[dlgIn_.5s_cubic-bezier(.2,.8,.2,1)] max-sm:h-dvh max-sm:w-full max-sm:rounded-none"
    >
      {p && (
        <div className="flex h-full flex-col">
          <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-3 sm:px-5 sm:py-4">
            {/* phones: the title gets its own full-width row, the controls wrap below it */}
            <div className="min-w-0 flex-1 basis-full sm:basis-0">
              <p className="text-[11px] tracking-[0.18em] whitespace-nowrap text-muted uppercase">
                {t("created")}: {p.createdAt ? formatDate(p.createdAt, locale) : "—"}
              </p>
              <h2 id="demo-title" translate="no" lang="en" className="display notranslate text-xl break-words sm:truncate sm:text-3xl">
                {p.title}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div role="tablist" aria-label={t("view")} className="flex rounded-full border border-line p-0.5 text-sm">
                {(["demo", "readme"] as const).map((k) => (
                  <button
                    key={k}
                    role="tab"
                    type="button"
                    id={`tab-${k}`}
                    aria-controls="demo-panel"
                    aria-selected={tab === k}
                    disabled={k === "demo" && !canFrame}
                    onClick={() => {
                      setTab(k);
                      setInfo(false);
                    }}
                    className={`min-h-11 rounded-full px-3 transition-colors disabled:opacity-35 sm:px-4 ${tab === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
                  >
                    {k === "demo" ? t("demoTab") : t("readme")}
                  </button>
                ))}
              </div>
              {tab === "demo" && (
                <div role="group" aria-label={t("viewport")} className="hidden rounded-full border border-line p-0.5 text-sm md:flex">
                  {(Object.keys(WIDTHS) as (keyof typeof WIDTHS)[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={device === k}
                      onClick={() => setDevice(k)}
                      className={`min-h-11 rounded-full px-3 transition-colors ${device === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
                    >
                      {t(k)}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setInfo((v) => !v)}
                aria-expanded={info}
                aria-controls="demo-info"
                className={`min-h-11 rounded-full border px-3 text-sm transition-colors md:hidden ${info ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}
              >
                {t("details")}
              </button>
              <button
                type="button"
                onClick={() => dlg.current?.close()}
                aria-label={t("close")}
                className="grid size-11 shrink-0 place-items-center rounded-full border border-line transition-transform duration-300 hover:rotate-90 hover:border-rose hover:text-rose"
              >
                ✕
              </button>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_300px]">
            <div
              id="demo-panel"
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              className={`min-h-0 min-w-0 justify-center bg-bg-2 p-2 sm:p-5 md:flex ${info ? "max-md:hidden" : "flex"}`}
            >
              {tab === "demo" && p.demoUrl && canFrame ? (
                <div
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition-[width] duration-500 ease-out"
                  style={{ width: WIDTHS[device], maxWidth: "100%" }}
                >
                  <div className="flex items-center gap-2 border-b border-line bg-bg px-4 py-2 text-xs text-muted">
                    <i className="size-2.5 rounded-full bg-rose/70" />
                    <i className="size-2.5 rounded-full bg-gold/70" />
                    <i className="size-2.5 rounded-full bg-emerald-400/70" />
                    <span translate="no" className="notranslate mx-2 flex-1 truncate rounded-full bg-bg-2 px-3 py-1">{p.demoUrl.replace(/^https?:\/\//, "")}</span>
                    <a href={p.demoUrl} target="_blank" rel="noopener noreferrer" title={t("openNew")} className="-my-3 -mr-3 grid size-11 shrink-0 place-items-center hover:text-ink">
                      ↗
                    </a>
                  </div>
                  <iframe
                    key={p.demoUrl}
                    src={p.demoUrl}
                    title={t("demoFrame", { title: p.title })}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    referrerPolicy="no-referrer"
                    className="w-full flex-1 border-0 bg-white"
                  />
                </div>
              ) : (
                <article className="readme size-full min-w-0 overflow-auto rounded-2xl border border-line bg-bg p-6 sm:p-10">
                  {readme === null ? (
                    <p className="text-muted">{t("loading")}</p>
                  ) : readme ? (
                    <div dangerouslySetInnerHTML={{ __html: readme }} />
                  ) : (
                    <p className="serif-it text-xl text-muted">
                      {t("noReadme")}{" "}
                      <a href={`${p.repoUrl}#readme`} target="_blank" rel="noopener noreferrer" className="text-violet underline">
                        GitHub ↗
                      </a>
                    </p>
                  )}
                </article>
              )}
            </div>

            <aside
              id="demo-info"
              className={`min-h-0 flex-col gap-6 overflow-auto overscroll-contain border-line p-5 text-sm md:flex md:border-l ${info ? "flex" : "max-md:hidden"}`}
            >
              {(p.summary?.[locale] || p.description) && (
                <section>
                  <h3 className="kicker mb-2">{t("description")}</h3>
                  <p>{withNames(p.summary?.[locale] || p.description, [...p.languages.map((l) => l.name), p.title])}</p>
                </section>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-muted">{t("created")}</dt>
                <dd className="text-right">{p.createdAt ? formatDate(p.createdAt, locale) : "—"}</dd>
                <dt className="text-muted">{t("updated")}</dt>
                <dd className="text-right">{p.pushedAt ? formatDate(p.pushedAt, locale) : "—"}</dd>
                <dt className="text-muted">{t("stars")}</dt>
                <dd className="text-right">★ {p.stars}</dd>
                <dt className="text-muted">{t("forks")}</dt>
                <dd className="text-right">{p.forks}</dd>
                {p.license && (
                  <>
                    <dt className="text-muted">{t("license")}</dt>
                    <dd className="text-right">{p.license}</dd>
                  </>
                )}
              </dl>
              {p.languages.length > 0 && (
                <section>
                  <h3 className="kicker mb-3">{t("languages")}</h3>
                  <div className="mb-3 flex h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                    {p.languages.map((l) => (
                      <i key={l.name} style={{ width: `${l.percent}%`, background: langColor(l.name) }} />
                    ))}
                  </div>
                  <ul className="grid gap-1.5">
                    {p.languages.map((l) => (
                      <li key={l.name} className="flex items-center justify-between">
                        <span translate="no" className="notranslate flex items-center gap-2">
                          <span className="size-2 rounded-full" style={{ background: langColor(l.name) }} />
                          {l.name}
                        </span>
                        <span className="tabular-nums text-muted">{l.percent.toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {p.topics.length > 0 && (
                <section>
                  <h3 className="kicker mb-2">{t("topics")}</h3>
                  <ul translate="no" className="notranslate flex flex-wrap gap-1.5">
                    {p.topics.map((tp) => (
                      <li key={tp} className="rounded-full bg-violet/10 px-2.5 py-0.5 text-xs text-violet">
                        {tp}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {!!p.links?.length && (
                <section>
                  <h3 className="kicker mb-2">{t("links")}</h3>
                  <ul className="grid gap-1">
                    {p.links.map((l) => (
                      <li key={l.url}>
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          translate="no"
                          className="notranslate flex min-h-11 items-center justify-between gap-2 border-b border-line text-ink transition-colors hover:text-violet"
                        >
                          {l.label} <span aria-hidden>↗</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <div className="mt-auto grid gap-2">
                {p.demoUrl && (
                  <a href={p.demoUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-ink py-3 text-center font-medium text-bg">
                    {t("openNew")} ↗
                  </a>
                )}
                <a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line py-3 text-center hover:border-violet">
                  GitHub ↗
                </a>
                {p.backendUrl && (
                  <a href={p.backendUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line py-3 text-center hover:border-violet">
                    {t("backend")} ↗
                  </a>
                )}
                {tab === "demo" && <p className="text-xs text-muted">{t("frameNote")}</p>}
              </div>
            </aside>
          </div>
        </div>
      )}
      <style>{`@keyframes dlgIn { from { opacity: 0; transform: translateY(24px) scale(.97) } to { opacity: 1; transform: none } }`}</style>
    </dialog>
  );
}
