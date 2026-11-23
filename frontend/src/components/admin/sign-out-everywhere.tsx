"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, Button } from "./ui";

/** Ends every admin session (all browsers, also a stolen cookie): the server raises the session version. */
export function SignOutEverywhere({ onDone }: { onDone: () => void }) {
  const t = useTranslations("Admin");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!window.confirm(t("logoutAllConfirm"))) return;
    setBusy(true);
    try {
      await api("/api/auth/logout-all", { method: "POST" });
      onDone();
    } catch {
      window.alert(t("logoutAllError"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="ghost" onClick={run} disabled={busy} title={t("logoutAllHint")}>
      {t("logoutAll")}
    </Button>
  );
}
