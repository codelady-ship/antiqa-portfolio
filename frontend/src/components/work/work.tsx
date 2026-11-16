"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Reveal, SplitWords } from "@/components/motion/reveal";
import { sortProjects } from "@/lib/merge";
import type { Project } from "@/lib/types";
import { DemoModal } from "./demo-modal";
import { ProjectRing } from "./project-ring";

/** a language counts for a project (chip + filter) from this share of its code */
const MIN_PERCENT = 5;
const uses = (p: Project, lang: string) => p.languages.some((l) => l.name === lang && l.percent >= MIN_PERCENT);

/**
 * Work (#38): the figure in the middle, every project as a small card around her (ProjectRing),
 * a language filter above. The chips list every language that makes up ≥ 5 % of at least two
 * projects, most used first; a chip keeps exactly the projects it counts, so none is ever empty.
 */
export function Work({ projects, alt }: { projects: Project[]; alt: string }) {
  const t = useTranslations("Work");
  const locale = useLocale() as "az" | "en";
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<Project | null>(null);

  const langs = useMemo(() => {
    const count = new Map<string, number>();
    projects.forEach((p) => p.languages.forEach((l) => l.percent >= MIN_PERCENT && count.set(l.name, (count.get(l.name) ?? 0) + 1)));
    // a language used by a single project is noise as a filter (PowerShell, Go, C# …): those stay in the cards
    return [...count.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n, c]) => ({ n, c }));
  }, [projects]);

  const list = useMemo(() => sortProjects(projects.filter((p) => !filter || uses(p, filter)), "recommended"), [projects, filter]);

  return (
    <section id="work" data-persona="work" className="relative scroll-mt-24">
      <div className="wrap pt-16 pb-20 sm:pt-20 sm:pb-28">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <Reveal as="p" className="kicker">
              {t("kicker")}
            </Reveal>
            <Reveal as="h2" className="display type-section mt-5">
              <SplitWords text={t("title")} />
            </Reveal>
          </div>
          <p className="text-sm font-medium text-muted" aria-live="polite">
            {t("count", { n: list.length })}
          </p>
        </div>

        <div role="group" aria-label={t("filter")} className="mt-8 flex flex-wrap gap-2 sm:mt-10">
          {[{ n: "", c: projects.length }, ...langs].map(({ n, c }) => (
            <button
              key={n || "all"}
              type="button"
              aria-pressed={filter === n}
              onClick={() => setFilter(n)}
              translate={n ? "no" : undefined}
              className={`min-h-11 rounded-full border px-4 py-2 text-sm transition-colors duration-300 ${n ? "notranslate" : ""} ${filter === n ? "border-ink bg-accent font-semibold text-on-accent" : "border-line bg-surface hover:bg-pink-soft"}`}
            >
              {n || t("all")} <span className={filter === n ? "opacity-80" : "text-muted"}>{c}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 sm:mt-10">
          <ProjectRing projects={list} locale={locale} onOpen={setOpen} alt={alt} />
        </div>
      </div>

      <DemoModal project={open} locale={locale} onClose={() => setOpen(null)} />
    </section>
  );
}
