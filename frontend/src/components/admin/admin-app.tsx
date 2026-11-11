"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { Profile } from "@/lib/types";
import { CvPanel } from "./cv-panel";
import { ProfileForm } from "./profile-form";
import { ProjectsPanel } from "./projects-panel";
import { api, Button, Card, Field, Input } from "./ui";

type SeedRepo = { url: string; featured?: boolean; backend?: string; title?: string };
type Tab = "projects" | "profile" | "cv";

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
          <Link href="/" className="rounded-full border border-line px-5 py-2.5 text-sm hover:border-violet">
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
        <p className="text-muted">…</p>
      ) : !admin ? (
        <Login onDone={() => setAdmin(true)} />
      ) : (
        <>
          <div role="tablist" className="mb-6 flex w-fit rounded-full border border-line p-1 text-sm">
            {(["projects", "profile", "cv"] as const).map((k) => (
              <button
                key={k}
                role="tab"
                type="button"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`rounded-full px-5 py-2 transition-colors ${tab === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
              >
                {t(k === "projects" ? "tabProjects" : k === "profile" ? "tabProfile" : "tabCv")}
              </button>
            ))}
          </div>
          {tab === "projects" && <ProjectsPanel seedRepos={seedRepos} />}
          {tab === "profile" && <ProfileForm seed={seedProfile} />}
          {tab === "cv" && <CvPanel />}
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
      </form>
    </Card>
  );
}
