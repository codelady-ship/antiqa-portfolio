"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import { GithubImport } from "./github-import";
import { api, Area, Button, Card, Field, Input, refreshSite } from "./ui";
import { onBelt } from "@/components/work/project-conveyor";

type AdminProject = Project & { hidden: boolean; order: number; syncError?: string | null; titleRaw?: string; demoOverride?: string; demoOff?: boolean };
type SeedRepo = { url: string; featured?: boolean; backend?: string; title?: string; demo?: string };

export function ProjectsPanel({ seedRepos }: { seedRepos: SeedRepo[] }) {
  const t = useTranslations("Admin");
  const [list, setList] = useState<AdminProject[] | null>(null);
  const [busy, setBusy] = useState<"" | "sync" | "seed" | "order">("");
  const [msg, setMsg] = useState("");

  // resolves once the list is fresh (a row clears its optimistic ticks then)
  const load = useCallback(
    () =>
      api<AdminProject[]>("/api/projects?all=1")
        .then(setList)
        .catch((e) => setMsg(`${t("error")}: ${(e as Error).message}`)),
    [t],
  );
  useEffect(() => {
    void load();
  }, [load]);

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

  // ↑ / ↓: swap with the neighbour (within the same group: featured projects always come first), then
  // renumber the list's order values so the site shows exactly this order (one PATCH per changed project)
  const move = async (i: number, dir: -1 | 1) => {
    if (!list) return;
    const j = i + dir;
    if (j < 0 || j >= list.length || list[j].featured !== list[i].featured) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
    setBusy("order");
    const step = Math.max(1, Math.floor(1000 / next.length));
    const changes = next.map((p, k) => ({ p, order: (next.length - k) * step })).filter(({ p, order }) => p.order !== order);
    try {
      await Promise.all(changes.map(({ p, order }) => api(`/api/projects/${p.id}`, { method: "PATCH", body: JSON.stringify({ order }) })));
    } catch (e) {
      setMsg(`${t("error")}: ${(e as Error).message}`);
    }
    await refreshSite();
    await load();
    setBusy("");
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
      <GithubImport onAdded={load} />
      <Card>
        <div className="flex flex-wrap gap-2">
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
          {list.map((p, i) => (
            // the order is in the key: a reorder remounts the row, so its form never saves a stale order
            <ProjectRow
              key={`${p.id}:${p.order}`}
              p={p}
              onChange={load}
              onMove={busy ? undefined : (dir) => void move(i, dir)}
              canUp={i > 0 && list[i - 1].featured === p.featured}
              canDown={i < list.length - 1 && list[i + 1].featured === p.featured}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectRow({
  p,
  onChange,
  onMove,
  canUp = false,
  canDown = false,
}: {
  p: AdminProject;
  onChange: () => Promise<unknown> | void;
  onMove?: (dir: -1 | 1) => void;
  canUp?: boolean;
  canDown?: boolean;
}) {
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
  // the ticked state shows at once (optimistic); it was only updated after the save + list reload,
  // so a click looked like it did nothing for a second or two
  type Flag = "featured" | "hidden" | "fullStack" | "comingSoon" | "demoOff";
  const [opt, setOpt] = useState<Partial<Record<Flag, boolean>>>({});
  const flag = (k: Flag, fallback: boolean) => opt[k] ?? fallback;

  const patch = async (body: Partial<typeof f> & { comingSoon?: boolean; demoOff?: boolean; fullStack?: boolean }) => {
    setErr("");
    const flags = Object.fromEntries(Object.entries(body).filter(([, v]) => typeof v === "boolean")) as Partial<Record<Flag, boolean>>;
    setOpt((o) => ({ ...o, ...flags }));
    try {
      await api(`/api/projects/${p.id}`, { method: "PATCH", body: JSON.stringify(body) });
      await refreshSite();
      await onChange();
      // the reloaded list now has the saved values: drop the optimistic ones (review #47)
      setOpt((o) => Object.fromEntries(Object.entries(o).filter(([k]) => !(k in flags))));
    } catch (e) {
      setOpt((o) => Object.fromEntries(Object.entries(o).filter(([k]) => !(k in flags))));
      setErr((e as Error).message);
    }
  };
  const remove = async () => {
    await api(`/api/projects/${p.id}`, { method: "DELETE" }).catch((e) => setErr((e as Error).message));
    await refreshSite();
    onChange();
  };

  return (
    <li className={`rounded-2xl border border-line bg-surface p-4 ${flag("hidden", p.hidden) ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex flex-col">
          <button type="button" aria-label={t("moveUp")} title={t("moveUp")} disabled={!onMove || !canUp} onClick={() => onMove?.(-1)} className="grid h-6 w-8 place-items-center rounded text-muted hover:text-ink disabled:opacity-25">
            ▲
          </button>
          <button type="button" aria-label={t("moveDown")} title={t("moveDown")} disabled={!onMove || !canDown} onClick={() => onMove?.(1)} className="grid h-6 w-8 place-items-center rounded text-muted hover:text-ink disabled:opacity-25">
            ▼
          </button>
        </span>
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
          <input type="checkbox" checked={flag("featured", p.featured)} onChange={(e) => patch({ featured: e.target.checked })} />
          {t("featured")}
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={flag("hidden", p.hidden)} onChange={(e) => patch({ hidden: e.target.checked })} />
          {t("hidden")}
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-7 text-xs text-muted">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={flag("fullStack", !!(p.fullStack ?? onBelt({ ...p, hidden: false })))} onChange={(e) => patch({ fullStack: e.target.checked })} />
          {t("fullStack")}
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={flag("comingSoon", !!p.comingSoon)} onChange={(e) => patch({ comingSoon: e.target.checked })} />
          {t("comingSoon")}
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={flag("demoOff", !!p.demoOff)} onChange={(e) => patch({ demoOff: e.target.checked })} />
          {t("demoOff")}
        </label>
        {p.privateRepo && <span className="text-gold">{t("privateNote")}</span>}
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
