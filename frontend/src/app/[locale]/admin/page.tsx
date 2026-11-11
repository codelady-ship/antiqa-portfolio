import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { getMessages } from "next-intl/server";
import { AdminApp } from "@/components/admin/admin-app";
import { IntlProvider } from "@/components/providers/intl-provider";
import { SEED_PROFILE, SEED_REPOS } from "@/lib/seed";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const locale = (await rootLocale()) ?? "az";
  const messages = await getMessages({ locale });
  return (
    <IntlProvider locale={locale} messages={{ Admin: messages.Admin }}>
      <AdminApp seedProfile={SEED_PROFILE} seedRepos={SEED_REPOS} hasApi={!!process.env.API_URL} />
    </IntlProvider>
  );
}
