import { locale as rootLocale } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { Hero } from "@/components/hero/hero";
import { PersonaClip } from "@/components/persona/clip";
import { PERSONA } from "@/components/persona/config";
import { About } from "@/components/sections/about";
import { Contact } from "@/components/sections/contact";
import { JsonLd } from "@/components/seo/json-ld";
import { Work } from "@/components/work/work";
import { getProfile, getProjects } from "@/lib/data";
import { localizeProjects } from "@/lib/showcase";
import { JOB_STACK, JOB_TITLE } from "@/lib/identity";

/**
 * Home (owner, 2026-11-17): she no longer travels between sections. Each section has its own video
 * of her (persona/clip.tsx) that appears when the section comes into view: hero (right) she waves,
 * About (left, sticky) she sits down at the desk and types as you scroll, Projects she stands in the
 * middle of the belt and points at the hovered plate, Contact she waves again.
 * Phones and tablets get the plain one-column page (no videos).
 */
// centred like .wrap (1320 px, 1680 px from 1600 px wide), so the text lines up with the header and the work section
// hero: two equal halves, so she stands next to the text and not at the far right (review
// 2026-11-18: 500–700 px of empty middle at 1440 / 1920)
const GROUP = "mx-auto max-w-[1320px] min-[1600px]:max-w-[1680px] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]";
// the same, mirrored: her column on the left (About)
const GROUP_LEFT = "mx-auto max-w-[1320px] min-[1600px]:max-w-[1680px] lg:grid lg:grid-cols-[clamp(19rem,30vw,36rem)_minmax(0,1fr)]";

export default async function Home() {
  const locale = ((await rootLocale()) === "en" ? "en" : "az") as "az" | "en";
  const [profile, all, tp] = await Promise.all([getProfile(), getProjects(), getTranslations({ locale, namespace: "Persona" })]);
  // names and demos in this page's language (lib/showcase.ts)
  const projects = localizeProjects(all, locale);
  const [first, ...rest] = profile.name.split(" ");
  const cv = profile.cv[locale] ?? profile.cv.az ?? profile.cv.en ?? null;
  // the stage and ring figures are decorative (alt=""): the photo is not announced again and again

  return (
    <>
      <JsonLd profile={profile} projects={projects} locale={locale} />
      <div className="relative isolate">
        {/* desktop: hero text | her (right); then her (left, sticky) | About (owner, 2026-11-16 #3) */}
        <div className={GROUP}>
          <div className="min-w-0" data-persona="hero">
            <Hero locale={locale} first={first} last={rest.join(" ")} title={JOB_TITLE} stack={JOB_STACK} tagline={profile.tagline[locale]} location={profile.location[locale]} cvHref={cv} />
          </div>
          {/* she stands in her half, close to the text (no empty middle) */}
          <div className="hidden items-center justify-center pt-24 lg:flex 2xl:justify-start">
            <div className="relative w-[min(70%,22rem)] 2xl:w-[min(72%,28rem)]">
              <PersonaClip clip={PERSONA.wave} mode="loop" />
              <p
                aria-hidden
                className="persona-bubble hand absolute top-[4%] -right-[4%] max-w-[12rem] -rotate-3 rounded-[1.4rem] border-2 border-ink bg-surface px-4 py-2.5 text-[1.3rem] leading-tight text-ink shadow-[4px_4px_0_var(--ink)]"
              >
                {tp("hero")}
              </p>
              <AiNote text={tp("filmNote")} />
            </div>
          </div>
        </div>
        <div className={GROUP_LEFT}>
          {/* only her video here (owner): she sits down at the desk and types while About scrolls by */}
          <div className="hidden lg:block">
            <div className="sticky top-28 mt-28 pl-[4%]">
              <PersonaClip clip={PERSONA.desk} mode="scrub" track="#about" className="w-full" />
              <AiNote text={tp("filmNote")} />
            </div>
          </div>
          <div className="min-w-0" data-persona="skills">
            <About profile={profile} projects={projects} />
          </div>
        </div>
        <Work projects={projects} aiNote={tp("filmNote")} />
      </div>
      <div className="mx-auto max-w-[1320px] min-[1600px]:max-w-[1680px]" data-persona="contact">
        <Contact profile={profile} bubble={tp("contact")} aiNote={tp("filmNote")} />
      </div>
    </>
  );
}

/** the clips are made with AI (Google Flow / Veo): said under each one, in the page text */
function AiNote({ text }: { text: string }) {
  return <p className="mt-2 text-center text-xs text-muted">{text}</p>;
}
