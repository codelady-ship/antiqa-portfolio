import { locale as rootLocale } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { Hero } from "@/components/hero/hero";
import { About } from "@/components/sections/about";
import { Contact } from "@/components/sections/contact";
import { Marquee } from "@/components/sections/marquee";
import { JsonLd } from "@/components/seo/json-ld";
import { Work } from "@/components/work/work";
import { getProfile, getProjects } from "@/lib/data";

export default async function Home() {
  const locale = ((await rootLocale()) === "en" ? "en" : "az") as "az" | "en";
  const [profile, projects, t] = await Promise.all([getProfile(), getProjects(), getTranslations({ locale, namespace: "About" })]);
  const [first, ...rest] = profile.name.split(" ");
  const cv = profile.cv[locale] ?? profile.cv.az ?? profile.cv.en ?? null;

  return (
    <>
      <JsonLd profile={profile} projects={projects} locale={locale} />
      <Hero
        first={first}
        last={rest.join(" ")}
        initials={profile.initials || "AC"}
        roles={profile.roles[locale]}
        tagline={profile.tagline[locale]}
        openToWork={profile.openToWork}
        cvHref={cv}
      />
      <Marquee items={profile.skills.slice(0, 10)} label={t("skills")} />
      <About profile={profile} projects={projects} />
      <Work projects={projects} />
      <Contact profile={profile} />
    </>
  );
}
