"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Profile } from "@/lib/types";
import { api, Area, Button, Card, Field, Input, refreshSite } from "./ui";

type Form = Omit<Profile, "cv">;

export function ProfileForm({ seed }: { seed: Profile }) {
  const t = useTranslations("Admin");
  const [f, setF] = useState<Form | null>(null);
  const [status, setStatus] = useState<"" | "saving" | "saved" | string>("");

  useEffect(() => {
    api<Partial<Profile>>("/api/profile")
      .then((p) => {
        // first run: database is empty → start from the current site data
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { cv, ...rest } = p?.name ? ({ ...seed, ...p } as Profile) : seed;
        setF(rest);
      })
      .catch((e) => setStatus(`${t("error")}: ${(e as Error).message}`));
  }, [seed, t]);

  if (!f) return <p className="text-muted">{status || "…"}</p>;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const setL = (k: "tagline" | "about" | "location", lang: "az" | "en", v: string) => set(k, { ...f[k], [lang]: v });
  const setC = (k: keyof Form["contacts"], v: string) => set("contacts", { ...f.contacts, [k]: v });
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    setStatus("saving");
    try {
      const { name, initials, roles, tagline, about, location, openToWork, skills, education, contacts } = f;
      await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ name, initials, roles, tagline, about, location, openToWork, skills, education, contacts }),
      });
      await refreshSite();
      setStatus("saved");
    } catch (e) {
      setStatus(`${t("error")}: ${(e as Error).message}`);
    }
  };

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
          <Field label={t("rolesAz")}>
            <Area rows={3} value={f.roles.az.join("\n")} onChange={(e) => set("roles", { ...f.roles, az: lines(e.target.value) })} />
          </Field>
          <Field label={t("rolesEn")}>
            <Area rows={3} value={f.roles.en.join("\n")} onChange={(e) => set("roles", { ...f.roles, en: lines(e.target.value) })} />
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
          <Field label={t("skills")} wide>
            <Input
              value={f.skills.join(", ")}
              onChange={(e) =>
                set(
                  "skills",
                  e.target.value.split(",").map((s) => s.trimStart()),
                )
              }
              onBlur={() => set("skills", f.skills.map((s) => s.trim()).filter(Boolean))}
            />
          </Field>
          <label className="flex items-center gap-3 text-sm sm:col-span-2">
            <input type="checkbox" className="size-4 accent-violet-500" checked={f.openToWork} onChange={(e) => set("openToWork", e.target.checked)} />
            {t("openToWork")}
          </label>
        </div>
      </Card>

      <Card
        title={t("education")}
        actions={
          <Button variant="ghost" onClick={() => set("education", [...f.education, { title: { az: "", en: "" }, place: "", period: "" }])}>
            + {t("add")}
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
                <Button variant="danger" className="w-fit" onClick={() => set("education", f.education.filter((_, j) => j !== i))}>
                  {t("remove")}
                </Button>
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
            <Input type="url" placeholder="https://" value={f.contacts.linkedin} onChange={(e) => setC("linkedin", e.target.value)} />
          </Field>
          <Field label={t("github")}>
            <Input type="url" placeholder="https://" value={f.contacts.github} onChange={(e) => setC("github", e.target.value)} />
          </Field>
          <Field label={t("instagram")}>
            <Input value={f.contacts.instagram} onChange={(e) => setC("instagram", e.target.value.replace(/^@/, ""))} />
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-4 flex flex-wrap items-center gap-4 rounded-full border border-line bg-bg/80 p-2 pl-5 backdrop-blur-xl">
        <p role="status" className="flex-1 text-sm text-muted">
          {status === "saving" ? t("saving") : status === "saved" ? t("saved") : status}
        </p>
        <Button onClick={save} disabled={status === "saving"}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
