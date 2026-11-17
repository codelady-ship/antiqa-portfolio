"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { api, Area, Button, Card, Field, Input, refreshSite } from "./ui";

type Repo = { name: string; url: string; description: string; language: string | null; stars: number; pushedAt: string; private: boolean; fork: boolean; added: boolean };
type Preview = {
  owner: string;
  name: string;
  repoUrl: string;
  title: string;
  description: string;
  languages: { name: string; percent: number }[];
  topics: string[];
  stars: number;
  createdAt: string;
  pushedAt: string;
  private: boolean;
  live: { url: string | null; source: "homepage" | "vercel" | "vercel-probe" | "pages" | null; verified: boolean };
  exists: boolean;
};

const day = (d: string) => d.slice(0, 10);

/**
 * "Add from GitHub": pick one of her repos (or paste a link) → the API reads GitHub and finds the
 * live link (homepage → Vercel → <repo>.vercel.app → GitHub Pages) → she checks the pre-filled
 * form → "Add to the site" saves it to Mongo and refreshes the public pages.
 */
export function GithubImport({ onAdded }: { onAdded: () => void }) {
  const t = useTranslations("Admin");
  const [url, setUrl] = useState("");
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [showRepos, setShowRepos] = useState(false);
  const [q, setQ] = useState("");
  const [pv, setPv] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"" | "read" | "save">("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ title: "", az: "", en: "", demo: "", featured: false, comingSoon: false, allowPrivate: false, fullStack: false });

  useEffect(() => {
    if (!showRepos || repos) return;
    api<{ repos: Repo[] }>("/api/github/repos")
      .then((r) => setRepos(r.repos))
      .catch((e) => setMsg(`${t("error")}: ${(e as Error).message}`));
  }, [showRepos, repos, t]);

  const shown = useMemo(
    () => (repos ?? []).filter((r) => !r.fork && (!q || r.name.toLowerCase().includes(q.toLowerCase()) || r.description.toLowerCase().includes(q.toLowerCase()))),
    [repos, q],
  );

  const read = async (repoUrl: string) => {
    setUrl(repoUrl);
    setBusy("read");
    setMsg("");
    setPv(null);
    try {
      const p = await api<Preview>(`/api/github/preview?url=${encodeURIComponent(repoUrl.trim())}`);
      setPv(p);
      setForm({
        title: p.title,
        az: p.description,
        en: p.description,
        demo: p.live.url ?? "",
        featured: false,
        fullStack: false,
        comingSoon: p.private && !p.live.url,
        allowPrivate: p.private,
      });
      setShowRepos(false);
    } catch (e) {
      setMsg(`${t("error")}: ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    if (!pv) return;
    setBusy("save");
    setMsg("");
    try {
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          repoUrl: pv.repoUrl,
          title: form.title.trim() === pv.title ? "" : form.title.trim(),
          summary: { az: form.az.trim(), en: form.en.trim() },
          // the API derives homepage / GitHub Pages links itself; anything else (Vercel, an edit) is stored as an override
          demoOverride: form.demo && !(form.demo === pv.live.url && (pv.live.source === "homepage" || pv.live.source === "pages")) ? form.demo : "",
          featured: form.featured,
          // "Show on the belt": the home page belt shows only these (Project.fullStack)
          fullStack: form.fullStack,
          comingSoon: form.comingSoon,
          allowPrivate: form.allowPrivate,
        }),
      });
      await refreshSite();
      setPv(null);
      setUrl("");
      setRepos(null);
      setMsg(t("saved"));
      onAdded();
    } catch (e) {
      setMsg(`${t("error")}: ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  };

  return (
    <Card title={`+ ${t("quickProjects")}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void read(url);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="min-w-64 flex-1">
          <Field label={t("repoUrl")}>
            <Input type="url" required placeholder="https://github.com/codelady-ship/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
        </div>
        <button type="submit" disabled={!!busy} className="min-h-11 rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-bg disabled:opacity-50">
          {busy === "read" ? t("previewing") : t("preview")}
        </button>
        <Button variant="ghost" onClick={() => setShowRepos(!showRepos)} aria-expanded={showRepos}>
          {t("pickRepo")} {showRepos ? "▴" : "▾"}
        </Button>
      </form>

      {showRepos && (
        <div className="mt-4 rounded-2xl border border-line p-3">
          <Input placeholder={t("searchRepos")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("searchRepos")} />
          {!repos ? (
            <p className="mt-3 text-sm text-muted">{t("loadingRepos")}</p>
          ) : (
            <ul className="mt-3 grid max-h-80 gap-1 overflow-auto">
              {shown.map((r) => (
                <li key={r.name}>
                  <button
                    type="button"
                    disabled={r.added || !!busy}
                    onClick={() => read(r.url)}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-pink-soft disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <span translate="no" className="notranslate min-w-0 flex-1 truncate font-medium">
                      {r.name}
                      {r.description && <span className="ml-2 font-normal text-muted">{r.description}</span>}
                    </span>
                    {r.private && <span className="rounded-full bg-butter-soft px-2 text-xs">{t("private")}</span>}
                    {r.added && <span className="rounded-full bg-mint-soft px-2 text-xs">✓ {t("added")}</span>}
                    <span className="shrink-0 text-xs text-muted tabular-nums">{day(r.pushedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pv && (
        <div className="mt-5 grid gap-4 rounded-2xl border-2 border-ink p-4 sm:grid-cols-2 sm:p-5">
          <h3 className="display text-lg sm:col-span-2">{t("prefillTitle")}</h3>
          {pv.exists && <p className="text-sm text-rose sm:col-span-2">{t("exists")}</p>}
          <dl translate="no" className="notranslate grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:col-span-2 sm:grid-cols-4">
            <div>
              <dt className="text-muted">{t("stars")}</dt>
              <dd>★ {pv.stars}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("created")}</dt>
              <dd className="tabular-nums">{day(pv.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("updated")}</dt>
              <dd className="tabular-nums">{day(pv.pushedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("languages")}</dt>
              <dd>{pv.languages.slice(0, 4).map((l) => `${l.name} ${Math.round(l.percent)}%`).join(", ") || "—"}</dd>
            </div>
          </dl>
          <Field label={t("customTitle")} wide>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label={t("summaryAz")}>
            <Area rows={3} value={form.az} onChange={(e) => setForm({ ...form, az: e.target.value })} />
          </Field>
          <Field label={t("summaryEn")}>
            <Area rows={3} value={form.en} onChange={(e) => setForm({ ...form, en: e.target.value })} />
          </Field>
          <div className="grid gap-1.5 sm:col-span-2">
            <Field label={t("liveLink")}>
              <Input type="url" pattern="https://.*" placeholder="https://" value={form.demo} onChange={(e) => setForm({ ...form, demo: e.target.value })} />
            </Field>
            <p className={`text-xs ${pv.live.url && !pv.live.verified ? "text-rose" : "text-muted"}`}>
              {pv.live.source ? `${t("liveFrom")}: ${t(`liveSource_${pv.live.source.replace("-", "_")}` as "liveSource_homepage")}` : t("liveNone")}
            </p>
          </div>
          {pv.private && <p className="text-sm text-gold sm:col-span-2">{t("privateNote")}</p>}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm sm:col-span-2">
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
              {t("featured")}
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={form.fullStack} onChange={(e) => setForm({ ...form, fullStack: e.target.checked })} />
              {t("fullStack")}
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={form.comingSoon} onChange={(e) => setForm({ ...form, comingSoon: e.target.checked })} />
              {t("comingSoon")}
            </label>
            {pv.private && (
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" checked={form.allowPrivate} onChange={(e) => setForm({ ...form, allowPrivate: e.target.checked })} />
                {t("allowPrivate")}
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button onClick={save} disabled={!!busy || pv.exists || (pv.private && !form.allowPrivate)}>
              {busy === "save" ? t("saving") : t("save2")}
            </Button>
            <Button variant="ghost" onClick={() => setPv(null)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {msg && (
        <p role="status" className="mt-3 text-sm text-muted">
          {msg}
        </p>
      )}
    </Card>
  );
}
