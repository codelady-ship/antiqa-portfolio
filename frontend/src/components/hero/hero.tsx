"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type CSSProperties } from "react";
import photo from "./antiqa.jpg";

type Props = {
  first: string;
  last: string;
  /** static job title + stack (identity.ts), shown under the name */
  title: string;
  stack: string;
  tagline: string;
  location: string;
  stickers: string[];
  cvHref: string | null;
};

/**
 * Hero (#32): her name (the LCP element, painted on the server, never faded in), what she does,
 * two calls to action, and her real photo in a pastel arch. On wide screens a small confetti
 * scene (Three.js, lazy) drifts around the photo; it boots after `load` on the first idle
 * period and only while the hero is on screen. Phones and tablets get a round avatar instead
 * of the arch and no WebGL at all.
 */
export function Hero({ first, last, title, stack, tagline, location, stickers, cvHref }: Props) {
  const t = useTranslations("Hero");
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = host.current!;
    const cv = canvas.current!;
    const wide = matchMedia("(min-width: 1024px) and (pointer: fine)");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (!wide.matches || nav.connection?.saveData) return;

    let scene: Awaited<ReturnType<typeof import("./particle-scene").createScene>> | null = null;
    let disposed = false,
      visible = true,
      idleId = 0,
      timer = 0;
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    const isDark = () => document.documentElement.classList.contains("dark");

    const sync = () => {
      if (!scene || reduce) return;
      if (visible && !document.hidden) scene.start();
      else scene.stop();
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sync();
    });
    const mo = new MutationObserver(() => {
      scene?.setTheme(isDark());
      if (reduce) scene?.renderStatic();
    });
    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      scene?.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    };
    const onResize = () => scene?.resize();

    const boot = async () => {
      // WebGL is optional decoration: no support → the photo and shapes stay
      try {
        const { createScene } = await import("./particle-scene");
        if (disposed) return;
        const s = await createScene(cv, () => disposed);
        if (disposed) return s.dispose();
        scene = s;
        scene.setTheme(isDark());
        if (reduce) scene.renderStatic();
        else sync();
        cv.dataset.ready = "1";
      } catch {
        /* no WebGL, or unmounted while booting */
      }
    };
    const whenIdle = () => {
      if (disposed) return;
      if (w.requestIdleCallback) idleId = w.requestIdleCallback(() => void boot());
      else timer = window.setTimeout(() => void boot(), 200);
    };
    if (document.readyState === "complete") whenIdle();
    else addEventListener("load", whenIdle, { once: true });

    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    io.observe(el);
    return () => {
      disposed = true;
      clearTimeout(timer);
      if (idleId) w.cancelIdleCallback?.(idleId);
      removeEventListener("load", whenIdle);
      removeEventListener("pointermove", onMove);
      removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", sync);
      mo.disconnect();
      io.disconnect();
      scene?.dispose();
    };
  }, []);

  const dots = ["bg-rose", "bg-mint", "bg-violet"];

  return (
    <section aria-labelledby="hero-name" className="relative overflow-hidden">
      {/* soft paper shapes (no blur, no grid): a peach sun behind the photo, a mint pebble */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[38rem] rounded-full bg-peach-soft max-lg:hidden" />
      <div aria-hidden className="pointer-events-none absolute bottom-10 -left-24 size-56 rounded-full bg-mint-soft opacity-70 max-sm:hidden" />

      <div className="wrap relative grid items-center gap-12 pt-28 pb-16 sm:pt-36 sm:pb-24 lg:min-h-[min(100svh,960px)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:pt-32 lg:pb-20">
        <div>
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
          <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted sm:text-lg">{tagline}</p>

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

        {/* wide screens: the photo in a pastel arch, a handwritten note, three tech stickers */}
        <div ref={host} className="relative mx-auto hidden w-full max-w-[12.5rem] lg:block xl:max-w-[16rem] 2xl:max-w-[18rem] min-[1800px]:max-w-[20rem]">
          <canvas
            ref={canvas}
            aria-hidden
            className="pointer-events-none absolute -inset-x-28 -inset-y-20 h-[calc(100%+10rem)] w-[calc(100%+14rem)] opacity-0 transition-opacity duration-1000 data-[ready]:opacity-100"
          />
          <div aria-hidden className="absolute -top-6 -right-8 size-24 rotate-12 rounded-[1.75rem] bg-lilac-soft" />
          <div aria-hidden className="absolute -bottom-8 -left-10 size-28 rounded-full bg-mint-soft" />
          <figure className="relative isolate aspect-[4/5] overflow-hidden rounded-t-[6.25rem] rounded-b-[2rem] xl:rounded-t-[8rem] 2xl:rounded-t-[9rem] min-[1800px]:rounded-t-[10rem] border-[6px] border-surface bg-gradient-to-b from-[#ffd3df] to-[#ffe4d1] shadow-[var(--shadow)]">
            <Image
              src={photo}
              alt={t("photoAlt", { name: `${first} ${last}` })}
              sizes="(min-width: 1800px) 320px, (min-width: 1536px) 288px, (min-width: 1280px) 256px, 200px"
              placeholder="blur"
              className="absolute inset-0 size-full object-cover object-top mix-blend-multiply"
            />
          </figure>
          <p aria-hidden className="hand absolute -top-2 -left-24 flex -rotate-6 items-end gap-1 text-[1.6rem] leading-none text-rose xl:-left-28">
            {t("me")}
            <svg viewBox="0 0 60 40" className="h-8 w-12 translate-y-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M4 8c14-4 32 0 44 20" />
              <path d="M40 26l9 4 1-10" />
            </svg>
          </p>
          <ul translate="no" lang="en" className="notranslate">
            {stickers.slice(0, 3).map((s, i) => (
              <li
                key={s}
                className={`bob absolute flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[0.8125rem] font-semibold shadow-[var(--shadow)] ${
                  ["top-[38%] -left-16", "-right-14 bottom-[30%]", "bottom-[6%] left-[18%]"][i]
                }`}
                style={{ "--r": `${[-6, 5, -3][i]}deg`, animationDelay: `${i * -1.6}s` } as CSSProperties}
              >
                <span aria-hidden className={`size-2 rounded-full ${dots[i]}`} />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
