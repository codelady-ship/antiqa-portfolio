import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { IntlProvider } from "@/components/providers/intl-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SiteNav } from "@/components/layout/site-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { routing } from "@/i18n/routing";
import { getProfile, SITE_URL } from "@/lib/data";
import { NAME_SPELLINGS } from "@/lib/identity";
import { grotesk, serif } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0910" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: "%s — Antiqa Cəlilova" },
    description: t("description"),
    alternates: {
      canonical: `/${locale}`,
      languages: { az: "/az", en: "/en", "x-default": "/az" },
    },
    openGraph: {
      type: "profile",
      siteName: "Antiqa Cəlilova",
      title: t("title"),
      description: t("description"),
      url: `/${locale}`,
      locale: locale === "az" ? "az_AZ" : "en_US",
      alternateLocale: locale === "az" ? ["en_US"] : ["az_AZ"],
    },
    // og:image (+ its alt) comes from ./opengraph-image.tsx; twitter needs the same image and alt spelled out
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [{ url: `/${locale}/opengraph-image`, width: 1200, height: 630, alt: t("ogAlt") }],
    },
    authors: [{ name: "Antiqa Cəlilova", url: SITE_URL }],
    creator: "Antiqa Cəlilova",
    keywords: ["Antiqa Cəlilova", ...NAME_SPELLINGS, "Frontend Developer", "Full Stack Developer", "MERN", "React", "Next.js", "Node.js", "Baku", "Azerbaijan", "portfolio"],
    verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
    other: { "darkreader-lock": "true" },
  };
}

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await rootLocale();
  // an unknown locale cannot use this layout: it falls through to app/global-not-found.tsx
  if (!hasLocale(routing.locales, locale)) notFound();
  const [messages, t, profile] = await Promise.all([
    getMessages({ locale }),
    getTranslations({ locale, namespace: "Meta" }),
    getProfile(),
  ]);
  const clientMessages = { Nav: messages.Nav, Work: messages.Work, Contact: messages.Contact, Hero: messages.Hero };

  return (
    <html lang={locale} className={`${grotesk.variable} ${serif.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-[100] rounded-full bg-ink px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          {t("skip")}
        </a>
        <IntlProvider locale={locale} messages={clientMessages}>
          <ThemeProvider>
            <SiteNav initials={profile.initials || "AC"} />
            <main id="main" tabIndex={-1} className="outline-none">
              {children}
            </main>
            <SiteFooter name={profile.name} location={profile.location[locale]} />
          </ThemeProvider>
        </IntlProvider>
      </body>
    </html>
  );
}
