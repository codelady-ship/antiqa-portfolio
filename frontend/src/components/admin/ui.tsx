"use client";

import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

const box =
  "min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-violet";

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`grid gap-1.5 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${box} ${props.className ?? ""}`} />;
}

export function Area(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} {...props} className={`${box} resize-y ${props.className ?? ""}`} />;
}

export function Button({
  children,
  variant = "primary",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const v =
    variant === "primary"
      ? "bg-ink text-bg hover:opacity-90"
      : variant === "danger"
        ? "border border-rose/50 text-rose hover:bg-rose hover:text-bg"
        : "border border-line hover:border-violet";
  return (
    <button type="button" {...rest} className={`min-h-11 rounded-full px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 ${v} ${rest.className ?? ""}`}>
      {children}
    </button>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 backdrop-blur sm:p-7">
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="display text-xl">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * A destructive or slow action asks once more: the first click shows "<label> ✓" / "✕" and a hint
 * (e.g. "applies when you press Save"), the second runs it.
 */
export function ConfirmButton({
  children,
  hint,
  onConfirm,
  variant = "danger",
  disabled,
  className = "",
}: {
  children: ReactNode;
  hint: string;
  onConfirm: () => void;
  variant?: "danger" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("Admin");
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <Button variant={variant} disabled={disabled} className={`w-fit ${className}`} onClick={() => setAsking(true)}>
        {children}
      </Button>
    );
  return (
    <span className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        variant={variant}
        disabled={disabled}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {children} ✓
      </Button>
      <Button variant="ghost" aria-label={t("cancel")} title={t("cancel")} onClick={() => setAsking(false)}>
        ✕
      </Button>
      <span className="text-xs text-muted">{hint}</span>
    </span>
  );
}

/* ---------- API ---------- */

type Issue = { path?: (string | number)[]; code?: string; message?: string; maximum?: number | bigint; minimum?: number | bigint; origin?: string; format?: string };

/** An API answer that was not ok: the HTTP status, the server's stable error code and zod issues. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues: Issue[] = [],
  ) {
    super(message);
  }
}

/** Fired when an admin call gets 401: the session ended, the panel shows the login form (and keeps every form). */
export const EXPIRED_EVENT = "admin:session-expired";

/** Calls the API on the same origin (Next rewrites /api to the Express backend). */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers: { ...(init.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, "network", "network error");
  }
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string; code?: string; issues?: Issue[] };
    // the login and reset forms handle their own 401s (wrong password, bad link)
    if (r.status === 401 && !path.startsWith("/api/auth/")) window.dispatchEvent(new Event(EXPIRED_EVENT));
    throw new ApiError(r.status, body.code ?? "", body.error || `HTTP ${r.status}`, body.issues ?? []);
  }
  return (r.status === 204 ? null : await r.json()) as T;
}

/** Tells Next to drop the cached public pages so the change shows up. Throws when it did not happen. */
export async function refreshSite() {
  const r = await fetch("/admin-revalidate", { method: "POST", credentials: "same-origin" }).catch(() => null);
  if (r?.status === 401) window.dispatchEvent(new Event(EXPIRED_EVENT));
  if (!r?.ok) throw new ApiError(r?.status ?? 0, "refresh_failed", "site not refreshed");
}

/* ---------- error messages in the panel's language ---------- */

const CODES = new Set([
  "network", "not_found", "invalid_input", "not_github_url", "already_added", "private_repo", "repo_not_found", "github_error",
  "pdf_only", "no_cv", "stale_profile", "stale_list", "server_error", "refresh_failed",
]);
const LANG = (l: unknown) => (l === "az" ? "Az" : l === "en" ? "En" : "");
/** zod path → the label the owner sees next to that field */
const FIELDS: Record<string, string> = {
  name: "name", initials: "initials", skills: "skills", education: "education", experience: "experience", socials: "socials", links: "links",
  openToWork: "openToWork", title: "customTitle", demoOverride: "demoOverride", backendUrl: "backendUrl", adminUrl: "adminUrl", adminHint: "adminHint",
  email: "email", phone: "phone", whatsapp: "whatsapp", telegram: "telegram", linkedin: "linkedin", github: "github", instagram: "instagram",
};
const ITEM_FIELDS: Record<string, Record<string, string>> = {
  experience: { title: "expTitle", place: "expPlace", period: "expPeriod", summary: "expSummary" },
  education: { title: "eduTitle", place: "eduPlace", period: "eduPeriod" },
  socials: { label: "socialLabel", url: "socialUrl" },
  links: { label: "linkLabel", url: "linkUrl" },
};

export function useErrorText() {
  const t = useTranslations("Admin");
  return useCallback(
    (e: unknown): string => {
      if (!(e instanceof ApiError)) return t("err_unknown", { status: "?" });
      if (e.status === 401) return t("err_unauthorized");
      if (e.status === 429) return t("err_too_many");
      if (e.code === "invalid_input" && e.issues.length) {
        const label = (path: (string | number)[]) => {
          const [a, b, c, d] = path;
          const head = String(a ?? "");
          if (head === "contacts") return t(FIELDS[String(b)] ?? "contacts");
          if (["roles", "tagline", "about", "location", "summary"].includes(head) && LANG(b)) return t(`${head === "summary" ? "summary" : head}${LANG(b)}`);
          if (ITEM_FIELDS[head] && typeof b === "number") {
            const sub = ITEM_FIELDS[head][String(c)];
            const name = sub ? (["expTitle", "expPeriod", "expSummary", "eduTitle"].includes(sub) ? t(`${sub}${LANG(d) || "Az"}`) : t(sub)) : "";
            return `${t(FIELDS[head])} #${b + 1}${name ? ` › ${name}` : ""}`;
          }
          if (head === "skills" && typeof b === "number") return `${t("skills")} #${b + 1}`;
          return FIELDS[head] ? t(FIELDS[head]) : path.join(".");
        };
        const what = (i: Issue) => {
          const max = Number(i.maximum ?? 0);
          if (i.code === "too_big") return i.origin === "array" ? t("issue_tooMany", { max }) : t("issue_tooLong", { max });
          if (i.code === "too_small") return t("issue_empty");
          if (/https/i.test(i.message ?? "") || i.format === "url") return t("issue_https");
          if (i.format === "email") return t("issue_email");
          return t("issue_invalid");
        };
        return `${t("err_invalid_input")} ${e.issues.slice(0, 4).map((i) => `${label(i.path ?? [])}: ${what(i)}`).join("; ")}`;
      }
      if (CODES.has(e.code)) return t(`err_${e.code}`);
      if (e.status === 0) return t("err_network");
      if (e.status === 404) return t("err_not_found");
      if (e.status >= 500) return t("err_server_error");
      return t("err_unknown", { status: e.status });
    },
    [t],
  );
}

/** Shows an API failure as an error toast; a 401 shows nothing here (the login form explains it). */
export function useFail() {
  const toast = useToast();
  const errText = useErrorText();
  return useCallback(
    (e: unknown, prefix = "") => {
      if (e instanceof ApiError && e.status === 401) return;
      toast({ kind: "error", text: prefix + errText(e) });
    },
    [toast, errText],
  );
}

/** After a save: refreshes the public pages and says "Saved"; a failed refresh is reported, the save stands. */
export function useSaved() {
  const t = useTranslations("Admin");
  const toast = useToast();
  const fail = useFail();
  return useCallback(
    async (text = t("saved")) => {
      try {
        await refreshSite();
        toast({ kind: "ok", text });
      } catch (e) {
        fail(e);
      }
    },
    [t, toast, fail],
  );
}

/* ---------- one toast for the whole panel ---------- */

export type Toast = { kind: "ok" | "error" | "info"; text: string; action?: { label: string; run: () => void } };
const ToastCtx = createContext<(t: Toast | null) => void>(() => {});
/** show(toast) replaces the current one; show(null) clears it (each new action starts with that) */
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("Admin");
  const [toast, setToast] = useState<(Toast & { id: number }) | null>(null);
  const seq = useRef(0);
  const show = useCallback((next: Toast | null) => setToast(next && { ...next, id: ++seq.current }), []);

  // success fades on its own; an error stays a while longer (and has ✕); "info" stays until replaced
  useEffect(() => {
    if (!toast || toast.kind === "info") return;
    const id = setTimeout(() => setToast(null), toast.kind === "ok" ? 4000 : 12000);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex justify-center">
        {/* the live regions exist before their text arrives, so screen readers announce it */}
        <div role="status" aria-live="polite" className="contents">
          {toast && toast.kind !== "error" && <ToastBox toast={toast} close={() => setToast(null)} closeLabel={t("close")} />}
        </div>
        <div role="alert" className="contents">
          {toast && toast.kind === "error" && <ToastBox toast={toast} close={() => setToast(null)} closeLabel={t("close")} />}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}

function ToastBox({ toast, close, closeLabel }: { toast: Toast; close: () => void; closeLabel: string }) {
  const tone = toast.kind === "error" ? "border-rose text-rose" : toast.kind === "ok" ? "border-mint" : "border-line";
  return (
    <div data-toast={toast.kind} className={`pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-2xl border-2 bg-surface px-4 py-3 text-sm shadow-[var(--shadow)] ${tone}`}>
      <p className="flex-1 self-center [overflow-wrap:anywhere]">{toast.text}</p>
      {toast.action && (
        <button type="button" onClick={toast.action.run} className="min-h-9 shrink-0 rounded-full bg-ink px-4 text-xs font-medium text-bg">
          {toast.action.label}
        </button>
      )}
      <button type="button" onClick={close} aria-label={closeLabel} title={closeLabel} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:text-ink">
        ✕
      </button>
    </div>
  );
}

/* ---------- unsaved changes ---------- */

const DirtyCtx = createContext<(key: string, dirty: boolean) => void>(() => {});
export const DirtyProvider = DirtyCtx.Provider;
/** Reports a form's unsaved changes to the panel (leaving the page then asks first). */
export function useDirty(key: string, dirty: boolean) {
  const set = useContext(DirtyCtx);
  useEffect(() => {
    set(key, dirty);
    return () => set(key, false);
  }, [key, dirty, set]);
}
