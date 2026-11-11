"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Reveal, SplitWords } from "@/components/motion/reveal";
import type { Project } from "@/lib/types";
import { DemoModal } from "./demo-modal";
import { ProjectCard } from "./project-card";
import { ProjectSphere } from "./project-sphere";

type Sort = "created" | "updated" | "stars";

export function Work({ projects }: { projects: Project[] }) {
  const t = useTranslations("Work");
  const locale = useLocale() as "az" | "en";
  const [filter, setFilter] = useState<string>("");
  const [sort, setSort] = useState<Sort>("created");
  const [open, setOpen] = useState<Project | null>(null);

  const langs = useMemo(() => {
    const count = new Map<string, number>();
    projects.forEach((p) => p.languages[0] && count.set(p.languages[0].name, (count.get(p.languages[0].name) ?? 0) + 1));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [projects]);

  const list = useMemo(() => {
    const time = (d: string | null) => (d ? Date.parse(d) : 0);
    return projects
      .filter((p) => !filter || p.languages.some((l) => l.name === filter))
      .sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          (sort === "stars" ? b.stars - a.stars : sort === "updated" ? time(b.pushedAt) - time(a.pushedAt) : time(b.createdAt) - time(a.createdAt)),
      );
  }, [projects, filter, sort]);

  return (
    <section id="work" className="relative scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 pt-28 sm:px-8 sm:pt-40">
        <Reveal as="p" className="kicker">
          {t("kicker")}
        </Reveal>
        <Reveal as="h2" className="display mt-6 text-[clamp(3rem,11vw,10rem)]">
          <SplitWords text={t("title")} />
        </Reveal>
      </div>

      <ProjectSphere projects={projects} onOpen={setOpen} hint={t("sphereHint")} word={t("sphereWord")} />

      <div className="mx-auto max-w-7xl px-4 pb-28 sm:px-8 sm:pb-40">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div role="group" aria-label={t("filter")} className="flex flex-wrap gap-2">
            {["", ...langs].map((l) => (
              <button
                key={l || "all"}
                type="button"
                aria-pressed={filter === l}
                onClick={() => setFilter(l)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-all duration-300 ${filter === l ? "border-ink bg-ink text-bg" : "border-line hover:border-violet"}`}
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
              className="cursor-pointer rounded-full border border-line bg-surface px-4 py-2 text-ink"
            >
              <option value="created">{t("sortNew")}</option>
              <option value="updated">{t("sortUpdated")}</option>
              <option value="stars">{t("sortStars")}</option>
            </select>
          </label>
        </div>

        {list.length ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p, i) => (
              <li key={p.id} className={p.featured ? "sm:col-span-2 lg:col-span-2" : ""}>
                <ProjectCard project={p} index={i} locale={locale} onOpen={() => setOpen(p)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="serif-it py-16 text-center text-2xl text-muted">{t("empty")}</p>
        )}
      </div>

      <DemoModal project={open} locale={locale} onClose={() => setOpen(null)} />
    </section>
  );
}
