import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import NotFound from "../not-found";

// the 404's own tab title ("Səhifə tapılmadı — Antiqa Cəlilova" via the layout's template), not the home page's
export async function generateMetadata(): Promise<Metadata> {
  const requested = await rootLocale();
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "NotFound" });
  return { title: t("title") };
}

/** Throws notFound() inside <Suspense>: the response is a 404 and the 404 view around it stays in the static shell. */
function NotFoundStatus(): never {
  notFound();
}

/**
 * Any unknown path under a locale: the [locale]/not-found.tsx view inside the site layout, with status 404.
 * #68: calling notFound() at the top of the page made the prerendered 404 a Next.js recovery shell
 * (`<html id="__next_error__">`, no lang/<title> until JS ran). Thrown inside <Suspense> instead, the
 * prerender keeps the layout and the 404 view and only sets the status; after hydration the
 * [locale]/not-found.tsx boundary shows the same view.
 */
export default function CatchAll() {
  return (
    <>
      <NotFound />
      <Suspense>
        <NotFoundStatus />
      </Suspense>
    </>
  );
}
