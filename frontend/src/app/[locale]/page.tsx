import { locale as rootLocale } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { Hero } from "@/components/hero/hero";
import { PersonaSlot } from "@/components/persona/slot";
import { PersonaTraveler } from "@/components/persona/persona-traveler";
import { PersonaStage } from "@/components/persona/persona-stage";
import { About } from "@/components/sections/about";
import { Contact } from "@/components/sections/contact";
import { JsonLd } from "@/components/seo/json-ld";
import { Work } from "@/components/work/work";
import { getProfile, getProjects } from "@/lib/data";
import { JOB_STACK, JOB_TITLE } from "@/lib/identity";

/**
 * Home: the persona travels down with the scroll (persona-traveler.tsx). She stands beside the
 * hero, falls to the About section and stays there (sticky, pose 2) while it is read, then falls
 * into the middle of the project ring and stands there. The contact block has its own sticky stage.
 * Phones and tablets get the plain one-column page (no slots, no travelling figure).
 */
// centred like .wrap (1320 px, 1680 px from 1600 px wide), so the text lines up with the header and the work section
const GROUP = "mx-auto max-w-[1320px] min-[1600px]:max-w-[1680px] lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(19rem,30vw,36rem)]";
// the same, mirrored: her column on the left (About)
const GROUP_LEFT = "mx-auto max-w-[1320px] min-[1600px]:max-w-[1680px] lg:grid lg:grid-cols-[clamp(19rem,30vw,36rem)_minmax(0,1fr)]";

export default async function Home() {
  const locale = ((await rootLocale()) === "en" ? "en" : "az") as "az" | "en";
  const [profile, projects, tp] = await Promise.all([getProfile(), getProjects(), getTranslations({ locale, namespace: "Persona" })]);
  const [first, ...rest] = profile.name.split(" ");
  const cv = profile.cv[locale] ?? profile.cv.az ?? profile.cv.en ?? null;
  // the stage and ring figures are decorative (alt=""): the photo is not announced again and again

  return (
    <>
      <JsonLd profile={profile} projects={projects} locale={locale} />
      {/* the "track" the travelling figure moves on: hero → About → the project ring */}
      {/* isolate: the travelling figure (z -10) goes under the content of the track, not under the page */}
      <div className="relative isolate">
        {/* desktop: hero text | her (right); then her (left, sticky) | About (owner, 2026-11-16 #3) */}
        <div className={GROUP}>
          <div className="min-w-0" data-persona="hero">
            <Hero first={first} last={rest.join(" ")} title={JOB_TITLE} stack={JOB_STACK} tagline={profile.tagline[locale]} location={profile.location[locale]} cvHref={cv} />
          </div>
          {/* she stands at the start of her column, close to the text (no empty middle) */}
          <div aria-hidden className="hidden items-center justify-start pt-24 lg:flex">
            <PersonaSlot id="hero" wave bubble={tp("hero")} className="ml-[4%] w-[78%] 2xl:-ml-[4vw] 2xl:w-[82%]" />
          </div>
        </div>
        <div className={GROUP_LEFT}>
          <div aria-hidden className="hidden lg:block">
            <PersonaSlot id="about" pose="right" bubble={tp("skills")} className="sticky top-32 mt-28 mr-[4%] ml-auto w-[78%] 2xl:w-[80%]" />
          </div>
          <div className="min-w-0" data-persona="skills">
            <About profile={profile} projects={projects} />
          </div>
        </div>
        <Work projects={projects} alt="" />
        <PersonaTraveler heroBubble={tp("hero")} aboutBubble={tp("skills")} />
      </div>
      <div className={GROUP}>
        <div className="min-w-0" data-persona="contact">
          <Contact profile={profile} />
        </div>
        <PersonaStage chapters={["contact"]} bubbles={{ contact: tp("contact") }} alt="" />
      </div>
    </>
  );
}
