"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { api, Card, Field, Input } from "./ui";

/** Keep in step with PASSWORD_MIN in backend/src/reset.ts (the server checks again). */
const PASSWORD_MIN = 10;
const REASONS = { mismatch: "resetMismatch", short: "resetShort", long: "resetLong", email: "resetIsEmail" } as const;
type View = "checking" | "form" | "invalid" | "blocked" | "failed" | "done";

/** The page behind the mailed link: /{locale}/admin/reset#token=… */
export function ResetApp({ hasApi }: { hasApi: boolean }) {
  const t = useTranslations("Admin");
  const token = useRef<string | null>(null);
  const [view, setView] = useState<View>("checking");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hasApi) return;
    // the token is in the fragment, which no server sees; take it out of the address bar and the history at once
    token.current ??= /^#token=([\w-]{20,200})$/.exec(window.location.hash)?.[1] ?? "";
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    let live = true;
    const check = token.current
      ? api<{ valid: boolean }>("/api/auth/reset/verify", { method: "POST", body: JSON.stringify({ token: token.current }) })
      : Promise.resolve({ valid: false });
    check
      .then((r): View => (r.valid ? "form" : "invalid"))
      .catch((e): View => ((e as { status?: number }).status === 429 ? "blocked" : "failed"))
      .then((v) => live && setView(v));
    return () => {
      live = false;
    };
  }, [hasApi]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (password !== again) return setErr(t("resetMismatch"));
    if ([...password].length < PASSWORD_MIN) return setErr(t("resetShort"));
    setBusy(true);
    try {
      await api("/api/auth/reset/confirm", { method: "POST", body: JSON.stringify({ token: token.current, password, confirm: again }) });
      token.current = "";
      setPassword("");
      setAgain("");
      setView("done");
    } catch (e) {
      const status = (e as { status?: number }).status;
      const reason = Object.keys(REASONS).find((k) => (e as Error).message.endsWith(`: ${k}`)) as keyof typeof REASONS | undefined;
      if (status === 429) setErr(t("resetTooMany"));
      else if (status === 400 && reason) setErr(t(REASONS[reason]));
      else if (status === 400) setView("invalid");
      else setErr(t("resetError"));
    } finally {
      setBusy(false);
    }
  };

  const toLogin = (label: string) => (
    <Link href="/admin" className="inline-flex min-h-11 w-fit items-center rounded-full border border-line px-5 py-2.5 text-sm hover:border-violet">
      {label}
    </Link>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 pt-28 pb-24 sm:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-4xl sm:text-5xl">{t("title")}</h1>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 py-2.5 text-sm hover:border-violet">
          {t("view")} ↗
        </Link>
      </div>

      {!hasApi ? (
        <Card>
          <p className="text-rose">{t("noApi")}</p>
        </Card>
      ) : view === "checking" ? (
        <p className="text-muted">{t("resetChecking")}</p>
      ) : (
        <Card title={t("resetTitle")}>
          {view === "form" ? (
            <form onSubmit={submit} className="grid max-w-sm gap-4">
              <Field label={t("newPassword")}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN}
                  maxLength={200}
                  aria-describedby="reset-hint"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field label={t("repeatPassword")}>
                <Input type="password" autoComplete="new-password" required maxLength={200} value={again} onChange={(e) => setAgain(e.target.value)} />
              </Field>
              <p id="reset-hint" className="text-xs text-muted">
                {t("passwordHint")}
              </p>
              {err && (
                <p role="alert" className="text-sm text-rose">
                  {err}
                </p>
              )}
              <button type="submit" disabled={busy} className="rounded-full bg-ink py-3 text-sm font-medium text-bg disabled:opacity-50">
                {busy ? t("saving") : t("resetSave")}
              </button>
            </form>
          ) : view === "done" ? (
            <div className="grid max-w-sm gap-4">
              <p role="status" className="text-sm">
                {t("resetDone")}
              </p>
              {toLogin(t("login"))}
            </div>
          ) : (
            <div className="grid max-w-sm gap-4">
              <p role="alert" className="text-sm text-rose">
                {t(view === "invalid" ? "resetInvalid" : view === "blocked" ? "resetTooMany" : "resetError")}
              </p>
              {toLogin(t("backToLogin"))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
