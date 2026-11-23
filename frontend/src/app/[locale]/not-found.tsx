import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { NotFoundView, notFoundCta } from "@/components/layout/not-found-view";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

async function pageLocale() {
  const requested = await rootLocale();
  return hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
}

/** #68: the 404 has its own <title> ("Səhifə tapılmadı — Antiqa Cəlilova"), not the home page's. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: await pageLocale(), namespace: "NotFound" });
  return { title: t("title") };
}

/** 404 inside the site layout (nav + footer), e.g. /en/anything-unknown. */
export default async function NotFound() {
  const locale = await pageLocale();
  const t = await getTranslations({ locale, namespace: "NotFound" });
  return (
    <>
      {/* the prerendered 404 is a recovery shell that Next.js renders without the metadata above,
          so the page sets its own <title> too (React hoists it into <head>) */}
      <title>{`${t("title")} — Antiqa Cəlilova`}</title>
      <NotFoundView kicker={t("kicker")} title={t("title")} text={t("text")}>
        <Link href="/" locale={locale} className={notFoundCta}>
          {t("home")} →
        </Link>
      </NotFoundView>
    </>
  );
}
