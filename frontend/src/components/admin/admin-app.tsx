"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { Profile } from "@/lib/types";
import { CvPanel } from "./cv-panel";
import { ProfileForm } from "./profile-form";
import { ProjectsPanel } from "./projects-panel";
import { SignOutEverywhere } from "./sign-out-everywhere";
import { api, Button, Card, DirtyProvider, EXPIRED_EVENT, Field, Input, ToastProvider, useToast } from "./ui";

type SeedRepo = { url: string; featured?: boolean; backend?: string; title?: string; demo?: string };
const TABS = ["projects", "cv", "profile"] as const;
type Tab = (typeof TABS)[number];
/** set once a quick-start card was used: later visits show the cards folded (they pushed the panel below the fold) */
const QUICK_KEY = "pf-admin-quick-used";

const readFlag = (k: string) => {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(k) === "1";
  } catch {
    return false;
  }
};
const writeFlag = (k: string) => {
  try {
    window.localStorage.setItem(k, "1");
  } catch {
    /* private mode: the cards just stay open */
  }
};

export function AdminApp(props: { seedProfile: Profile; seedRepos: SeedRepo[]; hasApi: boolean }) {
  return (
    <ToastProvider>
      <Admin {...props} />
    </ToastProvider>
  );
}

function Admin({ seedProfile, seedRepos, hasApi }: { seedProfile: Profile; seedRepos: SeedRepo[]; hasApi: boolean }) {
  const t = useTranslations("Admin");
  const toast = useToast();
  const [admin, setAdmin] = useState<boolean | null>(hasApi ? null : false);
  // the session ended while the panel was open: login form on top, the panels (and their unsaved forms) stay mounted
  const [expired, setExpired] = useState(false);
  const [tab, setTab] = useState<Tab>("projects");
  // a panel mounts on its first visit and then stays: switching tabs keeps what was typed
  const [seen, setSeen] = useState<Set<Tab>>(() => new Set(["projects"]));
  const [quickOpen, setQuickOpen] = useState(() => !readFlag(QUICK_KEY));
  const [slow, setSlow] = useState(false);

  // unsaved forms (projects rows, profile, the add-from-GitHub form)
  const dirtyKeys = useRef(new Set<string>());
  const setDirty = useCallback((key: string, dirty: boolean) => {
    if (dirty) dirtyKeys.current.add(key);
    else dirtyKeys.current.delete(key);
  }, []);
  const leaveOk = () => dirtyKeys.current.size === 0 || window.confirm(t("leaveConfirm"));

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyKeys.current.size === 0) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // the site menu (logo, About, Work…) uses client-side links: no beforeunload there, so ask on the click.
  // Capture phase on document runs before the Next Link handler; with nothing unsaved it does nothing.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dirtyKeys.current.size === 0 || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.dataset.leaveConfirm !== undefined || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      // still the admin page (a hash, or the AZ / EN switch): nothing is lost
      if (url.origin === window.location.origin && /^\/(az|en)\/admin(\/|$)/.test(url.pathname)) return;
      if (window.confirm(t("leaveConfirm"))) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [t]);

  useEffect(() => {
    if (!hasApi) return;
    // "Loading…" only if the check is slow: no flash before the form
    const id = setTimeout(() => setSlow(true), 600);
    api<{ admin: boolean }>("/api/auth/me")
      .then((r) => setAdmin(r.admin))
      .catch(() => setAdmin(false))
      .finally(() => clearTimeout(id));
    return () => clearTimeout(id);
  }, [hasApi]);

  useEffect(() => {
    const onExpired = () => {
      setExpired(true);
      toast(null);
    };
    window.addEventListener(EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(EXPIRED_EVENT, onExpired);
  }, [toast]);

  const open = (k: Tab) => {
    setTab(k);
    setSeen((s) => (s.has(k) ? s : new Set(s).add(k)));
  };

  // back to the login form with a clean panel (after Sign out, or Sign out everywhere)
  const signedOut = () => {
    dirtyKeys.current.clear();
    toast(null);
    setExpired(false);
    setSeen(new Set(["projects"]));
    setTab("projects");
    setAdmin(false);
  };
  const logout = async () => {
    if (!leaveOk()) return;
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    signedOut();
  };

  const signedIn = admin && !expired;

  return (
    <DirtyProvider value={setDirty}>
      <div className="mx-auto max-w-5xl px-4 pt-28 pb-24 sm:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h1 className="display text-4xl sm:text-5xl">{t("title")}</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              data-leave-confirm // asks in its own onClick
              onClick={(e) => {
                if (!leaveOk()) e.preventDefault();
              }}
              className="inline-flex min-h-11 items-center rounded-full border border-line px-5 py-2.5 text-sm hover:border-violet"
            >
              {t("view")} ↗
            </Link>
            {signedIn && (
              <Button variant="ghost" onClick={logout}>
                {t("logout")}
              </Button>
            )}
            {signedIn && <SignOutEverywhere onDone={signedOut} />}
          </div>
        </div>

        {!hasApi ? (
          <Card>
            <p className="text-rose">{t("noApi")}</p>
          </Card>
        ) : admin === null ? (
          <p className="min-h-6 text-muted">{slow ? t("loading") : ""}</p>
        ) : !signedIn ? (
          <Login
            expired={expired}
            onDone={() => {
              setExpired(false);
              setAdmin(true);
            }}
          />
        ) : null}

        {/* stays mounted while the login form asks for the password again after an expired session */}
        {admin && (
          <div hidden={expired}>
            {/* quick start: the three things she comes here for, one click each */}
            <section aria-labelledby="quick" className="mb-8">
              <h2 id="quick" className="kicker-plain mb-3">
                <button type="button" onClick={() => setQuickOpen(!quickOpen)} aria-expanded={quickOpen} className="inline-flex min-h-11 items-center gap-2">
                  {t("quickTitle")} <span aria-hidden>{quickOpen ? "▾" : "▸"}</span>
                </button>
              </h2>
              {quickOpen && (
                <>
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
                          open(k);
                          writeFlag(QUICK_KEY);
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
                </>
              )}
            </section>
            <div
              role="tablist"
              aria-label={t("title")}
              className="mb-6 flex w-fit rounded-full border border-line p-1 text-sm"
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                const i = TABS.indexOf(tab) + (e.key === "ArrowRight" ? 1 : -1);
                const next = TABS[(i + TABS.length) % TABS.length];
                open(next);
                document.getElementById(`admin-tab-${next}`)?.focus();
              }}
            >
              {TABS.map((k) => (
                <button
                  key={k}
                  role="tab"
                  type="button"
                  id={`admin-tab-${k}`}
                  aria-controls={`admin-panel-${k}`}
                  tabIndex={tab === k ? 0 : -1}
                  aria-selected={tab === k}
                  onClick={() => open(k)}
                  className={`rounded-full px-5 py-2 transition-colors ${tab === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
                >
                  {t(k === "projects" ? "tabProjects" : k === "profile" ? "tabProfile" : "tabCv")}
                </button>
              ))}
            </div>
            <div id="admin-panel" className="scroll-mt-24">
              {TABS.map((k) => (
                <div key={k} id={`admin-panel-${k}`} role="tabpanel" aria-labelledby={`admin-tab-${k}`} hidden={tab !== k}>
                  {seen.has(k) && (k === "projects" ? <ProjectsPanel seedRepos={seedRepos} /> : k === "profile" ? <ProfileForm seed={seedProfile} /> : <CvPanel />)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DirtyProvider>
  );
}

function Login({ onDone, expired }: { onDone: () => void; expired: boolean }) {
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
    <div className="max-w-md">
      <Card>
        <form onSubmit={submit} className="grid gap-4">
          {expired && (
            <p role="status" className="rounded-2xl bg-butter-soft px-4 py-3 text-sm">
              {t("expired")}
            </p>
          )}
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
    </div>
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
    <div className="max-w-md">
      <Card title={t("forgotTitle")}>
        {sent ? (
          <div className="grid gap-4">
            <p role="status" className="text-sm">
              {t("forgotSent")}
            </p>
            {back}
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
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
    </div>
  );
}
