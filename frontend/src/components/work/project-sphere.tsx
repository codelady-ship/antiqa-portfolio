"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { shot } from "@/lib/shot";
import type { Project } from "@/lib/types";

/**
 * A sphere of floating project cards (pure CSS 3D, no WebGL). A sticky track (200vh)
 * turns scroll into rotation; dragging spins it too. Click a card to open its demo.
 */
export function ProjectSphere({
  projects,
  onOpen,
  hint,
  word,
}: {
  projects: Project[];
  onOpen: (p: Project) => void;
  hint: string;
  word: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const ball = useRef<HTMLDivElement>(null);
  const moved = useRef(0); // px dragged since pointerdown; a drag must not open a card

  // fill the sphere: repeat projects so there are always enough cards
  const N = 28;
  const items = projects.length ? Array.from({ length: N }, (_, i) => projects[i % projects.length]) : [];

  useEffect(() => {
    const el = track.current,
      b = ball.current;
    if (!el || !b) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rotY = 0,
      rotX = -12,
      dragY = 0,
      dragX = 0,
      vel = 0,
      raf = 0,
      running = false,
      dragging = false,
      focused = false,
      drift = 0,
      last = performance.now(),
      lx = 0,
      ly = 0;

    const progress = () => {
      const r = el.getBoundingClientRect();
      const total = r.height - innerHeight;
      return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    };
    const tick = () => {
      const p = progress();
      if (!dragging) {
        vel *= 0.95;
        dragY += vel;
      }
      // slow auto-spin; it holds still while a card has keyboard focus
      const now = performance.now();
      if (!reduce && !focused) drift += Math.min(now - last, 50) * 0.004;
      last = now;
      const target = p * 300 + dragY + drift;
      rotY = reduce ? target : rotY + (target - rotY) * 0.08; // no easing under reduced motion
      const tx = -12 + p * 18 + dragX;
      rotX = reduce ? tx : rotX + (tx - rotX) * 0.08;
      const scale = 0.75 + Math.sin(p * Math.PI) * 0.35;
      b.style.transform = `translateZ(-200px) scale(${scale}) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      el.style.setProperty("--sp", p.toFixed(3));
      if (running) raf = requestAnimationFrame(tick);
    };
    // animate only while the sphere is on screen and the tab is visible
    let inView = false;
    const sync = () => {
      running = inView && !document.hidden;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);

    const down = (e: PointerEvent) => {
      moved.current = 0; // before the early return: a tap after a drag must still open the card
      if ((e.target as HTMLElement).closest("button") && e.pointerType !== "mouse") return;
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx,
        dy = e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      moved.current += Math.abs(dx) + Math.abs(dy);
      vel = dx * 0.25;
      dragY += dx * 0.3;
      dragX = Math.max(-30, Math.min(30, dragX - dy * 0.15));
    };
    const up = () => (dragging = false);

    // keyboard: turn the sphere so the focused card faces the viewer
    const onFocus = (e: FocusEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-lon]");
      // keyboard only: a click/tap focus must not snap the sphere or fight a drag
      if (!btn || !btn.matches(":focus-visible")) return;
      focused = true;
      vel = 0;
      const p = progress();
      const lon = Number(btn.dataset.lon),
        lat = Number(btn.dataset.lat);
      const target = p * 300 + dragY + drift;
      dragY += ((((-lon - target) % 360) + 540) % 360) - 180; // shortest way round
      dragX = -lat - (-12 + p * 18);
      if (!running) tick();
    };
    const onBlur = () => {
      focused = false;
      dragX = Math.max(-30, Math.min(30, dragX));
    };

    const stage = el.querySelector<HTMLElement>("[data-stage]")!;
    stage.addEventListener("pointerdown", down);
    stage.addEventListener("focusin", onFocus);
    stage.addEventListener("focusout", onBlur);
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("focusin", onFocus);
      stage.removeEventListener("focusout", onBlur);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div ref={track} className="relative h-[200vh]" style={{ "--sp": 0 } as CSSProperties}>
      <div data-stage className="sticky top-0 flex h-dvh touch-pan-y items-center justify-center overflow-hidden select-none [perspective:1400px]">
        {/* giant word behind the sphere */}
        <p
          aria-hidden
          className="display outline-text pointer-events-none absolute text-[clamp(4rem,20vw,18rem)] opacity-40"
          style={{ transform: "translateX(calc((var(--sp) - 0.5) * -30vw))" }}
        >
          {word}
        </p>
        <div ref={ball} className="relative size-0 [transform-style:preserve-3d]">
          {items.map((p, i) => {
            // Fibonacci sphere
            const y = 1 - (i / (N - 1)) * 2;
            const lat = Math.asin(y) * (180 / Math.PI);
            const lon = (i * 137.508) % 360;
            return (
              <button
                key={i}
                type="button"
                tabIndex={i < projects.length ? 0 : -1}
                aria-hidden={i >= projects.length}
                aria-label={p.title}
                onClick={() => moved.current < 6 && onOpen(p)}
                data-lon={lon}
                data-lat={lat}
                className="group absolute focus-visible:outline-none top-0 left-0 -mt-[clamp(30px,6vw,62px)] -ml-[clamp(48px,9.6vw,100px)] w-[clamp(96px,19.2vw,200px)] [backface-visibility:hidden]"
                style={{ transform: `rotateY(${lon}deg) rotateX(${lat}deg) translateZ(clamp(150px, 36vw, 470px))` }}
              >
                <span className="block overflow-hidden rounded-lg border sm:rounded-xl border-line bg-bg-2 shadow-[var(--shadow)] transition-transform duration-300 group-hover:scale-110 group-focus-visible:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-rose group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg">
                  {p.demoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote screenshot, tiny
                    <img src={shot(p.demoUrl, 400)} alt="" loading="lazy" decoding="async" className="aspect-[16/10] w-full object-cover object-top" />
                  ) : (
                    <span className="display grid aspect-[16/10] place-items-center text-3xl" style={{ background: "var(--grad)", color: "var(--bg)" }}>
                      {p.title.charAt(0)}
                    </span>
                  )}
                  <span className="block truncate px-2 py-1 text-left text-[10px] font-medium sm:px-2.5 sm:py-1.5 sm:text-[11px]">{p.title}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="absolute bottom-8 px-4 text-center text-[10px] tracking-[0.2em] text-muted uppercase sm:text-xs">{hint}</p>
      </div>
    </div>
  );
}
