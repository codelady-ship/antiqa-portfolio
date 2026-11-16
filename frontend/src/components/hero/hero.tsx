"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import photo from "@/components/persona/antiqa.webp";

type Props = {
  first: string;
  last: string;
  /** static job title + stack (identity.ts), shown under the name */
  title: string;
  stack: string;
  tagline: string;
  location: string;
  cvHref: string | null;
};

/**
 * Hero: her name (the LCP element, painted on the server, never faded in), what she does and
 * two calls to action. On desktop the persona stage (components/persona) stands to the right of
 * this column and waves; phones and tablets get a small round photo above the greeting.
 */
export function Hero({ first, last, title, stack, tagline, location, cvHref }: Props) {
  const t = useTranslations("Hero");
  return (
    <section aria-labelledby="hero-name" className="relative overflow-hidden">
      {/* a soft mint pebble (the persona stage beside this column has its own shapes) */}
      <div aria-hidden className="pointer-events-none absolute bottom-10 -left-24 size-56 rounded-full bg-mint-soft opacity-70 max-sm:hidden" />

      <div className="wrap relative flex items-center pt-28 pb-16 sm:pt-36 sm:pb-24 lg:min-h-[min(100svh,960px)] lg:pt-32 lg:pb-20">
        {/* the text block pops in on load, line by line (CSS .hero-pop; the name only moves, it is
            never transparent, so it stays the LCP element at first paint) */}
        <div className="hero-pop">
          {/* phones / tablets: a small round photo above the greeting */}
            <Image
              src={photo}
              alt=""
              width={64}
              height={64}
              sizes="64px"
              className="mb-4 size-16 rounded-full bg-[#ffd9e3] object-cover object-top ring-4 ring-pink-soft lg:hidden"
            />
          {/* "Hi, I'm" + her name + her job title: one text block, the LCP element (bigger than the photo
              at every width, painted on the server, never faded in). The lines are inline (<br>), so they
              stay one block for LCP; the name and the title are never machine-translated (#21). */}
          <h1 id="hero-name" className="break-words">
            <span className="hand mb-2 block w-fit -rotate-2 text-[1.5rem] leading-none font-semibold text-rose sm:text-[1.75rem] xl:text-[2rem]">{t("hello")}</span>
            <span translate="no" className="notranslate display type-hero font-[700]">
              {first}
              <br />
              <span className="squiggle text-rose">{last}</span>
            </span>
            <br />
            {/* tall line box = the gap below the squiggle */}
            <span translate="no" className="notranslate text-xl leading-[2.6] font-bold sm:text-2xl xl:text-[1.75rem]">
              {title}
            </span>
            <br />
            <span translate="no" className="notranslate text-base leading-snug font-semibold text-violet sm:text-lg xl:text-xl">
              {stack}
            </span>
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="flex items-center gap-1.5 text-base text-muted">
              <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-rose" fill="currentColor" aria-hidden>
                <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
              </svg>
              {location}
            </p>
          </div>
          <p className="mt-5 max-w-xl text-base 2xl:max-w-2xl leading-relaxed text-pretty text-muted sm:text-lg">{tagline}</p>

          <div className="mt-9 flex flex-wrap gap-3 max-sm:[&>a]:flex-1 max-sm:[&>a]:text-center">
            <a
              href="#work"
              className="rounded-full border-2 border-ink bg-accent px-6 py-3.5 font-semibold whitespace-nowrap text-on-accent shadow-[4px_4px_0_var(--ink)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--ink)] sm:px-8"
            >
              {t("cta")} →
            </a>
            {cvHref && (
              <a
                href={cvHref}
                download
                className="rounded-full border-2 border-ink bg-surface px-6 py-3.5 font-semibold whitespace-nowrap transition-colors hover:bg-butter-soft sm:px-8"
              >
                {t("cv")} ↓
              </a>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
