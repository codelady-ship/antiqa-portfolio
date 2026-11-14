"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Reveal, SplitWords } from "@/components/motion/reveal";
import type { Profile } from "@/lib/types";

export function Contact({ profile }: { profile: Profile }) {
  const t = useTranslations("Contact");
  const c = profile.contacts;
  const [copied, setCopied] = useState(false);

  const links = [
    c.phone && { label: c.phone, href: `tel:${c.phone.replace(/\s/g, "")}`, k: t("phone") },
    // brand: the key is a product name (not translated); the label is always a name/handle/number
    c.whatsapp && { label: "WhatsApp", href: `https://wa.me/${c.whatsapp}`, k: "WhatsApp", brand: true },
    c.telegram && { label: "Telegram", href: `https://t.me/${c.telegram}`, k: "Telegram", brand: true },
    c.linkedin && { label: "LinkedIn", href: c.linkedin, k: "LinkedIn", brand: true },
    c.github && { label: "GitHub", href: c.github, k: "GitHub", brand: true },
    c.instagram && { label: `@${c.instagram}`, href: `https://instagram.com/${c.instagram}`, k: "Instagram", brand: true },
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
    // content-visibility: last section (only the footer follows), already overflow-hidden and
    // free of fixed/sticky children, so skipping its layout until it nears the viewport cannot
    // move anything above it or clip anything; `auto` remembers the real height once rendered
    <section
      id="contact"
      className="relative scroll-mt-24 overflow-hidden px-4 py-28 [contain-intrinsic-size:auto_900px] [content-visibility:auto] sm:px-8 sm:py-40"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-1/3 left-1/2 size-[90vmin] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--grad)" }}
      />
      <div className="relative mx-auto max-w-7xl">
        <Reveal as="p" className="kicker">
          {t("kicker")}
        </Reveal>
        <Reveal as="h2" className="display type-section mt-6 max-w-5xl">
          <SplitWords text={t("title")} />
        </Reveal>
        <Reveal as="p" className="mt-8 max-w-xl text-lg text-muted">
          {t("lead")}
        </Reveal>

        {c.email && (
          <Reveal className="mt-12">
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={`mailto:${c.email}`}
                translate="no"
                className="notranslate serif-it grad-text flex min-h-11 min-w-0 items-center text-[clamp(1.6rem,1rem+2.6vw,3.25rem)] leading-none break-all"
              >
                {c.email}
              </a>
              <button type="button" onClick={copy} className="min-h-11 rounded-full border border-line px-5 py-2 text-sm hover:border-violet" aria-live="polite">
                {copied ? `${t("copied")} ✓` : t("copy")}
              </button>
            </div>
          </Reveal>
        )}

        <ul className="mt-12 flex flex-wrap gap-3">
          {links.map((l, i) => (
            <Reveal as="li" key={l.k} index={i} className="max-w-full">
              <a
                href={l.href}
                target={l.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer me"
                className="group flex max-w-full items-center gap-2 rounded-full border border-line bg-surface px-5 py-3.5 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-rose sm:px-6"
              >
                <span translate={l.brand ? "no" : undefined} className={`shrink-0 text-[11px] tracking-[0.16em] text-muted uppercase ${l.brand ? "notranslate" : ""}`}>
                  {l.k}
                </span>
                <span translate="no" className="notranslate min-w-0 truncate font-medium">
                  {l.label}
                </span>
                <span className="shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
              </a>
            </Reveal>
          ))}
          {(["az", "en"] as const).map(
            (lang, i) =>
              profile.cv[lang] && (
                <Reveal as="li" key={lang} index={links.length + i}>
                  <a href={profile.cv[lang]} download className="flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 font-medium text-bg transition-transform hover:-translate-y-1">
                    {lang === "az" ? t("cvAz") : t("cvEn")} ↓
                  </a>
                </Reveal>
              ),
          )}
        </ul>
      </div>
    </section>
  );
}
