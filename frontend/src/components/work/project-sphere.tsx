"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { shot } from "@/lib/shot";
import type { Project } from "@/lib/types";

const N = 28;
const RAD = Math.PI / 180;
// a card is clickable/focusable only while it faces the viewer (cos of the angle to the camera)
// and its on-screen box is at least a 44 px touch target; edge-on and back cards are `inert`
const FACING = 0.45;
const MIN_TARGET = 44;

/**
 * A compact globe of project thumbnails (pure CSS 3D, no WebGL): the centrepiece of the work
 * section. On desktop (xl) it sits sticky in the middle column between the card columns; below xl
 * it is a square block above the card grid. Scrolling past it turns it, dragging spins it too.
 * Click a thumbnail to open its demo. All sizes follow the stage width (container query units).
 *
 * Degrades by device:
 *  - full: eased scroll + drag rotation and a slow auto-spin, rendered every frame while on screen;
 *  - low-end (≤ 4 cores on a small screen, ≤ 2 GB RAM, Data Saver): no auto-spin and no easing,
 *    a frame is drawn only on scroll/drag/focus — no idle rAF loop;
 *  - prefers-reduced-motion: no scroll-linked motion (a static pose that only turns when dragged
 *    or when the keyboard focuses a card).
 * Every project is also a full card in the grid beside/below, so the globe is never the only way to a card.
 */
export function ProjectSphere({
  projects,
  onOpen,
  hint,
  word,
  className = "",
}: {
  projects: Project[];
  onOpen: (p: Project) => void;
  hint: string;
  word: string;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const ball = useRef<HTMLDivElement>(null);
  const moved = useRef(0); // px dragged since pointerdown; a drag must not open a card

  // fill the sphere: repeat projects so there are always enough cards
  const items = projects.length ? Array.from({ length: N }, (_, i) => projects[i % projects.length]) : [];

  useEffect(() => {
    const el = track.current,
      b = ball.current;
    if (!el || !b) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    const lowEnd =
      !!nav.connection?.saveData || (nav.deviceMemory ?? 8) <= 2 || ((nav.hardwareConcurrency || 8) <= 4 && matchMedia("(max-width: 767px)").matches);
    // continuous animation only on capable devices without a reduced-motion preference
    const animate = !reduce && !lowEnd;
    if (!animate) el.dataset.lite = reduce ? "static" : "lite";

    const cards = [...b.querySelectorAll<HTMLButtonElement>("[data-lon]")].map((btn) => ({
      btn,
      lon: Number(btn.dataset.lon),
      lat: Number(btn.dataset.lat),
    }));

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
      frame = 0,
      last = performance.now(),
      lx = 0,
      ly = 0;

    // 0 → 1 while the globe's track (the tall middle column on desktop, the globe itself below xl)
    // passes through the viewport; reduced motion: the pose does not follow the scroll
    const progress = () => {
      if (reduce) return 0.5;
      const r = el.getBoundingClientRect();
      return Math.min(1, Math.max(0, (innerHeight - r.top) / (r.height + innerHeight)));
    };

    // the card that opened the demo modal: the <dialog> returns focus to it on close, so it must
    // never be inert while the dialog is open (an inert element cannot take focus → focus is lost)
    let opener: HTMLButtonElement | null = null;
    const dialogOpen = () => !!document.querySelector("dialog[open]");

    // which cards may take pointer/keyboard input: facing the viewer and big enough on screen
    const updateTargets = () => {
      const rx = rotX * RAD;
      const front: HTMLButtonElement[] = [];
      const back: HTMLButtonElement[] = [];
      for (const c of cards) {
        // z of the card normal after rotateX(rotX) rotateY(rotY + lon) rotateX(lat)
        const lat = c.lat * RAD,
          lon = (c.lon + rotY) * RAD;
        const z = -Math.sin(lat) * Math.sin(rx) + Math.cos(lat) * Math.cos(lon) * Math.cos(rx);
        (z >= FACING ? front : back).push(c.btn);
      }
      // all layout reads first (after the transform is written), then all `inert` writes;
      // while animating, a margin keeps a card that is shrinking between two checks above 44 px
      const min = animate ? MIN_TARGET + 10 : MIN_TARGET;
      const small = front.map((btn) => {
        const r = btn.getBoundingClientRect();
        return r.width < min || r.height < min;
      });
      const keep = (btn: HTMLButtonElement) => btn === document.activeElement || btn === opener;
      for (const btn of back) btn.inert = !keep(btn);
      front.forEach((btn, i) => (btn.inert = small[i] && !keep(btn)));
    };

    const draw = () => {
      const p = progress();
      if (!dragging) {
        vel *= animate ? 0.95 : 0; // no inertia when not animating
        dragY += vel;
      }
      // slow auto-spin; it holds still while a card has keyboard focus or the demo modal is open
      const now = performance.now();
      const modal = dialogOpen();
      if (animate && !focused && !modal) drift += Math.min(now - last, 50) * 0.004;
      last = now;
      const target = p * 300 + dragY + drift;
      const turning = Math.abs(target - rotY) > 1.5; // fast turn (scroll jump, fling)
      rotY = animate ? rotY + (target - rotY) * 0.08 : target; // no easing when not animating
      const tx = -12 + p * 18 + dragX;
      rotX = animate ? rotX + (tx - rotX) * 0.08 : tx;
      const scale = 0.75 + Math.sin(p * Math.PI) * 0.35;
      b.style.transform = `translateZ(-200px) scale(${scale}) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      el.style.setProperty("--sp", p.toFixed(3));
      // hit-test sizes change slowly while drifting: every 4th frame then; every frame while
      // turning fast, and every drawn frame when not animating; frozen while the modal is open
      if (!modal && (!animate || turning || frame++ % 4 === 0)) updateTargets();
    };
    const tick = () => {
      draw();
      if (running) raf = requestAnimationFrame(tick);
    };
    // on-demand frame (low-end / reduced motion)
    const request = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };

    // animate only while the sphere is on screen and the tab is visible
    let inView = false;
    const sync = () => {
      running = animate && inView && !document.hidden;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(tick);
      else if (inView) request();
    };
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    const onScroll = () => inView && !animate && !reduce && request();
    const onResize = () => inView && !running && request();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize);

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
      if (!running) request();
    };
    const up = () => {
      dragging = false;
      if (!running && inView) request();
    };

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
      if (!running) request();
    };
    const onBlur = () => {
      focused = false;
      dragX = Math.max(-30, Math.min(30, dragX));
      if (!running) request();
    };

    // remember which card opens the modal (capture: before the card's onClick opens it)
    const onCardClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-lon]");
      if (btn && moved.current < 6) opener = btn;
    };
    // `close` does not bubble: listen in the capture phase. The browser has already returned
    // focus to the opener; refresh the targets once, then forget the opener
    const onDialogClose = () =>
      requestAnimationFrame(() => {
        if (dialogOpen()) return;
        updateTargets();
        opener = null;
        if (!running && inView) request();
      });

    const stage = el.querySelector<HTMLElement>("[data-stage]")!;
    stage.addEventListener("pointerdown", down);
    stage.addEventListener("click", onCardClick, true);
    stage.addEventListener("focusin", onFocus);
    stage.addEventListener("focusout", onBlur);
    document.addEventListener("close", onDialogClose, true);
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    draw(); // first pose + inert state before the sphere is ever on screen
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("click", onCardClick, true);
      document.removeEventListener("close", onDialogClose, true);
      stage.removeEventListener("focusin", onFocus);
      stage.removeEventListener("focusout", onBlur);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div ref={track} className={`relative ${className}`} style={{ "--sp": 0 } as CSSProperties}>
      <div
        data-stage
        className="@container relative mx-auto flex aspect-square w-full max-w-[min(100%,34rem,72dvh)] touch-pan-y items-center justify-center overflow-hidden select-none [perspective:1400px] xl:sticky xl:top-[max(6rem,calc(50dvh-15rem))] xl:max-w-full"
      >
        {/* soft halo so the globe reads as one object on both themes */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[8%] rounded-full opacity-60 blur-2xl"
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--violet) 22%, transparent), transparent 70%)" }}
        />
        {/* giant word behind the sphere */}
        <p
          aria-hidden
          className="display outline-text pointer-events-none absolute text-[clamp(3rem,26cqi,9rem)] opacity-30"
          style={{ transform: "translateX(calc((var(--sp) - 0.5) * -30cqi))" }}
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
                title={p.title}
                translate="no"
                onClick={() => moved.current < 6 && onOpen(p)}
                data-lon={lon}
                data-lat={lat}
                className="group notranslate absolute top-0 left-0 -mt-[clamp(25px,7.1cqi,46px)] -ml-[clamp(40px,11.5cqi,75px)] w-[clamp(80px,23cqi,150px)] [backface-visibility:hidden] focus-visible:outline-none"
                style={{ transform: `rotateY(${lon}deg) rotateX(${lat}deg) translateZ(clamp(120px, 36cqi, 240px))` }}
              >
                <span className="block overflow-hidden rounded-lg border border-line bg-bg-2 shadow-[var(--shadow)] transition-transform duration-300 group-hover:scale-110 group-focus-visible:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-rose group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg sm:rounded-xl">
                  {p.demoUrl ? (
                    // decorative: the button already shows (and is named by) the project title
                    // eslint-disable-next-line @next/next/no-img-element -- remote screenshot, tiny
                    <img src={shot(p.demoUrl, 400)} alt="" loading="lazy" decoding="async" className="aspect-[16/10] w-full object-cover object-top" />
                  ) : (
                    <span aria-hidden className="display grid aspect-[16/10] place-items-center text-3xl" style={{ background: "var(--grad)", color: "var(--bg)" }}>
                      {p.title.charAt(0)}
                    </span>
                  )}
                  <span className="block truncate px-2 py-1 text-left text-[11px] font-medium">{p.title}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="absolute bottom-2 px-4 text-center text-[11px] tracking-[0.2em] text-muted uppercase">{hint}</p>
      </div>
    </div>
  );
}
