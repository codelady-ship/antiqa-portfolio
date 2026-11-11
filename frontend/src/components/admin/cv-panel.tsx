"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { api, Card, refreshSite } from "./ui";

export function CvPanel() {
  const t = useTranslations("Admin");
  const [cv, setCv] = useState<Partial<Record<"az" | "en", string>>>({});
  const [msg, setMsg] = useState("");

  const load = () =>
    api<{ cv?: Partial<Record<"az" | "en", string>> }>("/api/profile")
      .then((p) => setCv(p.cv ?? {}))
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const upload = async (lang: "az" | "en", file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" || file.size > 2 * 1024 * 1024) return setMsg(t("pdfOnly"));
    setMsg(t("saving"));
    try {
      const r = await fetch(`/api/cv/${lang}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/pdf", "X-File-Name": encodeURIComponent(file.name) },
        body: file,
      });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || `HTTP ${r.status}`);
      await refreshSite();
      setMsg(t("saved"));
      load();
    } catch (e) {
      setMsg(`${t("error")}: ${(e as Error).message}`);
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
                PDF ↗
              </a>
            ) : (
              t("none")
            )}
          </p>
          <label className="inline-flex cursor-pointer rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg">
            {t("upload")}
            <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => upload(lang, e.target.files?.[0])} />
          </label>
        </Card>
      ))}
      {msg && (
        <p role="status" className="text-sm text-muted sm:col-span-2">
          {msg}
        </p>
      )}
    </div>
  );
}
