"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { api, Card, ConfirmButton, useFail, useSaved, useToast } from "./ui";

export function CvPanel() {
  const t = useTranslations("Admin");
  const toast = useToast();
  const fail = useFail();
  const saved = useSaved();
  const [cv, setCv] = useState<Partial<Record<"az" | "en", string>>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api<{ cv?: Partial<Record<"az" | "en", string>> }>("/api/profile")
        .then((p) => setCv(p.cv ?? {}))
        .catch((e) => fail(e)),
    [fail],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (lang: "az" | "en", file: File | undefined) => {
    if (!file) return;
    // some Windows setups report an empty MIME type: check the extension too
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf || file.size > 2 * 1024 * 1024) return toast({ kind: "error", text: t("pdfOnly") });
    setBusy(true);
    toast({ kind: "info", text: t("saving") });
    try {
      // the CV is sent as the raw PDF (not JSON); api() keeps these headers
      await api(`/api/cv/${lang}`, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf", "X-File-Name": encodeURIComponent(file.name) },
        body: file,
      });
      await load();
      await saved();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (lang: "az" | "en") => {
    setBusy(true);
    toast(null);
    try {
      await api(`/api/cv/${lang}`, { method: "DELETE" });
      await load();
      await saved(t("cvRemoved"));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {(["az", "en"] as const).map((lang) => (
        <Card key={lang} title={t(lang === "az" ? "cvAz" : "cvEn")}>
          <p className="mb-4 text-sm text-muted">
            {t("current")}:{" "}
            {cv[lang] ? (
              <a href={cv[lang]} target="_blank" rel="noopener noreferrer" className="text-violet underline">
                {t("openPdf")} ↗
              </a>
            ) : (
              t("none")
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex cursor-pointer rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg focus-within:ring-2 focus-within:ring-rose focus-within:ring-offset-2 ${busy ? "pointer-events-none opacity-50" : ""}`}
            >
              {t("upload")}
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  void upload(lang, e.target.files?.[0]);
                  e.target.value = ""; // allow choosing the same file again
                }}
              />
            </label>
            {cv[lang] && (
              <ConfirmButton disabled={busy} hint={t("cvRemoveHint")} onConfirm={() => void remove(lang)}>
                {t("cvRemove")}
              </ConfirmButton>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
