"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";

// Passing locale/messages/timeZone explicitly keeps pages prerenderable with Cache Components.
export function IntlProvider({ locale, messages, children }: { locale: string; messages: AbstractIntlMessages; children: ReactNode }) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Baku">
      {children}
    </NextIntlClientProvider>
  );
}
