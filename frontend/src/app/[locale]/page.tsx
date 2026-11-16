import { locale as rootLocale } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { Hero } from "@/components/hero/hero";
import { PersonaStage } from "@/components/persona/persona-stage";
import { About } from "@/components/sections/about";
import { Contact } from "@/components/sections/contact";
import { Marquee } from "@/components/sections/marquee";
import { JsonLd } from "@/components/seo/json-ld";
import { Work } from "@/components/work/work";
import { getProfile, getProjects } from "@/lib/data";
import { JOB_STACK, JOB_TITLE } from "@/lib/identity";

/**
 * Home (#38): the persona follows the scroll. Hero + skills and the contact block each sit in a
 * two-column group with a sticky stage on the right (desktop); in the work section she stands
 * in the middle of the project ring. Phones and tablets get the plain one-column page.
 */
const GROUP = "lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(19rem,30vw,34rem)]";

export default async function Home() {
  const locale = ((await rootLocale()) === "en" ? "en" : "az") as "az" | "en";
  const [profile, projects, t, tp, th] = await Promise.all([
    getProfile(),
    getProjects(),
    getTranslations({ locale, namespace: "About" }),
    getTranslations({ locale, namespace: "Persona" }),
    getTranslations({ locale, namespace: "Hero" }),
  ]);
  const [first, ...rest] = profile.name.split(" ");
  const cv = profile.cv[locale] ?? profile.cv.az ?? profile.cv.en ?? null;
  const alt = th("photoAlt", { name: profile.name });
  // her main stack first, then whatever else she lists
  const chips = [...new Set(["Java", "Spring Boot", "React", "Next.js", "TypeScript", "PostgreSQL"].filter((x) => profile.skills.includes(x)).concat(profile.skills))];

  return (
    <>
      <JsonLd profile={profile} projects={projects} locale={locale} />
      <div className={GROUP}>
        <div className="min-w-0">
          <div data-persona="hero">
            <Hero first={first} last={rest.join(" ")} title={JOB_TITLE} stack={JOB_STACK} tagline={profile.tagline[locale]} location={profile.location[locale]} cvHref={cv} />
          </div>
          <div data-persona="skills">
            <Marquee items={profile.skills.slice(0, 10)} label={t("skills")} />
            <About profile={profile} projects={projects} />
          </div>
        </div>
        <PersonaStage chapters={["hero", "skills"]} bubbles={{ hero: tp("hero"), skills: tp("skills") }} chips={chips} alt={alt} />
      </div>
      <Work projects={projects} alt={alt} />
      <div className={GROUP}>
        <div className="min-w-0" data-persona="contact">
          <Contact profile={profile} />
        </div>
        <PersonaStage chapters={["contact"]} bubbles={{ contact: tp("contact") }} alt={alt} />
      </div>
    </>
  );
}
