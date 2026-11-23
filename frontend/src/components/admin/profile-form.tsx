"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { Profile } from "@/lib/types";
import { ApiError, api, Area, Button, Card, ConfirmButton, Field, Input, useDirty, useFail, useSaved, useToast } from "./ui";

type Form = Omit<Profile, "cv">;
/** Keep in step with ProfileInput in backend/src/app.ts (the server checks again) */
const MAX = { roles: 8, skills: 40, skillLen: 40, items: 10, socials: 6 } as const;

export function ProfileForm({ seed }: { seed: Profile }) {
  const t = useTranslations("Admin");
  const toast = useToast();
  const fail = useFail();
  const saved = useSaved();
  const [f, setF] = useState<Form | null>(null);
  // what the form was loaded from: the unsaved-changes check, and the version a save must still match (409 otherwise)
  const [base, setBase] = useState<{ json: string; updatedAt: string | null }>({ json: "", updatedAt: null });
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const dirty = !!f && JSON.stringify(f) !== base.json;
  useDirty("profile", dirty);

  const load = useCallback(
    () =>
      api<Partial<Profile> & { updatedAt?: string }>("/api/profile")
        .then((p) => {
          // first run: database is empty → start from the current site data
          const { name, initials, roles, tagline, about, location, openToWork, skills, education, experience, socials, contacts } = p?.name ? ({ ...seed, ...p } as Profile) : seed;
          const form: Form = { name, initials, roles, tagline, about, location, openToWork, skills, education, experience: experience ?? [], contacts, socials: socials ?? [] };
          setF(form);
          setBase({ json: JSON.stringify(form), updatedAt: p?.updatedAt ?? null });
          setLoadErr(false);
        })
        .catch((e) => {
          setLoadErr(true);
          fail(e);
        }),
    [seed, fail],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (!f) return <p className="text-muted">{loadErr ? t("err_server_error") : t("loading")}</p>;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const setL = (k: "tagline" | "about" | "location", lang: "az" | "en", v: string) => set(k, { ...f[k], [lang]: v });
  const setC = (k: keyof Form["contacts"], v: string) => set("contacts", { ...f.contacts, [k]: v });
  // keep raw text while typing; clean only on save
  const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    setSaving(true);
    toast(null);
    try {
      const { name, initials, tagline, about, location, openToWork, education, experience, contacts } = f;
      const socials = (f.socials ?? []).map((s) => ({ label: s.label.trim(), url: s.url.trim() })).filter((s) => s.label && s.url);
      const roles = { az: clean(f.roles.az), en: clean(f.roles.en) };
      const skills = clean(f.skills);
      const p = await api<{ updatedAt?: string }>("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ name, initials, roles, tagline, about, location, openToWork, skills, education, experience, contacts, socials, expectedUpdatedAt: base.updatedAt }),
      });
      const form: Form = { ...f, roles, skills, socials };
      setF(form);
      setBase({ json: JSON.stringify(form), updatedAt: p?.updatedAt ?? null });
      await saved();
    } catch (e) {
      // saved elsewhere meanwhile (another tab or device): nothing was overwritten; she chooses to load that version
      if (e instanceof ApiError && e.code === "stale_profile")
        toast({
          kind: "error",
          text: t("err_stale_profile"),
          action: {
            label: t("loadLatest"),
            run: () => {
              toast(null);
              void load();
            },
          },
        });
      else fail(e);
    } finally {
      setSaving(false);
    }
  };
  const removeHint = t("removeHint");

  return (
    <div className="grid gap-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("name")}>
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label={t("initials")}>
            <Input value={f.initials} maxLength={4} onChange={(e) => set("initials", e.target.value)} />
          </Field>
          <Field label={`${t("rolesAz")} · ${t("maxN", { n: MAX.roles })}`}>
            <Area rows={3} value={f.roles.az.join("\n")} onChange={(e) => set("roles", { ...f.roles, az: e.target.value.split("\n") })} />
          </Field>
          <Field label={`${t("rolesEn")} · ${t("maxN", { n: MAX.roles })}`}>
            <Area rows={3} value={f.roles.en.join("\n")} onChange={(e) => set("roles", { ...f.roles, en: e.target.value.split("\n") })} />
          </Field>
          {(["tagline", "about"] as const).map((k) =>
            (["az", "en"] as const).map((l) => (
              <Field key={k + l} label={t(`${k}${l === "az" ? "Az" : "En"}`)}>
                <Area rows={k === "about" ? 6 : 2} value={f[k][l]} onChange={(e) => setL(k, l, e.target.value)} />
              </Field>
            )),
          )}
          {(["az", "en"] as const).map((l) => (
            <Field key={l} label={t(l === "az" ? "locationAz" : "locationEn")}>
              <Input value={f.location[l]} onChange={(e) => setL("location", l, e.target.value)} />
            </Field>
          ))}
          <Field label={`${t("skills")} · ${t("skillsLimit", { n: MAX.skills, len: MAX.skillLen })}`} wide>
            <Input
              value={f.skills.join(", ")}
              onChange={(e) =>
                set(
                  "skills",
                  e.target.value.split(",").map((s) => s.trimStart()),
                )
              }
              onBlur={() => set("skills", clean(f.skills))}
            />
          </Field>
          <label className="flex items-center gap-3 text-sm sm:col-span-2">
            <input type="checkbox" className="size-4 accent-violet-500" checked={f.openToWork} onChange={(e) => set("openToWork", e.target.checked)} />
            {t("openToWork")}
          </label>
        </div>
      </Card>

      <Card
        title={t("experience")}
        actions={
          <Button
            variant="ghost"
            disabled={f.experience.length >= MAX.items}
            title={t("maxN", { n: MAX.items })}
            onClick={() =>
              set("experience", [...f.experience, { title: { az: "", en: "" }, place: "", period: { az: "", en: "" }, summary: { az: "", en: "" } }])
            }
          >
            + {t("add")} ({f.experience.length}/{MAX.items})
          </Button>
        }
      >
        <div className="grid gap-4">
          {f.experience.map((e, i) => {
            const upd = (v: Partial<(typeof f.experience)[number]>) => set("experience", f.experience.map((x, j) => (j === i ? { ...x, ...v } : x)));
            return (
              <div key={i} className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-2">
                <Field label={t("expTitleAz")}>
                  <Input value={e.title.az} onChange={(ev) => upd({ title: { ...e.title, az: ev.target.value } })} />
                </Field>
                <Field label={t("expTitleEn")}>
                  <Input value={e.title.en} onChange={(ev) => upd({ title: { ...e.title, en: ev.target.value } })} />
                </Field>
                <Field label={t("expPlace")} wide>
                  <Input value={e.place} onChange={(ev) => upd({ place: ev.target.value })} />
                </Field>
                <Field label={t("expPeriodAz")}>
                  <Input value={e.period.az} onChange={(ev) => upd({ period: { ...e.period, az: ev.target.value } })} />
                </Field>
                <Field label={t("expPeriodEn")}>
                  <Input value={e.period.en} onChange={(ev) => upd({ period: { ...e.period, en: ev.target.value } })} />
                </Field>
                <Field label={t("expSummaryAz")}>
                  <Area rows={3} value={e.summary.az} onChange={(ev) => upd({ summary: { ...e.summary, az: ev.target.value } })} />
                </Field>
                <Field label={t("expSummaryEn")}>
                  <Area rows={3} value={e.summary.en} onChange={(ev) => upd({ summary: { ...e.summary, en: ev.target.value } })} />
                </Field>
                <ConfirmButton className="sm:col-span-2" hint={removeHint} onConfirm={() => set("experience", f.experience.filter((_, j) => j !== i))}>
                  {t("remove")}
                </ConfirmButton>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title={t("education")}
        actions={
          <Button
            variant="ghost"
            disabled={f.education.length >= MAX.items}
            title={t("maxN", { n: MAX.items })}
            onClick={() => set("education", [...f.education, { title: { az: "", en: "" }, place: "", period: "" }])}
          >
            + {t("add")} ({f.education.length}/{MAX.items})
          </Button>
        }
      >
        <div className="grid gap-4">
          {f.education.map((e, i) => {
            const upd = (v: Partial<(typeof f.education)[number]>) => set("education", f.education.map((x, j) => (j === i ? { ...x, ...v } : x)));
            return (
              <div key={i} className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-2">
                <Field label={t("eduTitleAz")}>
                  <Input value={e.title.az} onChange={(ev) => upd({ title: { ...e.title, az: ev.target.value } })} />
                </Field>
                <Field label={t("eduTitleEn")}>
                  <Input value={e.title.en} onChange={(ev) => upd({ title: { ...e.title, en: ev.target.value } })} />
                </Field>
                <Field label={t("eduPlace")}>
                  <Input value={e.place} onChange={(ev) => upd({ place: ev.target.value })} />
                </Field>
                <Field label={t("eduPeriod")}>
                  <Input value={e.period} onChange={(ev) => upd({ period: ev.target.value })} />
                </Field>
                <ConfirmButton className="sm:col-span-2" hint={removeHint} onConfirm={() => set("education", f.education.filter((_, j) => j !== i))}>
                  {t("remove")}
                </ConfirmButton>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title={t("contacts")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("email")}>
            <Input type="email" value={f.contacts.email} onChange={(e) => setC("email", e.target.value)} />
          </Field>
          <Field label={t("phone")}>
            <Input type="tel" value={f.contacts.phone} onChange={(e) => setC("phone", e.target.value)} />
          </Field>
          <Field label={t("whatsapp")}>
            <Input inputMode="numeric" value={f.contacts.whatsapp} onChange={(e) => setC("whatsapp", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label={t("telegram")}>
            <Input value={f.contacts.telegram} onChange={(e) => setC("telegram", e.target.value.replace(/^@/, ""))} />
          </Field>
          <Field label={t("linkedin")}>
            <Input type="url" pattern="https://.*" placeholder="https://" value={f.contacts.linkedin} onChange={(e) => setC("linkedin", e.target.value)} />
          </Field>
          <Field label={t("github")}>
            <Input type="url" pattern="https://.*" placeholder="https://" value={f.contacts.github} onChange={(e) => setC("github", e.target.value)} />
          </Field>
          <Field label={t("instagram")}>
            <Input value={f.contacts.instagram} onChange={(e) => setC("instagram", e.target.value.replace(/^@/, ""))} />
          </Field>
        </div>
        {/* other socials: shown in Contact and About (https links only, up to 6) */}
        <div className="mt-6 grid gap-3">
          <p className="text-sm font-semibold">
            {t("socials")} <span className="font-normal text-muted">· {t("maxN", { n: MAX.socials })}</span>
          </p>
          {(f.socials ?? []).map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
              <Input aria-label={t("socialLabel")} placeholder="YouTube" maxLength={40} value={s.label} onChange={(e) => set("socials", (f.socials ?? []).map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <Input aria-label={t("socialUrl")} type="url" pattern="https://.*" placeholder="https://" value={s.url} onChange={(e) => set("socials", (f.socials ?? []).map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <ConfirmButton variant="ghost" hint={removeHint} onConfirm={() => set("socials", (f.socials ?? []).filter((_, j) => j !== i))}>
                {t("remove")}
              </ConfirmButton>
            </div>
          ))}
          {(f.socials ?? []).length < MAX.socials && (
            <div>
              <Button variant="ghost" onClick={() => set("socials", [...(f.socials ?? []), { label: "", url: "" }])}>
                + {t("addSocial")}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div className="sticky bottom-4 flex flex-wrap items-center gap-4 rounded-full border border-line bg-bg/80 p-2 pl-5 backdrop-blur-xl">
        <p className={`flex-1 text-sm ${dirty ? "text-gold" : "text-muted"}`}>{saving ? t("saving") : dirty ? `● ${t("unsaved")}` : ""}</p>
        <Button onClick={save} disabled={saving}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
