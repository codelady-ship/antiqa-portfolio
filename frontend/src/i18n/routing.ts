import { defineRouting } from "next-intl/routing";

export const locales = ["az", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "az";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  localeCookie: { name: "PF_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});
