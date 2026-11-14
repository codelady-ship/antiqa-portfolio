"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Reveal, SplitWords } from "@/components/motion/reveal";
import { sortProjects, type ProjectSort as Sort } from "@/lib/merge";
import type { Project } from "@/lib/types";
import { DemoModal } from "./demo-modal";
import { ProjectCard } from "./project-card";
import { ProjectSphere } from "./project-sphere";

export function Work({ projects }: { projects: Project[] }) {
  const t = useTranslations("Work");
  const locale = useLocale() as "az" | "en";
  const [filter, setFilter] = useState<string>("");
  const [sort, setSort] = useState<Sort>("recommended");
  const [open, setOpen] = useState<Project | null>(null);

  const langs = useMemo(() => {
    const count = new Map<string, number>();
    projects.forEach((p) => p.languages[0] && count.set(p.languages[0].name, (count.get(p.languages[0].name) ?? 0) + 1));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [projects]);

  const list = useMemo(
    () => sortProjects(projects.filter((p) => !filter || p.languages.some((l) => l.name === filter)), sort),
    [projects, filter, sort],
  );

  return (
    <section id="work" className="relative scroll-mt-24">
      <div className="mx-auto max-w-[118rem] px-4 pt-28 pb-28 sm:px-8 sm:pt-40 sm:pb-40">
        <Reveal as="p" className="kicker">
          {t("kicker")}
        </Reveal>
        <Reveal as="h2" className="display mt-6 text-[clamp(3rem,11vw,10rem)]">
          <SplitWords text={t("title")} />
        </Reveal>

        {/* below xl: globe, toolbar, card grid stacked. xl+: toolbar on top, then the card grid with an
            empty middle column and the globe laid over that column (same grid cell), sticky while the
            cards scroll past on its left and right */}
        <div className="mt-10 sm:mt-14 xl:grid xl:grid-cols-1">
          <ProjectSphere
            projects={projects}
            onOpen={setOpen}
            hint={t("sphereHint")}
            word={t("sphereWord")}
            className="mb-10 xl:z-10 xl:col-start-1 xl:row-start-2 xl:mb-0 xl:justify-self-center xl:max-[1759px]:w-[30rem] min-[1760px]:w-[28rem]"
          />

          <div className="mb-10 flex flex-wrap items-center justify-between gap-4 xl:col-start-1 xl:row-start-1">
            <div role="group" aria-label={t("filter")} className="flex flex-wrap gap-2">
              {["", ...langs].map((l) => (
                <button
                  key={l || "all"}
                  type="button"
                  aria-pressed={filter === l}
                  onClick={() => setFilter(l)}
                  translate={l ? "no" : undefined}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm transition-all duration-300 ${l ? "notranslate" : ""} ${filter === l ? "border-ink bg-ink text-bg" : "border-line hover:border-violet"}`}
                >
                  {l || t("all")}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              <span className="sr-only">{t("sort")}</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="min-h-11 cursor-pointer rounded-full border border-line bg-surface px-4 py-2 text-ink"
              >
                <option value="recommended">{t("sortRecommended")}</option>
                <option value="created">{t("sortNew")}</option>
                <option value="updated">{t("sortUpdated")}</option>
                <option value="stars">{t("sortStars")}</option>
              </select>
            </label>
          </div>

          {list.length ? (
            <ul
              className={[
                "grid gap-6 sm:max-lg:grid-cols-2 lg:max-xl:grid-cols-3 xl:col-start-1 xl:row-start-2 xl:min-h-[32rem]",
                // xl: one card column each side of a 30rem globe column (odd cards left, even right)
                "xl:max-[1759px]:grid-cols-[minmax(0,1fr)_30rem_minmax(0,1fr)] xl:max-[1759px]:[&>li:nth-child(odd)]:col-start-1 xl:max-[1759px]:[&>li:nth-child(even)]:col-start-3",
                // ≥ 1760 px: two card columns (ranges do not overlap: arbitrary breakpoints sort before xl) each side of a 28rem globe column
                "min-[1760px]:grid-cols-[repeat(2,minmax(0,1fr))_28rem_repeat(2,minmax(0,1fr))]",
                "min-[1760px]:[&>li:nth-child(4n+1)]:col-start-1 min-[1760px]:[&>li:nth-child(4n+2)]:col-start-2",
                "min-[1760px]:[&>li:nth-child(4n+3)]:col-start-4 min-[1760px]:[&>li:nth-child(4n)]:col-start-5",
              ].join(" ")}
            >
              {list.map((p, i) => (
                <li key={p.id}>
                  <ProjectCard project={p} index={i} locale={locale} onOpen={() => setOpen(p)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="serif-it py-16 text-center text-2xl text-muted xl:col-start-1 xl:row-start-2 xl:min-h-[32rem] xl:max-w-[calc(50%-16rem)] xl:text-left">
              {t("empty")}
            </p>
          )}
        </div>
      </div>

      <DemoModal project={open} locale={locale} onClose={() => setOpen(null)} />
    </section>
  );
}
