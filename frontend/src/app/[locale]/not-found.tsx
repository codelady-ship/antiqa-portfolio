import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { NotFoundView, notFoundCta } from "@/components/layout/not-found-view";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** 404 inside the site layout (nav + footer), e.g. /en/anything-unknown. */
export default async function NotFound() {
  const requested = await rootLocale();
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "NotFound" });
  return (
    <NotFoundView kicker={t("kicker")} title={t("title")} text={t("text")}>
      <Link href="/" locale={locale} className={notFoundCta}>
        {t("home")} →
      </Link>
    </NotFoundView>
  );
}
