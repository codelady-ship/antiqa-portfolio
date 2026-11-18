import { getLocale, getTranslations } from "next-intl/server";
import { Reveal, SplitWords } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";
import { withNames } from "@/components/ui/no-translate";
import { EXPERIENCE_YEARS, NAME_SPELLINGS } from "@/lib/identity";
import { onBelt } from "@/lib/showcase";
import type { Profile, Project } from "@/lib/types";

// stat tiles: three tints, three tilts, so the row reads hand-placed rather than generated
const TILES = [
  "bg-pink-soft -rotate-2 sm:translate-y-2",
  "bg-lilac-soft rotate-1",
  "bg-mint-soft -rotate-1 sm:translate-y-3",
];
const CHIP_DOTS = ["bg-rose", "bg-violet", "bg-mint", "bg-gold"];

/**
 * Institution on the left (may wrap), period on the right of the same row (never wraps, top-aligned);
 * on phones the period goes under the place, so short names like "Aliyev Space" never wrap.
 * so a long university name never pushes the dates onto a line of their own.
 */
function Row({ place, period }: { place: string; period: string }) {
  return (
    <span className="mt-0.5 grid items-start gap-x-3 text-sm text-muted sm:grid-cols-[minmax(0,1fr)_auto]">
      <span translate="no" className="notranslate min-w-0">
        {place}
      </span>
      <span className="whitespace-nowrap tabular-nums sm:text-right">{period}</span>
    </span>
  );
}

// job-title words that must never be machine-translated
const ROLE_NAMES = ["Junior Full Stack Developer", "Full Stack Developer", "Backend Developer", "masapay"];

export async function About({ profile, projects }: { profile: Profile; projects: Project[] }) {
  const t = await getTranslations("About");
  const locale = (await getLocale()) as "az" | "en";
  // the same projects (and so the same number) as the belt in Projects (review 2026-11-18: "24+" here vs "12" there)
  const shown = projects.filter(onBelt).length;
  const techs = new Set(projects.flatMap((p) => p.languages.map((l) => l.name)).concat(profile.skills));

  return (
    <section id="about" className="reveal-from-right wrap relative scroll-mt-24 overflow-x-clip pt-24 pb-16 sm:pt-32 sm:pb-20">
      {/* one column (owner, 2026-11-17): the headline and the bio slide in from the right, then work
          experience and education under the bio, full width, one under the other. Her video is the
          column on the left (page.tsx) */}
      <div className="max-w-3xl">
        <Reveal as="p" className="kicker">
          {t("kicker")}
        </Reveal>
        <Reveal as="h2" index={1} className="display type-section mt-5 max-w-3xl text-balance">
          <SplitWords text={t("title")} />
        </Reveal>
        <Reveal as="p" index={2} className="mt-8 max-w-2xl text-lg leading-relaxed text-pretty sm:text-xl sm:leading-relaxed">
          {withNames(profile.about[locale], [...techs, profile.name, ...NAME_SPELLINGS])}
        </Reveal>

      </div>
      <div className="mt-12 grid gap-6">
        {profile.experience?.length > 0 && (
          <Reveal index={1} className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow)] sm:p-8">
            <h3 className="kicker mb-4">{t("experience")}</h3>
            <ul className="grid gap-5">
              {profile.experience.map((e) => (
                <li key={e.place + e.period.en} className="flex items-start gap-4">
                  <span aria-hidden className="mt-1 grid size-10 shrink-0 place-items-center rounded-2xl bg-mint-soft">
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                      <rect x="3" y="7" width="18" height="13" rx="2.5" />
                      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{withNames(e.title[locale], [...ROLE_NAMES, ...techs])}</span>
                    <Row place={e.place} period={e.period[locale]} />
                    {e.summary[locale] && (
                      <span className="mt-1.5 block text-sm leading-relaxed text-pretty">{withNames(e.summary[locale], [...ROLE_NAMES, ...techs])}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}
        {profile.education.length > 0 && (
          <Reveal index={2} className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow)] sm:p-8">
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
                    <Row place={e.place} period={e.period} />
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}

      </div>
      <dl className="mt-12 grid grid-cols-3 gap-3 sm:gap-5">
        {[
          [shown, t("projects")],
          [techs.size, t("languages")],
          [EXPERIENCE_YEARS, t("years")],
        ].map(([n, label], i) => (
          <Reveal key={String(label)} index={i + 1} className={`flex flex-col-reverse rounded-3xl p-4 sm:p-6 ${TILES[i]}`}>
            <dt className="mt-1 text-xs leading-snug font-medium break-words text-muted sm:text-sm">{label}</dt>
            <dd className="display text-4xl font-[750] sm:text-5xl">
              <CountUp to={Number(n)} />
              {/* the project count is exact (the belt says the same number); the others are "at least" */}
              {i > 0 && <span className="text-rose">+</span>}
            </dd>
          </Reveal>
        ))}
      </dl>
      <div className="mt-10">
        <Reveal index={1} className="rounded-[2rem] bg-bg-2 p-6 sm:p-8">
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
    </section>
  );
}
