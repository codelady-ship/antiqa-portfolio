"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Reveal, SplitWords } from "@/components/motion/reveal";
import { sortProjects } from "@/lib/merge";
import type { Project } from "@/lib/types";
import { DemoModal } from "./demo-modal";
import { blurb, onBelt, ProjectConveyor } from "./project-conveyor";

/**
 * Work (#43): only her full-stack projects (owner, 2026-11-16), going round on a conveyor belt
 * around her figure (ProjectConveyor). The early practice tasks stay in the database and on GitHub
 * (link under the caption). A plate (or "Details" in the project panel) opens the project modal
 * (DemoModal), the same modal as before the belt (owner, 2026-11-17).
 */
export function Work({ projects, aiNote }: { projects: Project[]; aiNote?: string }) {
  const t = useTranslations("Work");
  const locale = useLocale() as "az" | "en";
  const [open, setOpen] = useState<Project | null>(null);

  const list = useMemo(() => sortProjects(projects.filter(onBelt), "recommended"), [projects]);
  const owner = projects.find((p) => p.owner)?.owner ?? "codelady-ship";

  const legend = [
    { k: "legendLive", c: "border-rose" },
    { k: "legendCode", c: "border-violet" },
    { k: "legendSoon", c: "border-gold" },
  ] as const;

  const header = (
    <div>
      <Reveal as="p" className="kicker">
        {t("kicker")}
      </Reveal>
      <Reveal as="h2" className="display type-section mt-5">
        <SplitWords text={t("title")} />
      </Reveal>
      <p className="mt-4 text-sm font-medium text-muted">
        {t("beltNote")} · {t("count", { n: list.length })}
      </p>
      <ul aria-hidden className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {legend.map(({ k, c }) => (
          <li key={k} className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full border-2 ${c}`} />
            {t(k)}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section id="work" data-persona="work" className="relative scroll-mt-24">
      <div className="mx-auto max-w-[1680px] pt-10 pb-16 sm:pt-14 sm:pb-24">
        {list.length > 0 && (
          <ProjectConveyor projects={list} locale={locale} header={header} onDetails={setOpen} githubUrl={`https://github.com/${owner}?tab=repositories`} aiNote={aiNote} />
        )}
        {/* the same projects as plain links in the server HTML: search engines and screen readers get
            names, summaries and URLs without running the belt (shown when a link is focused) */}
        <ul aria-label={t("title")} className="sr-only focus-within:not-sr-only focus-within:mx-4 focus-within:mt-4 focus-within:flex focus-within:flex-wrap focus-within:gap-3 focus-within:text-sm">
          {list.map((p) => {
            const href = p.demoUrl || p.repoUrl;
            return (
              <li key={p.id}>
                {href ? <a href={href} className="underline">{p.title}</a> : p.title}
                {blurb(p, locale) && <span>: {blurb(p, locale)}</span>}
              </li>
            );
          })}
        </ul>
      </div>
      <DemoModal project={open} locale={locale} onClose={() => setOpen(null)} />
    </section>
  );
}
