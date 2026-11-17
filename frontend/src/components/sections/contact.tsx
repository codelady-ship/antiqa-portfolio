"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Reveal, SplitWords } from "@/components/motion/reveal";
import { PersonaClip } from "@/components/persona/clip";
import { PERSONA } from "@/components/persona/config";
import type { Profile } from "@/lib/types";

const DOTS = ["bg-rose", "bg-mint", "bg-violet", "bg-gold"];

/**
 * Contact (owner, 2026-11-17): she appears on the left and waves (desktop video); on her right the
 * email, GitHub, LinkedIn and phone from the profile (API / admin panel), then the CV downloads.
 */
export function Contact({ profile, bubble, aiNote }: { profile: Profile; bubble?: string; aiNote?: string }) {
  const t = useTranslations("Contact");
  const c = profile.contacts;
  const [copied, setCopied] = useState(false);

  // the owner's list: GitHub, LinkedIn, phone (the email is the big link above them)
  const links = [
    // brand: the key is a product name (not translated); the label is always a name/handle/number
    c.github && { label: "GitHub", href: c.github, k: "GitHub", brand: true },
    c.linkedin && { label: "LinkedIn", href: c.linkedin, k: "LinkedIn", brand: true },
    c.phone && { label: c.phone, href: `tel:${c.phone.replace(/\s/g, "")}`, k: t("phone") },
  ].filter(Boolean) as { label: string; href: string; k: string; brand?: boolean }[];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(c.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      location.href = `mailto:${c.email}`;
    }
  };

  return (
    // content-visibility: last section (only the footer follows), free of fixed/sticky children,
    // so skipping its layout until it nears the viewport cannot move anything above it;
    // `auto` remembers the real height once rendered
    <section id="contact" className="wrap relative scroll-mt-24 py-20 [contain-intrinsic-size:auto_900px] [content-visibility:auto] sm:py-28">
      {/* a postcard: pink paper, a lilac corner, a mint stamp (#32) */}
      <div className="relative isolate overflow-hidden rounded-[2.5rem] bg-pink-soft px-5 py-14 sm:px-12 sm:py-20 xl:px-16">
        <div aria-hidden className="absolute -top-24 -right-24 -z-10 size-72 rounded-full bg-lilac-soft sm:size-96" />
        <div aria-hidden className="absolute right-[12%] -bottom-16 -z-10 size-40 rotate-12 rounded-[2.5rem] bg-peach-soft max-sm:hidden" />
        <div className="grid gap-10 lg:grid-cols-[clamp(15rem,24vw,26rem)_minmax(0,1fr)] lg:items-center xl:gap-14">
          {/* her: the waving video (desktop); phones keep the plain card */}
          <div className="relative hidden lg:block">
            <PersonaClip clip={PERSONA.wave} mode="loop" />
            {bubble && (
              <p
                aria-hidden
                className="persona-bubble hand absolute top-[4%] -right-[6%] max-w-[11rem] -rotate-3 rounded-[1.4rem] border-2 border-ink bg-surface px-4 py-2.5 text-[1.25rem] leading-tight text-ink shadow-[4px_4px_0_var(--ink)]"
              >
                {bubble}
              </p>
            )}
            {aiNote && <p className="mt-2 text-center text-xs text-muted">{aiNote}</p>}
          </div>
          <div className="min-w-0">
            <Reveal as="p" className="kicker bg-surface">
              {t("kicker")}
            </Reveal>
            <Reveal as="h2" className="display type-section mt-5 max-w-2xl text-balance">
              <SplitWords text={t("title")} />
            </Reveal>
            <Reveal as="p" className="mt-6 max-w-xl text-lg text-pretty text-muted">
              {t("lead")}
            </Reveal>

            {c.email && (
              <Reveal className="mt-10">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={`mailto:${c.email}`}
                    translate="no"
                    className="notranslate display squiggle flex min-h-11 min-w-0 items-center text-[clamp(1.5rem,1rem+2vw,2.75rem)] leading-tight font-semibold break-all"
                  >
                    {c.email}
                  </a>
                  <button type="button" onClick={copy} className="min-h-11 rounded-full border-2 border-ink bg-surface px-5 py-2 text-sm font-semibold hover:bg-butter-soft" aria-live="polite">
                    {copied ? `${t("copied")} ✓` : t("copy")}
                  </button>
                </div>
              </Reveal>
            )}

            {/* phones: one pill per row, so a number or handle is never cut off */}
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {links.map((l, i) => (
                <Reveal as="li" key={l.k} index={i} className="max-w-full">
                  <a
                    href={l.href}
                    target={l.href.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer me"
                    className="group flex min-h-12 w-full items-center gap-2.5 rounded-full border border-line bg-surface px-5 py-3 transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOTS[i % DOTS.length]}`} />
                    {/* the key repeats the label for brands ("LinkedIn LinkedIn"): show it once */}
                    <span
                      hidden={l.k === l.label}
                      translate={l.brand ? "no" : undefined}
                      lang={l.brand ? "en" : undefined}
                      className={`shrink-0 text-xs font-medium text-muted ${l.brand ? "notranslate" : ""}`}
                    >
                      {l.k}
                    </span>
                    <span translate="no" lang={l.brand ? "en" : undefined} className="notranslate min-w-0 flex-1 truncate font-semibold">
                      {l.label}
                    </span>
                    <span aria-hidden className="shrink-0 text-muted transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                      ↗
                    </span>
                  </a>
                </Reveal>
              ))}
              {(["az", "en"] as const).map(
                (lang, i) =>
                  profile.cv[lang] && (
                    <Reveal as="li" key={lang} index={links.length + i} className={`mt-1 ${i === 0 ? "sm:col-start-1" : ""}`}>
                      <a
                        href={profile.cv[lang]}
                        download
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-accent px-6 py-3 font-semibold text-on-accent shadow-[4px_4px_0_var(--ink)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--ink)]"
                      >
                        {lang === "az" ? t("cvAz") : t("cvEn")} ↓
                      </a>
                    </Reveal>
                  ),
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
