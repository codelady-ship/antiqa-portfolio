import { locale as rootLocale } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { Hero } from "@/components/hero/hero";
import { About } from "@/components/sections/about";
import { Contact } from "@/components/sections/contact";
import { Marquee } from "@/components/sections/marquee";
import { JsonLd } from "@/components/seo/json-ld";
import { Work } from "@/components/work/work";
import { getProfile, getProjects } from "@/lib/data";
import { JOB_STACK, JOB_TITLE } from "@/lib/identity";

export default async function Home() {
  const locale = ((await rootLocale()) === "en" ? "en" : "az") as "az" | "en";
  const [profile, projects, t] = await Promise.all([getProfile(), getProjects(), getTranslations({ locale, namespace: "About" })]);
  const [first, ...rest] = profile.name.split(" ");
  // three tech "stickers" around the hero photo: her main stack first, then whatever she lists
  const stickers = [...new Set(["React", "Next.js", "Node.js"].filter((x) => profile.skills.includes(x)).concat(profile.skills))].slice(0, 3);
  const cv = profile.cv[locale] ?? profile.cv.az ?? profile.cv.en ?? null;

  return (
    <>
      <JsonLd profile={profile} projects={projects} locale={locale} />
      <Hero
        first={first}
        last={rest.join(" ")}
        title={JOB_TITLE}
        stack={JOB_STACK}
        tagline={profile.tagline[locale]}
        location={profile.location[locale]}
        stickers={stickers}
        cvHref={cv}
      />
      <Marquee items={profile.skills.slice(0, 10)} label={t("skills")} />
      <About profile={profile} projects={projects} />
      <Work projects={projects} />
      <Contact profile={profile} />
    </>
  );
}
