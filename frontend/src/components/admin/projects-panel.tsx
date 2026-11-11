"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import { api, Area, Button, Card, Field, Input, refreshSite } from "./ui";

type AdminProject = Project & { hidden: boolean; order: number; syncError?: string | null; titleRaw?: string; demoOverride?: string };
type SeedRepo = { url: string; featured?: boolean; backend?: string; title?: string; demo?: string };

export function ProjectsPanel({ seedRepos }: { seedRepos: SeedRepo[] }) {
  const t = useTranslations("Admin");
  const [list, setList] = useState<AdminProject[] | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"" | "add" | "sync" | "seed">("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api<AdminProject[]>("/api/projects?all=1")
      .then(setList)
      .catch((e) => setMsg(`${t("error")}: ${(e as Error).message}`));
  }, [t]);
  useEffect(load, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("add");
    setMsg("");
    try {
      await api("/api/projects", { method: "POST", body: JSON.stringify({ repoUrl: url.trim() }) });
      setUrl("");
      await refreshSite();
      load();
    } catch (e) {
      setMsg(`${t("error")}: ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  };

  const syncAll = async () => {
    setBusy("sync");
    try {
      const r = await api<{ synced: number; errors: string[] }>("/api/projects/sync", { method: "POST", body: "{}" });
      setMsg(r.errors.length ? `${t("syncError")}: ${r.errors.join("; ")}` : `✓ ${r.synced}`);
      await refreshSite();
      load();
    } catch (e) {
      setMsg(`${t("error")}: ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  };

  // one-time import of the projects that were on the site before the database existed
  const importSeed = async () => {
    setBusy("seed");
    for (const s of seedRepos) {
      try {
        const p = await api<AdminProject>("/api/projects", { method: "POST", body: JSON.stringify({ repoUrl: s.url }) });
        const patch = {
          ...(s.title && { title: s.title }),
          ...(s.backend && { backendUrl: s.backend }),
          ...(s.demo && { demoOverride: s.demo }),
          ...(s.featured && { featured: true }),
        };
        if (Object.keys(patch).length) await api(`/api/projects/${p.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      } catch {
        /* already added or GitHub error: skip */
      }
    }
    await refreshSite();
    setBusy("");
    load();
  };

  return (
    <div className="grid gap-6">
      <Card>
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Field label={t("repoUrl")}>
              <Input type="url" required placeholder="https://github.com/codelady-ship/…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
          </div>
          <button type="submit" disabled={!!busy} className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-bg disabled:opacity-50">
            {busy === "add" ? t("adding") : `+ ${t("addProject")}`}
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={syncAll} disabled={!!busy}>
            ↻ {busy === "sync" ? t("syncing") : t("syncAll")}
          </Button>
          {list?.length === 0 && (
            <Button variant="ghost" onClick={importSeed} disabled={!!busy}>
              {busy === "seed" ? t("adding") : t("importSeed")}
            </Button>
          )}
        </div>
        {msg && (
          <p role="status" className="mt-3 text-sm text-muted">
            {msg}
          </p>
        )}
      </Card>

      {list === null ? (
        <p className="text-muted">{t("loading")}</p>
      ) : list.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3">
          {list.map((p) => (
            <ProjectRow key={p.id} p={p} onChange={load} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectRow({ p, onChange }: { p: AdminProject; onChange: () => void }) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [f, setF] = useState({
    title: p.titleRaw ?? "",
    summary: p.summary ?? { az: "", en: "" },
    demoOverride: p.demoOverride ?? "",
    backendUrl: p.backendUrl ?? "",
    order: p.order ?? 0,
    featured: p.featured,
    hidden: p.hidden,
  });
  const [err, setErr] = useState("");

  const patch = async (body: Partial<typeof f>) => {
    setErr("");
    try {
      await api(`/api/projects/${p.id}`, { method: "PATCH", body: JSON.stringify(body) });
      await refreshSite();
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const remove = async () => {
    await api(`/api/projects/${p.id}`, { method: "DELETE" }).catch((e) => setErr((e as Error).message));
    await refreshSite();
    onChange();
  };

  return (
    <li className={`rounded-2xl border border-line bg-surface p-4 ${p.hidden ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="text-muted">{open ? "▾" : "▸"}</span>
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {p.featured && <span className="text-gold">★ </span>}
              {p.title}
            </span>
            <span className="block truncate text-xs text-muted">
              {p.owner}/{p.name} · {p.languages.slice(0, 3).map((l) => l.name).join(", ")} · {p.demoUrl ? t("hasDemo") : t("noDemo")}
            </span>
          </span>
        </button>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={p.featured} onChange={(e) => patch({ featured: e.target.checked })} />
          {t("featured")}
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={p.hidden} onChange={(e) => patch({ hidden: e.target.checked })} />
          {t("hidden")}
        </label>
      </div>
      {p.syncError && <p className="mt-2 text-xs text-rose">{t("syncError")}: {p.syncError}</p>}

      {open && (
        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <Field label={t("customTitle")}>
            <Input placeholder={p.title} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label={t("order")}>
            <Input type="number" step={1} value={f.order} onChange={(e) => setF({ ...f, order: Math.trunc(Number(e.target.value)) || 0 })} />
          </Field>
          <Field label={t("summaryAz")}>
            <Area rows={3} placeholder={p.description} value={f.summary.az} onChange={(e) => setF({ ...f, summary: { ...f.summary, az: e.target.value } })} />
          </Field>
          <Field label={t("summaryEn")}>
            <Area rows={3} placeholder={p.description} value={f.summary.en} onChange={(e) => setF({ ...f, summary: { ...f.summary, en: e.target.value } })} />
          </Field>
          <Field label={t("demoOverride")}>
            <Input type="url" pattern="https://.*" placeholder={p.demoUrl ?? "https://"} value={f.demoOverride} onChange={(e) => setF({ ...f, demoOverride: e.target.value })} />
          </Field>
          <Field label={t("backendUrl")}>
            <Input type="url" pattern="https://.*" placeholder="https://github.com/…" value={f.backendUrl} onChange={(e) => setF({ ...f, backendUrl: e.target.value })} />
          </Field>
          {err && (
            <p role="alert" className="text-sm text-rose sm:col-span-2">
              {err}
            </p>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              onClick={() =>
                patch({
                  title: f.title,
                  summary: f.summary,
                  backendUrl: f.backendUrl,
                  order: f.order,
                  demoOverride: f.demoOverride, // "" clears it
                })
              }
            >
              {t("save")}
            </Button>
            {confirm ? (
              <>
                <Button variant="danger" onClick={remove}>
                  {t("delete")} ✓
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(false)}>
                  ✕
                </Button>
                <span className="self-center text-xs text-muted">{t("confirmDelete")}</span>
              </>
            ) : (
              <Button variant="danger" onClick={() => setConfirm(true)}>
                {t("delete")}
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
