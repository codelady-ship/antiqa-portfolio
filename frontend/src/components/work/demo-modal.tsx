"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";
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
  const fmt = new Intl.DateTimeFormat(locale === "az" ? "az-AZ" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (p) {
      setTab(p.demoUrl ? "demo" : "readme");
      setDevice("desktop");
      setReadme(null);
      if (!d.open) d.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (d.open) {
      d.close();
    }
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
      if (!html) {
        // no API yet: GitHub renders (and sanitizes) the README itself
        try {
          const r = await fetch(`https://api.github.com/repos/${p.owner}/${p.name}/readme`, { headers: { Accept: "application/vnd.github.html+json" } });
          if (r.ok) html = await r.text();
        } catch {}
      }
      if (!off) setReadme(html);
    })();
    return () => {
      off = true;
    };
  }, [p, tab, readme]);

  const close = () => {
    document.documentElement.style.overflow = "";
    onClose();
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
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <p className="text-[11px] tracking-[0.18em] text-muted uppercase">
                {t("created")}: {p.createdAt ? fmt.format(new Date(p.createdAt)) : "—"}
              </p>
              <h2 id="demo-title" className="display truncate text-2xl sm:text-3xl">
                {p.title}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div role="tablist" className="flex rounded-full border border-line p-0.5 text-sm">
                {(["demo", "readme"] as const).map((k) => (
                  <button
                    key={k}
                    role="tab"
                    type="button"
                    aria-selected={tab === k}
                    disabled={k === "demo" && !p.demoUrl}
                    onClick={() => setTab(k)}
                    className={`rounded-full px-4 py-1.5 transition-colors disabled:opacity-35 ${tab === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
                  >
                    {k === "demo" ? "Demo" : t("readme")}
                  </button>
                ))}
              </div>
              {tab === "demo" && (
                <div role="group" aria-label="Viewport" className="hidden rounded-full border border-line p-0.5 text-sm md:flex">
                  {(Object.keys(WIDTHS) as (keyof typeof WIDTHS)[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={device === k}
                      onClick={() => setDevice(k)}
                      className={`rounded-full px-3 py-1.5 transition-colors ${device === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
                    >
                      {t(k)}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => dlg.current?.close()}
                aria-label={t("close")}
                className="grid size-10 place-items-center rounded-full border border-line transition-transform duration-300 hover:rotate-90 hover:border-rose hover:text-rose"
              >
                ✕
              </button>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 md:grid-cols-[1fr_300px]">
            <div className="flex min-h-0 justify-center bg-bg-2 p-3 sm:p-5">
              {tab === "demo" && p.demoUrl ? (
                <div
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition-[width] duration-500 ease-out"
                  style={{ width: WIDTHS[device], maxWidth: "100%" }}
                >
                  <div className="flex items-center gap-2 border-b border-line bg-bg px-4 py-2 text-xs text-muted">
                    <i className="size-2.5 rounded-full bg-rose/70" />
                    <i className="size-2.5 rounded-full bg-gold/70" />
                    <i className="size-2.5 rounded-full bg-emerald-400/70" />
                    <span className="mx-2 flex-1 truncate rounded-full bg-bg-2 px-3 py-1">{p.demoUrl.replace(/^https?:\/\//, "")}</span>
                    <a href={p.demoUrl} target="_blank" rel="noopener noreferrer" title={t("openNew")} className="hover:text-ink">
                      ↗
                    </a>
                  </div>
                  <iframe
                    key={p.demoUrl}
                    src={p.demoUrl}
                    title={`${p.title} — demo`}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                    className="w-full flex-1 border-0 bg-white"
                  />
                </div>
              ) : (
                <article className="readme size-full overflow-auto rounded-2xl border border-line bg-bg p-6 sm:p-10">
                  {readme === null ? (
                    <p className="text-muted">{t("loading")}</p>
                  ) : readme ? (
                    <div dangerouslySetInnerHTML={{ __html: readme }} />
                  ) : (
                    <p className="serif-it text-xl text-muted">{t("noReadme")}</p>
                  )}
                </article>
              )}
            </div>

            <aside className="flex min-h-0 flex-col gap-6 overflow-auto border-line p-5 text-sm max-md:max-h-[34dvh] max-md:border-t md:border-l">
              {(p.summary?.[locale] || p.description) && (
                <section>
                  <h3 className="kicker mb-2">{t("description")}</h3>
                  <p>{p.summary?.[locale] || p.description}</p>
                </section>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-muted">{t("created")}</dt>
                <dd className="text-right">{p.createdAt ? fmt.format(new Date(p.createdAt)) : "—"}</dd>
                <dt className="text-muted">{t("updated")}</dt>
                <dd className="text-right">{p.pushedAt ? fmt.format(new Date(p.pushedAt)) : "—"}</dd>
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
                        <span className="flex items-center gap-2">
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
                  <ul className="flex flex-wrap gap-1.5">
                    {p.topics.map((tp) => (
                      <li key={tp} className="rounded-full bg-violet/10 px-2.5 py-0.5 text-xs text-violet">
                        {tp}
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
