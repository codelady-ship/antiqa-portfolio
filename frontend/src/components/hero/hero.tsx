"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type CSSProperties } from "react";

type Props = {
  first: string;
  last: string;
  initials: string;
  roles: string[];
  tagline: string;
  openToWork: boolean;
  cvHref: string | null;
};

/**
 * Sticky scroll track (260vh). The name is the LCP element and is painted on the server;
 * the particle canvas loads after the browser is idle, so it never blocks first paint.
 * --p (0..1) drives the text exit in CSS; the same value morphs the particles.
 */
export function Hero({ first, last, initials, roles, tagline, openToWork, cvHref }: Props) {
  const t = useTranslations("Hero");
  const track = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [role, setRole] = useState(0);

  // rotate roles
  useEffect(() => {
    if (roles.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setRole((r) => (r + 1) % roles.length), 2600);
    return () => clearInterval(id);
  }, [roles.length]);

  useEffect(() => {
    const el = track.current!;
    const cv = canvas.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let scene: Awaited<ReturnType<typeof import("./particle-scene").createScene>> | null = null;
    let disposed = false;
    let visible = true;

    const progress = () => {
      const r = el.getBoundingClientRect();
      const total = r.height - innerHeight;
      return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    };
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const p = progress();
        el.style.setProperty("--p", p.toFixed(4));
        if (reduce) scene?.renderStatic(p);
        else scene?.setProgress(p);
      });
    };
    const onMove = (e: PointerEvent) => scene?.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
    const onResize = () => scene?.resize();
    const isDark = () => document.documentElement.classList.contains("dark");
    const mo = new MutationObserver(() => {
      scene?.setTheme(isDark());
      if (reduce) scene?.renderStatic(progress());
    });
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (!scene || reduce) return;
      if (visible) scene.start();
      else scene.stop();
    });

    const boot = async () => {
      // WebGL is optional decoration: no support → the page still works
      try {
        const { createScene } = await import("./particle-scene");
        if (disposed) return;
        scene = createScene(cv, initials);
        scene.setTheme(isDark());
        if (reduce) scene.renderStatic(progress());
        else if (visible) scene.start();
        cv.dataset.ready = "1";
      } catch {
        /* no WebGL */
      }
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: object) => number }).requestIdleCallback;
    const idleId = idle ? idle(boot, { timeout: 1500 }) : window.setTimeout(boot, 600);

    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("resize", onResize);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    io.observe(el);
    return () => {
      disposed = true;
      if (!idle) clearTimeout(idleId);
      removeEventListener("scroll", onScroll);
      removeEventListener("pointermove", onMove);
      removeEventListener("resize", onResize);
      mo.disconnect();
      io.disconnect();
      scene?.dispose();
    };
  }, [initials]);

  return (
    <section ref={track} aria-label={`${first} ${last}`} className="relative h-[260vh]" style={{ "--p": 0 } as CSSProperties}>
      <div className="sticky top-0 h-dvh overflow-hidden">
        <div aria-hidden className="backdrop-grid absolute inset-0 opacity-60" />
        <canvas
          ref={canvas}
          aria-hidden
          className="absolute inset-0 size-full opacity-0 transition-opacity duration-1000 data-[ready]:opacity-100"
        />
        {/* soft glow behind the orb */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 size-[70vmin] -translate-1/2 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--violet) 45%, transparent), transparent 65%)" }}
        />

        <div
          className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-[12vh] sm:px-8"
          style={{
            transform: "translateY(calc(var(--p) * -28vh))",
            opacity: "calc(1 - var(--p) * 2.6)",
            filter: "blur(calc(var(--p) * 14px))",
          }}
        >
          {openToWork && (
            <p className="mb-6 inline-flex w-fit items-center gap-2.5 rounded-full border border-line bg-surface px-4 py-1.5 text-xs tracking-[0.18em] uppercase text-muted backdrop-blur">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              {t("available")}
            </p>
          )}
          <h1 className="display text-[clamp(3.4rem,15vw,13.5rem)]">
            <span className="hero-rise block">{first}</span>
            <span className="serif-it hero-rise grad-text -mt-[0.06em] block pl-[0.04em] text-[0.62em] [animation-delay:120ms]">{last}</span>
          </h1>
          <div className="mt-8 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="h-8 overflow-hidden text-lg font-medium sm:text-xl" aria-live="polite">
                <span key={role} className="block animate-[roleIn_.6s_cubic-bezier(.2,.8,.2,1)]">
                  {roles[role]}
                </span>
              </p>
              <p className="mt-2 max-w-md text-muted">{tagline}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#work"
                className="group relative overflow-hidden rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-bg transition-transform hover:-translate-y-0.5"
              >
                <span className="relative z-10">{t("cta")} →</span>
                <span aria-hidden className="absolute inset-0 translate-y-full transition-transform duration-500 group-hover:translate-y-0" style={{ background: "var(--grad)" }} />
              </a>
              {cvHref && (
                <a
                  href={cvHref}
                  download
                  className="rounded-full border border-line bg-surface px-7 py-3.5 text-sm font-medium backdrop-blur transition-colors hover:border-rose hover:text-rose"
                >
                  {t("cv")} ↓
                </a>
              )}
            </div>
          </div>
        </div>

        <div aria-hidden className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[10px] tracking-[0.3em] text-muted uppercase" style={{ opacity: "calc(1 - var(--p) * 5)" }}>
          {t("scroll")}
          <span className="h-10 w-px overflow-hidden bg-line">
            <span className="block h-1/2 w-full animate-[drip_1.8s_ease-in-out_infinite] bg-rose" />
          </span>
        </div>
      </div>
      <style>{`
        @keyframes roleIn { from { transform: translateY(100%); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes drip { from { transform: translateY(-100%) } to { transform: translateY(200%) } }
        @keyframes heroRise { from { transform: translateY(40%) } to { transform: none } }
        .hero-rise { animation: heroRise 1.1s cubic-bezier(.2,.8,.2,1) both; }
      `}</style>
    </section>
  );
}
