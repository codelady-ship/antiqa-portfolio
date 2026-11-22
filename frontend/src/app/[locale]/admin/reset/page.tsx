import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { getMessages } from "next-intl/server";
import { ResetApp } from "@/components/admin/reset-app";
import { IntlProvider } from "@/components/providers/intl-provider";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
  // with the Referrer-Policy header of next.config.ts: nothing about this page reaches another site
  referrer: "no-referrer",
};

/** Opened from the "forgot password" mail: set a new admin password (the token is in the URL fragment). */
export default async function AdminResetPage() {
  const locale = (await rootLocale()) ?? "az";
  const messages = await getMessages({ locale });
  return (
    <IntlProvider locale={locale} messages={{ Admin: messages.Admin }}>
      <ResetApp hasApi={!!process.env.API_URL} />
    </IntlProvider>
  );
}
