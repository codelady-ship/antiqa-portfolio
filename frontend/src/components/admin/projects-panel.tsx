"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import { GithubImport } from "./github-import";
import { ApiError, api, Area, Button, Card, ConfirmButton, Field, Input, useDirty, useErrorText, useFail, useSaved, useToast } from "./ui";
import { onBelt } from "@/components/work/project-conveyor";

type AdminProject = Project & { hidden: boolean; order: number; syncError?: string | null; titleRaw?: string; demoOverride?: string; demoOff?: boolean };
type SeedRepo = { url: string; featured?: boolean; backend?: string; title?: string; demo?: string };
/** Keep in step with ProjectLinks in backend/src/app.ts */
const MAX_LINKS = 6;

export function ProjectsPanel({ seedRepos }: { seedRepos: SeedRepo[] }) {
  const t = useTranslations("Admin");
  const toast = useToast();
  const errText = useErrorText();
  const fail = useFail();
  const saved = useSaved();
  const [list, setList] = useState<AdminProject[] | null>(null);
  const [busy, setBusy] = useState<"" | "sync" | "seed" | "order">("");
  const [elapsed, setElapsed] = useState(0);

  // resolves once the list is fresh (a row clears its optimistic ticks then)
  const load = useCallback(
    () =>
      api<AdminProject[]>("/api/projects?all=1")
        .then(setList)
        .catch((e) => fail(e)),
    [fail],
  );
  useEffect(() => {
    void load();
  }, [load]);

  // "Refresh all" is one long request: show the seconds so it does not look stuck
  useEffect(() => {
    if (busy !== "sync") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const syncAll = async () => {
    setElapsed(0);
    setBusy("sync");
    toast({ kind: "info", text: t("syncProgress", { n: list?.length ?? 0 }) });
    try {
      const r = await api<{ synced: number; errors: string[] }>("/api/projects/sync", { method: "POST", body: "{}" });
      await load();
      if (r.errors.length) toast({ kind: "error", text: t("syncDoneErrors", { n: r.synced, failed: r.errors.length, list: r.errors.join("; ") }) });
      else await saved(t("syncDone", { n: r.synced }));
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
    }
  };

  // ↑ / ↓: swap with the neighbour (within the same group: featured projects always come first),
  // then the whole new order goes to the API in one request
  const move = async (i: number, dir: -1 | 1) => {
    if (!list) return;
    const j = i + dir;
    if (j < 0 || j >= list.length || list[j].featured !== list[i].featured) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
    setBusy("order");
    toast(null);
    try {
      setList(await api<AdminProject[]>("/api/projects/order", { method: "PUT", body: JSON.stringify({ ids: next.map((p) => p.id) }) }));
      await saved(t("orderSaved"));
    } catch (e) {
      fail(e);
      await load(); // the real order
    } finally {
      setBusy("");
    }
  };

  // one-time import of the projects that were on the site before the database existed
  const importSeed = async () => {
    setBusy("seed");
    toast({ kind: "info", text: t("adding") });
    let added = 0;
    const failed: string[] = [];
    for (const s of seedRepos) {
      try {
        const p = await api<AdminProject>("/api/projects", { method: "POST", body: JSON.stringify({ repoUrl: s.url }) });
        added++;
        const patch = {
          ...(s.title && { title: s.title }),
          ...(s.backend && { backendUrl: s.backend }),
          ...(s.demo && { demoOverride: s.demo }),
          ...(s.featured && { featured: true }),
        };
        if (Object.keys(patch).length) await api(`/api/projects/${p.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      } catch (e) {
        if (e instanceof ApiError && e.code === "already_added") continue;
        if (e instanceof ApiError && e.status === 401) break;
        failed.push(`${s.url.replace("https://github.com/", "")}: ${errText(e)}`);
      }
    }
    await load();
    setBusy("");
    if (failed.length) toast({ kind: "error", text: t("seedDone", { n: added, failed: failed.length }) + " " + failed.join("; ") });
    else await saved(t("seedDone", { n: added, failed: 0 }));
  };

  return (
    <div className="grid gap-6">
      <GithubImport onAdded={load} />
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {busy === "sync" ? (
            <Button variant="ghost" disabled>
              ↻ {t("syncing")} {t("seconds", { n: elapsed })}
            </Button>
          ) : (
            <ConfirmButton variant="ghost" disabled={!!busy} hint={t("syncConfirm", { n: list?.length ?? 0 })} onConfirm={() => void syncAll()}>
              ↻ {t("syncAll")}
            </ConfirmButton>
          )}
          {list?.length === 0 && (
            <Button variant="ghost" onClick={importSeed} disabled={!!busy}>
              {busy === "seed" ? t("adding") : t("importSeed")}
            </Button>
          )}
        </div>
      </Card>

      {list === null ? (
        <p className="text-muted">{t("loading")}</p>
      ) : list.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3">
          {list.map((p, i) => (
            // keyed by id only: a reorder or a reload keeps what is being typed in the row
            <ProjectRow
              key={p.id}
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

const formOf = (p: AdminProject) => ({
  title: p.titleRaw ?? "",
  summary: { az: p.summary?.az ?? "", en: p.summary?.en ?? "" },
  demoOverride: p.demoOverride ?? "",
  backendUrl: p.backendUrl ?? "",
  adminUrl: p.adminUrl ?? "",
  adminHint: p.adminHint ?? "",
  links: (p.links ?? []).map((l) => ({ label: l.label, url: l.url })),
});

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
  const toast = useToast();
  const fail = useFail();
  const saved = useSaved();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(() => formOf(p));
  const dirty = JSON.stringify(f) !== JSON.stringify(formOf(p));
  useDirty(`project:${p.id}`, dirty);
  // the ticked state shows at once (optimistic); it was only updated after the save + list reload,
  // so a click looked like it did nothing for a second or two
  type Flag = "featured" | "hidden" | "fullStack" | "comingSoon" | "demoOff";
  const [opt, setOpt] = useState<Partial<Record<Flag, boolean>>>({});
  const flag = (k: Flag, fallback: boolean) => opt[k] ?? fallback;

  const patch = async (body: Partial<Omit<typeof f, "links">> & { links?: typeof f.links; featured?: boolean; hidden?: boolean; comingSoon?: boolean; demoOff?: boolean; fullStack?: boolean }) => {
    toast(null);
    setBusy(true);
    const flags = Object.fromEntries(Object.entries(body).filter(([, v]) => typeof v === "boolean")) as Partial<Record<Flag, boolean>>;
    setOpt((o) => ({ ...o, ...flags }));
    try {
      const fresh = await api<AdminProject>(`/api/projects/${p.id}`, { method: "PATCH", body: JSON.stringify(body) });
      // a field save: the form now shows what the server stored (trimmed etc.)
      if (!Object.keys(flags).length) setF(formOf(fresh));
      await onChange();
      await saved();
    } catch (e) {
      // the box goes back to the stored value, and the toast says why (also when the row is folded)
      fail(e, `${p.title}: `);
    } finally {
      // the reloaded list now has the saved values: drop the optimistic ones (review #47)
      setOpt((o) => Object.fromEntries(Object.entries(o).filter(([k]) => !(k in flags))));
      setBusy(false);
    }
  };
  const remove = async () => {
    toast(null);
    try {
      await api(`/api/projects/${p.id}`, { method: "DELETE" });
      await onChange();
      await saved(t("deleted"));
    } catch (e) {
      fail(e, `${p.title}: `);
    }
  };

  const box = (k: Flag, checked: boolean) => (
    <input type="checkbox" className="size-5 sm:size-4" checked={checked} onChange={(e) => patch({ [k]: e.target.checked })} />
  );
  const setLink = (i: number, v: Partial<(typeof f.links)[number]>) => setF({ ...f, links: f.links.map((l, j) => (j === i ? { ...l, ...v } : l)) });
  const arrow = "grid size-11 place-items-center rounded-lg text-muted hover:text-ink disabled:opacity-25 sm:h-7 sm:w-9";

  return (
    <li className={`rounded-2xl border border-line bg-surface p-4 ${flag("hidden", p.hidden) ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex flex-col">
          <button type="button" aria-label={t("moveUp")} title={t("moveUp")} disabled={!onMove || !canUp} onClick={() => onMove?.(-1)} className={arrow}>
            ▲
          </button>
          <button type="button" aria-label={t("moveDown")} title={t("moveDown")} disabled={!onMove || !canDown} onClick={() => onMove?.(1)} className={arrow}>
            ▼
          </button>
        </span>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
          <span className="text-muted">{open ? "▾" : "▸"}</span>
          <span className="min-w-0">
            <span className="block font-medium [overflow-wrap:anywhere] sm:truncate">
              {p.featured && <span className="text-gold">★ </span>}
              {p.title}
              {dirty && <span className="ml-2 text-xs font-normal text-gold">● {t("unsaved")}</span>}
            </span>
            <span className="block text-xs text-muted [overflow-wrap:anywhere] sm:truncate">
              <span translate="no" className="notranslate">
                {p.owner}/{p.name}
              </span>{" "}
              · {p.languages.slice(0, 3).map((l) => l.name).join(", ")} · {p.demoUrl ? t("hasDemo") : t("noDemo")}
            </span>
          </span>
        </button>
        {/* phones: the two boxes get their own line, so the title is not squeezed into a narrow column */}
        <span className="flex w-full gap-x-4 sm:w-auto sm:gap-x-3">
          <label className="flex min-h-11 items-center gap-1.5 text-xs sm:min-h-0">
            {box("featured", flag("featured", p.featured))}
            {t("featured")}
          </label>
          <label className="flex min-h-11 items-center gap-1.5 text-xs sm:min-h-0">
            {box("hidden", flag("hidden", p.hidden))}
            {t("hidden")}
          </label>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-muted sm:gap-y-1 sm:pl-7">
        <label className="flex min-h-11 items-center gap-1.5 sm:min-h-0">
          {box("fullStack", flag("fullStack", !!(p.fullStack ?? onBelt({ ...p, hidden: false }))))}
          {t("fullStack")}
        </label>
        <label className="flex min-h-11 items-center gap-1.5 sm:min-h-0">
          {box("comingSoon", flag("comingSoon", !!p.comingSoon))}
          {t("comingSoon")}
        </label>
        <label className="flex min-h-11 items-center gap-1.5 sm:min-h-0">
          {box("demoOff", flag("demoOff", !!p.demoOff))}
          {t("demoOff")}
        </label>
        {p.privateRepo && <span className="self-center text-gold">{t("privateNote")}</span>}
      </div>
      {p.syncError && <p className="mt-2 text-xs text-rose">{t("syncError")}: {p.syncError}</p>}

      {open && (
        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <Field label={t("customTitle")} wide>
            <Input placeholder={p.title} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
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
          <Field label={t("adminUrl")}>
            <Input type="url" pattern="https://.*" placeholder="https://…/admin" value={f.adminUrl} onChange={(e) => setF({ ...f, adminUrl: e.target.value })} />
          </Field>
          <Field label={t("adminHint")}>
            <Input maxLength={120} placeholder="admin@demo.app / demo" value={f.adminHint} onChange={(e) => setF({ ...f, adminHint: e.target.value })} />
          </Field>

          {/* extra card links (e.g. related repos): label + https link, up to 6 */}
          <div className="grid gap-2 sm:col-span-2">
            <p className="text-sm text-muted">{t("linksTitle", { max: MAX_LINKS })}</p>
            {f.links.map((l, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
                <Input aria-label={`${t("linkLabel")} #${i + 1}`} placeholder={t("linkLabel")} maxLength={60} value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} />
                <Input aria-label={`${t("linkUrl")} #${i + 1}`} type="url" pattern="https://.*" placeholder="https://" maxLength={500} value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} />
                <Button variant="ghost" onClick={() => setF({ ...f, links: f.links.filter((_, j) => j !== i) })}>
                  {t("remove")}
                </Button>
              </div>
            ))}
            {f.links.length < MAX_LINKS && (
              <Button variant="ghost" className="w-fit" onClick={() => setF({ ...f, links: [...f.links, { label: "", url: "" }] })}>
                + {t("addLink")}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button
              disabled={busy}
              onClick={() =>
                patch({
                  title: f.title,
                  summary: f.summary,
                  backendUrl: f.backendUrl,
                  adminUrl: f.adminUrl, // "" removes the Admin tab
                  adminHint: f.adminHint,
                  demoOverride: f.demoOverride, // "" clears it
                  // empty rows are dropped, not sent as invalid links
                  links: f.links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })).filter((l) => l.label || l.url),
                })
              }
            >
              {busy ? t("saving") : t("save")}
            </Button>
            {dirty && (
              <Button variant="ghost" onClick={() => setF(formOf(p))}>
                {t("discard")}
              </Button>
            )}
            <ConfirmButton hint={t("confirmDelete")} onConfirm={() => void remove()}>
              {t("delete")}
            </ConfirmButton>
          </div>
        </div>
      )}
    </li>
  );
}
