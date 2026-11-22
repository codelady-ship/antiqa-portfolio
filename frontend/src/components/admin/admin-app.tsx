"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { Profile } from "@/lib/types";
import { CvPanel } from "./cv-panel";
import { ProfileForm } from "./profile-form";
import { ProjectsPanel } from "./projects-panel";
import { api, Button, Card, Field, Input } from "./ui";

type SeedRepo = { url: string; featured?: boolean; backend?: string; title?: string; demo?: string };
const TABS = ["projects", "cv", "profile"] as const;
type Tab = (typeof TABS)[number];

export function AdminApp({ seedProfile, seedRepos, hasApi }: { seedProfile: Profile; seedRepos: SeedRepo[]; hasApi: boolean }) {
  const t = useTranslations("Admin");
  const [admin, setAdmin] = useState<boolean | null>(hasApi ? null : false);
  const [tab, setTab] = useState<Tab>("projects");

  useEffect(() => {
    if (!hasApi) return;
    api<{ admin: boolean }>("/api/auth/me")
      .then((r) => setAdmin(r.admin))
      .catch(() => setAdmin(false));
  }, [hasApi]);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setAdmin(false);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pt-28 pb-24 sm:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-4xl sm:text-5xl">{t("title")}</h1>
        <div className="flex gap-2">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 py-2.5 text-sm hover:border-violet">
            {t("view")} ↗
          </Link>
          {admin && (
            <Button variant="ghost" onClick={logout}>
              {t("logout")}
            </Button>
          )}
        </div>
      </div>

      {!hasApi ? (
        <Card>
          <p className="text-rose">{t("noApi")}</p>
        </Card>
      ) : admin === null ? (
        <p className="text-muted">{t("loading")}</p>
      ) : !admin ? (
        <Login onDone={() => setAdmin(true)} />
      ) : (
        <>
          {/* quick start: the three things she comes here for, one click each */}
          <section aria-labelledby="quick" className="mb-8">
            <h2 id="quick" className="kicker-plain mb-3">
              {t("quickTitle")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["projects", "quickProjects", "quickProjectsText", "bg-pink-soft"],
                  ["cv", "quickCv", "quickCvText", "bg-butter-soft"],
                  ["profile", "quickProfile", "quickProfileText", "bg-mint-soft"],
                ] as const
              ).map(([k, title, text, tint]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setTab(k);
                    document.getElementById("admin-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  aria-pressed={tab === k}
                  className={`rounded-3xl border-2 p-5 text-left transition-transform hover:-translate-y-0.5 ${tint} ${tab === k ? "border-ink shadow-[4px_4px_0_var(--ink)]" : "border-transparent"}`}
                >
                  <span className="display block text-lg leading-tight">{t(title)}</span>
                  <span className="mt-1.5 block text-sm text-muted">{t(text)}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">🔖 {t("bookmark")}</p>
          </section>
          <div
            role="tablist"
            aria-label={t("title")}
            className="mb-6 flex w-fit rounded-full border border-line p-1 text-sm"
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              const i = TABS.indexOf(tab) + (e.key === "ArrowRight" ? 1 : -1);
              const next = TABS[(i + TABS.length) % TABS.length];
              setTab(next);
              document.getElementById(`admin-tab-${next}`)?.focus();
            }}
          >
            {TABS.map((k) => (
              <button
                key={k}
                role="tab"
                type="button"
                id={`admin-tab-${k}`}
                aria-controls="admin-panel"
                tabIndex={tab === k ? 0 : -1}
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`rounded-full px-5 py-2 transition-colors ${tab === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
              >
                {t(k === "projects" ? "tabProjects" : k === "profile" ? "tabProfile" : "tabCv")}
              </button>
            ))}
          </div>
          <div id="admin-panel" role="tabpanel" className="scroll-mt-24" aria-labelledby={`admin-tab-${tab}`}>
            {tab === "projects" && <ProjectsPanel seedRepos={seedRepos} />}
            {tab === "profile" && <ProfileForm seed={seedProfile} />}
            {tab === "cv" && <CvPanel />}
          </div>
        </>
      )}
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const t = useTranslations("Admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  if (forgot) return <Forgot seedEmail={email} onBack={() => setForgot(false)} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      onDone();
    } catch (e) {
      setErr((e as { status?: number }).status === 429 ? t("tooMany") : t("wrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="grid max-w-sm gap-4">
        <Field label={t("email")}>
          <Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t("password")}>
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {err && (
          <p role="alert" className="text-sm text-rose">
            {err}
          </p>
        )}
        <button type="submit" disabled={busy} className="rounded-full bg-ink py-3 text-sm font-medium text-bg disabled:opacity-50">
          {t("login")}
        </button>
        <button
          type="button"
          onClick={() => {
            setErr("");
            setForgot(true);
          }}
          className="min-h-11 w-fit justify-self-center text-sm text-muted underline underline-offset-4 hover:text-ink"
        >
          {t("forgot")}
        </button>
      </form>
    </Card>
  );
}

/** "Forgot password?": asks the API to mail a reset link. The answer is the same for every address. */
function Forgot({ seedEmail, onBack }: { seedEmail: string; onBack: () => void }) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const [email, setEmail] = useState(seedEmail);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/auth/reset/request", { method: "POST", body: JSON.stringify({ email, locale }) });
      setSent(true);
    } catch (e) {
      setErr((e as { status?: number }).status === 429 ? t("forgotTooMany") : t("forgotError"));
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <button type="button" onClick={onBack} className={`min-h-11 w-fit text-sm text-muted underline underline-offset-4 hover:text-ink ${sent ? "" : "justify-self-center"}`}>
      {t("backToLogin")}
    </button>
  );

  return (
    <Card title={t("forgotTitle")}>
      {sent ? (
        <div className="grid max-w-sm gap-4">
          <p role="status" className="text-sm">
            {t("forgotSent")}
          </p>
          {back}
        </div>
      ) : (
        <form onSubmit={submit} className="grid max-w-sm gap-4">
          <p className="text-sm text-muted">{t("forgotText")}</p>
          <Field label={t("email")}>
            <Input type="email" autoComplete="username" required maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {err && (
            <p role="alert" className="text-sm text-rose">
              {err}
            </p>
          )}
          <button type="submit" disabled={busy} className="rounded-full bg-ink py-3 text-sm font-medium text-bg disabled:opacity-50">
            {busy ? t("forgotSending") : t("forgotSend")}
          </button>
          {back}
        </form>
      )}
    </Card>
  );
}
