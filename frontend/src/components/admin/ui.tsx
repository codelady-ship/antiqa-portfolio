"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

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

/** Calls the API on the same origin (Next rewrites /api to the Express backend). */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { ...(init.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string; issues?: { path: (string | number)[]; message: string }[] };
    // zod issues → "contacts.linkedin: https only"
    const detail = body.issues?.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw Object.assign(new Error([body.error || `HTTP ${r.status}`, detail].filter(Boolean).join(" — ")), { status: r.status });
  }
  return (r.status === 204 ? null : await r.json()) as T;
}

/** Tells Next to drop the cached public pages so the change shows up. */
export const refreshSite = () => fetch("/admin-revalidate", { method: "POST", credentials: "same-origin" }).catch(() => {});
