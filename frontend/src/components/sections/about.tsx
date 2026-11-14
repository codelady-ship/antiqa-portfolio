import { getLocale, getTranslations } from "next-intl/server";
import { Reveal, SplitWords } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";
import { withNames } from "@/components/ui/no-translate";
import { NAME_SPELLINGS } from "@/lib/identity";
import type { Profile, Project } from "@/lib/types";

export async function About({ profile, projects }: { profile: Profile; projects: Project[] }) {
  const t = await getTranslations("About");
  const locale = (await getLocale()) as "az" | "en";
  const techs = new Set(projects.flatMap((p) => p.languages.map((l) => l.name)).concat(profile.skills));
  // years between the first repo and the latest push (no "now" → page stays static)
  const yrs = projects.flatMap((p) => [p.createdAt, p.pushedAt]).filter(Boolean).map((d) => new Date(d!).getFullYear());
  const yearCount = yrs.length ? Math.max(...yrs) - Math.min(...yrs) + 1 : 1;

  return (
    <section id="about" className="relative mx-auto max-w-7xl scroll-mt-24 px-4 py-28 sm:px-8 sm:py-40">
      <Reveal as="p" className="kicker">
        {t("kicker")}
      </Reveal>
      <Reveal as="h2" className="display type-section mt-6 max-w-5xl">
        <SplitWords text={t("title")} />
      </Reveal>

      <div className="mt-16 grid gap-14 lg:grid-cols-[1.3fr_1fr]">
        <Reveal as="p" className="text-lg leading-relaxed text-pretty sm:text-xl">
          <span className="serif-it float-left mt-1 mr-3 text-[4.2em] leading-[0.75] text-rose">{profile.about[locale].charAt(0)}</span>
          {withNames(profile.about[locale].slice(1), [...techs, profile.name, ...NAME_SPELLINGS])}
        </Reveal>

        <div className="grid content-start gap-10">
          <dl className="grid grid-cols-3 gap-4 border-y border-line py-8">
            {[
              [projects.length, t("projects")],
              [techs.size, t("languages")],
              [yearCount, t("years")],
            ].map(([n, label], i) => (
              <Reveal key={String(label)} index={i}>
                <dd className="display text-4xl sm:text-5xl">
                  <CountUp to={Number(n)} />
                  <span className="text-rose">+</span>
                </dd>
                <dt className="mt-2 text-[10px] tracking-[0.12em] break-words text-muted uppercase sm:text-xs sm:tracking-[0.18em]">{label}</dt>
              </Reveal>
            ))}
          </dl>

          {profile.education.length > 0 && (
            <Reveal>
              <h3 className="kicker mb-4">{t("education")}</h3>
              <ul className="grid gap-3">
                {profile.education.map((e) => (
                  <li key={e.place + e.period} className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
                    <span>
                      <span className="font-medium">{withNames(e.title[locale], [...techs])}</span>
                      <span translate="no" className="notranslate block text-sm text-muted">
                        {e.place}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-muted tabular-nums">{e.period}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          <Reveal>
            <h3 className="kicker mb-4">{t("skills")}</h3>
            <ul translate="no" lang="en" className="notranslate flex flex-wrap gap-2">
              {profile.skills.map((s) => (
                <li
                  key={s}
                  className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-violet hover:text-violet"
                >
                  {s}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
