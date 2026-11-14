import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { AboutJsonLd } from "@/components/seo/json-ld";
import { Link } from "@/i18n/navigation";
import { getProfile, getProjects } from "@/lib/data";
import { formatDate } from "@/lib/date";
import { buildFaq } from "@/lib/faq";
import { ALT_NAME_INLINE } from "@/lib/identity";

/**
 * Plain-facts profile for AI answer engines and link previews: server-rendered text only,
 * no animations or client components, same data as the home page (API → seed fallback).
 */

async function currentLocale(): Promise<"az" | "en"> {
  return (await rootLocale()) === "en" ? "en" : "az";
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const [t, profile] = await Promise.all([getTranslations({ locale, namespace: "AboutPage" }), getProfile()]);
  const description = t("metaDescription", { name: profile.name, alt: ALT_NAME_INLINE, location: profile.location[locale] });
  // this page's own openGraph replaces the layout's, which also drops the inherited
  // [locale]/opengraph-image: point at the same per-locale image explicitly
  const image = { url: `/${locale}/opengraph-image`, width: 1200, height: 630, alt: t("ogAlt", { name: profile.name }) };
  return {
    title: t("metaTitle"),
    description,
    alternates: {
      canonical: `/${locale}/about`,
      languages: { az: "/az/about", en: "/en/about", "x-default": "/az/about" },
    },
    openGraph: {
      type: "profile",
      siteName: "Antiqa Cəlilova",
      title: t("metaTitle"),
      description,
      url: `/${locale}/about`,
      locale: locale === "az" ? "az_AZ" : "en_US",
      alternateLocale: locale === "az" ? ["en_US"] : ["az_AZ"],
      images: [image],
    },
    twitter: { card: "summary_large_image", title: t("metaTitle"), description, images: [image] },
  };
}

const h2 = "display mt-14 text-3xl sm:text-4xl";
const link = "underline decoration-line underline-offset-4 transition-colors hover:text-rose";

export default async function AboutPage() {
  const locale = await currentLocale();
  const [profile, projects, t] = await Promise.all([getProfile(), getProjects(), getTranslations({ locale, namespace: "AboutPage" })]);
  const c = profile.contacts;
  const cv = profile.cv[locale] ?? profile.cv.az ?? profile.cv.en ?? null;
  const contacts = [
    c.email && { k: t("email"), label: c.email, href: `mailto:${c.email}` },
    c.phone && { k: t("phone"), label: c.phone, href: `tel:${c.phone.replace(/\s/g, "")}` },
    c.whatsapp && { k: "WhatsApp", label: `+${c.whatsapp}`, href: `https://wa.me/${c.whatsapp}` },
    c.telegram && { k: "Telegram", label: `@${c.telegram}`, href: `https://t.me/${c.telegram}` },
    c.linkedin && { k: "LinkedIn", label: c.linkedin.replace(/^https?:\/\/(www\.)?/, ""), href: c.linkedin },
    c.github && { k: "GitHub", label: c.github.replace(/^https?:\/\//, ""), href: c.github },
    c.instagram && { k: "Instagram", label: `@${c.instagram}`, href: `https://instagram.com/${c.instagram}` },
    cv && { k: t("cv"), label: "PDF", href: cv },
  ].filter((x): x is { k: string; label: string; href: string } => !!x);
  const faq = buildFaq(t, profile, locale, projects.length);

  return (
    <article className="mx-auto max-w-3xl px-4 pt-32 pb-24 sm:px-8 sm:pt-40">
      <AboutJsonLd profile={profile} locale={locale} name={t("metaTitle")} faq={faq} />
      <header>
        <p className="kicker">{t("kicker")}</p>
        <h1 className="display mt-4 text-[clamp(2.4rem,8vw,4.5rem)] [overflow-wrap:anywhere]">{profile.name}</h1>
        <p className="mt-3 text-xl text-muted">{profile.roles[locale].join(" · ")}</p>
        <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-muted">{t("location")}</dt>
          <dd>{profile.location[locale]}</dd>
          <dt className="text-muted">{t("status")}</dt>
          <dd>{profile.openToWork ? t("openToWork") : t("notLooking")}</dd>
        </dl>
      </header>

      <section aria-labelledby="summary">
        <h2 id="summary" className={h2}>
          {t("summary")}
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-pretty">{profile.about[locale]}</p>
        {profile.tagline[locale] && <p className="mt-4 leading-relaxed text-muted">{profile.tagline[locale]}</p>}
      </section>

      <section aria-labelledby="skills">
        <h2 id="skills" className={h2}>
          {t("skills")}
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {profile.skills.map((s) => (
            <li key={s} className="rounded-full border border-line px-3 py-1 text-sm">
              {s}
            </li>
          ))}
        </ul>
      </section>

      {profile.education.length > 0 && (
        <section aria-labelledby="education">
          <h2 id="education" className={h2}>
            {t("education")}
          </h2>
          <ul className="mt-4 space-y-3">
            {profile.education.map((e) => (
              <li key={`${e.place}-${e.period}`}>
                <strong className="font-medium">{e.title[locale]}</strong>, {e.place} <span className="text-muted">({e.period})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="projects">
        <h2 id="projects" className={h2}>
          {t("projects")}
        </h2>
        <ul className="mt-6 space-y-8">
          {projects.map((p) => {
            const text = p.summary?.[locale] || p.description;
            const created = p.createdAt ? formatDate(p.createdAt, locale) : "";
            return (
              <li key={p.id}>
                <h3 className="text-xl font-medium">{p.title}</h3>
                {text && <p className="mt-1 leading-relaxed text-pretty">{text}</p>}
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {p.languages.length > 0 && (
                    <>
                      <dt className="text-muted">{t("languages")}</dt>
                      <dd>{p.languages.map((l) => l.name).join(", ")}</dd>
                    </>
                  )}
                  {created && (
                    <>
                      <dt className="text-muted">{t("created")}</dt>
                      <dd>
                        <time dateTime={p.createdAt!}>{created}</time>
                      </dd>
                    </>
                  )}
                </dl>
                <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  {p.demoUrl && (
                    <a href={p.demoUrl} className={link} rel="noopener">
                      {t("demo")}
                    </a>
                  )}
                  <a href={p.repoUrl} className={link} rel="noopener">
                    {t("code")}
                  </a>
                  {p.backendUrl && (
                    <a href={p.backendUrl} className={link} rel="noopener">
                      {t("backend")}
                    </a>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="contacts">
        <h2 id="contacts" className={h2}>
          {t("contacts")}
        </h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          {contacts.map((x) => (
            <div key={x.k} className="contents">
              <dt className="text-muted">{x.k}</dt>
              <dd className="min-w-0 [overflow-wrap:anywhere]">
                <a href={x.href} className={link}>
                  {x.label}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="faq">
        <h2 id="faq" className={h2}>
          {t("faq")}
        </h2>
        <div className="mt-6 space-y-6">
          {faq.map((x) => (
            <div key={x.q}>
              <h3 className="text-lg font-medium">{x.q}</h3>
              <p className="mt-1 leading-relaxed text-pretty">{x.a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-sm">
        <Link href="/" className={link}>
          {t("home")}
        </Link>
        <a href="/llms.txt" className={link}>
          {t("plain")}
        </a>
        <a href="/llms-full.txt" className={link}>
          {t("plainFull")}
        </a>
      </footer>
    </article>
  );
}
