import { getLocale, getTranslations } from "next-intl/server";
import { Reveal, SplitWords } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";
import { withNames } from "@/components/ui/no-translate";
import { EXPERIENCE_YEARS, NAME_SPELLINGS } from "@/lib/identity";
import type { Profile, Project } from "@/lib/types";

// stat tiles: three tints, three tilts, so the row reads hand-placed rather than generated
const TILES = [
  "bg-pink-soft -rotate-2 sm:translate-y-2",
  "bg-lilac-soft rotate-1",
  "bg-mint-soft -rotate-1 sm:translate-y-3",
];
const CHIP_DOTS = ["bg-rose", "bg-violet", "bg-mint", "bg-gold"];

export async function About({ profile, projects }: { profile: Profile; projects: Project[] }) {
  const t = await getTranslations("About");
  const locale = (await getLocale()) as "az" | "en";
  const techs = new Set(projects.flatMap((p) => p.languages.map((l) => l.name)).concat(profile.skills));

  return (
    <section id="about" className="wrap relative scroll-mt-24 py-24 sm:py-32">
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <Reveal as="p" className="kicker">
            {t("kicker")}
          </Reveal>
          <Reveal as="h2" className="display type-section mt-5 max-w-3xl text-balance">
            <SplitWords text={t("title")} />
          </Reveal>
          <Reveal as="p" className="mt-8 max-w-2xl text-lg leading-relaxed text-pretty sm:text-xl sm:leading-relaxed">
            {withNames(profile.about[locale], [...techs, profile.name, ...NAME_SPELLINGS])}
          </Reveal>

          <dl className="mt-12 grid max-w-2xl grid-cols-3 gap-3 sm:gap-5">
            {[
              [projects.length, t("projects")],
              [techs.size, t("languages")],
              [EXPERIENCE_YEARS, t("years")],
            ].map(([n, label], i) => (
              <Reveal key={String(label)} index={i} className={`flex flex-col-reverse rounded-3xl p-4 sm:p-6 ${TILES[i]}`}>
                <dt className="mt-1 text-xs leading-snug font-medium break-words text-muted sm:text-sm">{label}</dt>
                <dd className="display text-4xl font-[750] sm:text-5xl">
                  <CountUp to={Number(n)} />
                  <span className="text-rose">+</span>
                </dd>
              </Reveal>
            ))}
          </dl>
        </div>

        <div className="grid content-start gap-6 lg:col-span-5 lg:pt-14">
          {profile.education.length > 0 && (
            <Reveal className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow)] sm:p-8">
              <h3 className="kicker mb-4">{t("education")}</h3>
              <ul className="grid gap-4">
                {profile.education.map((e) => (
                  <li key={e.place + e.period} className="flex items-start gap-4">
                    <span aria-hidden className="mt-1 grid size-10 shrink-0 place-items-center rounded-2xl bg-butter-soft">
                      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                        <path d="M2 9l10-5 10 5-10 5L2 9Z" />
                        <path d="M6 11v5c3 2.5 9 2.5 12 0v-5" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{withNames(e.title[locale], [...techs])}</span>
                      <span className="mt-0.5 flex flex-wrap justify-between gap-x-3 text-sm text-muted">
                        <span translate="no" className="notranslate">
                          {e.place}
                        </span>
                        <span className="tabular-nums">{e.period}</span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          <Reveal className="rounded-[2rem] bg-bg-2 p-6 sm:p-8">
            <h3 className="kicker mb-4">{t("skills")}</h3>
            <ul translate="no" lang="en" className="notranslate flex flex-wrap gap-2">
              {profile.skills.map((s, i) => (
                <li key={s} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[0.8125rem] font-medium">
                  <span aria-hidden className={`size-1.5 rounded-full ${CHIP_DOTS[i % CHIP_DOTS.length]}`} />
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
