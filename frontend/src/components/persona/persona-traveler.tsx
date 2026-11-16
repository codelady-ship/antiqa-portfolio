"use client";

import { useEffect, useRef } from "react";
import { PERSONA } from "./config";
import { PersonaFigure } from "./figure";
import { PersonaExtras } from "./slot";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Box = { x: number; y: number; w: number };
const mix = (a: Box, b: Box, t: number): Box => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t) });

/**
 * The figure that travels down the page (owner, 2026-11-16: "scroll etdikcə aşağı düşür,
 * haqqımda hissədə 2-ci formada dayanır, sonra layihələrə düşür, orda ayaq üstə dayanır").
 *
 * Three landing boxes (`data-persona-slot`): beside the hero, beside the About text (CSS-sticky
 * there, so she stays in view while it is read) and the middle of the project ring. Each frame
 * the figure is placed on a blend of those boxes driven by the scroll position itself (see draw):
 * she starts to move on the first pixel of scroll and "falls" from one box to the next, tilting
 * and looking down on the way.
 *
 * Poses: hero → idle, falling → down, About → left ("pose 2", turned towards the text),
 * projects → idle (standing). Real pose images come from PERSONA.poses; without them her photo
 * leans the same way (CSS, globals.css "persona travel").
 *
 * Hand-off: while she rests exactly on a slot (`data-landed` on the track) the slot's own static
 * figure is shown and this one is hidden, so the ring's figure (and its hover poses) takes over
 * in the project section and the cards stay above her.
 *
 * Runs only ≥ 1024 px without prefers-reduced-motion. Otherwise nothing moves: the static figure
 * in each slot stays (the class `persona-live` on the track hides those while this one runs).
 * The layer is absolutely positioned and pointer-events:none: no layout shift, no clicks taken.
 */
export function PersonaTraveler({ heroBubble, aboutBubble, chips }: { heroBubble: string; aboutBubble: string; chips: string[] }) {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = layer.current!;
    const track = el.parentElement!;
    const fig = el.querySelector<HTMLElement>("[data-traveler]")!;
    const tilt = el.querySelector<HTMLElement>("[data-tilt]")!;
    const parts = [...el.querySelectorAll<HTMLElement>("[data-for]")];
    const wide = matchMedia("(min-width: 1024px)");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const q = (sel: string) => track.querySelector<HTMLElement>(sel);
    let raf = 0;

    // document y of an element's top (sections are not sticky, so this is stable)
    const docTop = (e: Element) => e.getBoundingClientRect().top + scrollY;

    const draw = () => {
      raf = 0;
      const slots = [q('[data-persona-slot="hero"]'), q('[data-persona-slot="about"]'), q('[data-persona-slot="work"]')];
      const about = q('[data-persona="skills"]'),
        work = q('[data-persona="work"]'),
        ring = q(".ring-stage");
      if (slots.some((s) => !s) || !about || !work || !ring) return;
      const t = track.getBoundingClientRect();
      const [h, a, w] = slots.map((s) => {
        const r = s!.getBoundingClientRect();
        return { x: r.left - t.left, y: r.top - t.top, w: r.width };
      });

      // scroll-linked from the very first pixel (owner, 2026-11-16 #2: "scroll etdikcə hərəkət etsin"):
      //   0 … B   she travels from the hero to the About column (B: About's top near the top of the screen)
      //   B … C   she stands in About, pose 2, while it is read (the slot is sticky)
      //   C … D   she travels down into the ring (C: Projects enters from below, D: the ring is centred)
      const vh = innerHeight,
        y = scrollY;
      const B = Math.max(1, docTop(about) - vh * 0.12);
      const C = Math.max(B, docTop(work) - vh * 0.9);
      const ringR = ring.getBoundingClientRect();
      const D = Math.max(C + 1, ringR.top + y + ringR.height / 2 - vh / 2);
      // mostly ease-in-out, with a linear share so she visibly moves on the first scroll
      const ease = (v: number) => 0.35 * v + 0.65 * smooth(v);
      // snap the last half pixel (scroll positions are rounded), so she always lands
      const snap = (v: number) => (v > 0.995 ? 1 : v < 0.005 ? 0 : v);
      const t1 = snap(clamp(y / B)),
        t2 = snap(clamp((y - C) / (D - C)));
      const p = mix(mix(h, a, ease(t1)), w, ease(t2));
      const fall = Math.max(Math.sin(t1 * Math.PI) * (1 - t2), Math.sin(t2 * Math.PI)); // 0 resting … 1 mid-air

      fig.style.width = `${p.w}px`;
      fig.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      tilt.style.transform = `rotate(${(fall * -8).toFixed(2)}deg)`;
      fig.dataset.pose = fall > 0.35 ? "down" : t1 > 0.5 && t2 < 0.5 ? "left" : "idle";
      // the last part of the way into the ring: she fades out above the cards, then the ring's own
      // figure (which sits below the cards) drops into the centre. One after the other, so there is
      // never a double figure and she never covers the top cards while landing.
      const ringIn = clamp((t2 - 0.6) / 0.4);
      track.style.setProperty("--ring-in", smooth(ringIn).toFixed(3));
      fig.style.opacity = (1 - clamp((t2 - 0.38) / 0.22)).toFixed(3);
      const landed = t2 === 1 ? "work" : y <= 0 ? "hero" : t1 === 1 && t2 === 0 ? "about" : "";
      if (landed) track.dataset.landed = landed;
      else delete track.dataset.landed;

      // bubbles / chips: only while she stands in their section
      const weight = { hero: 1 - t1 / 0.15, about: (t1 - 0.85) / 0.15 - t2 / 0.15 } as Record<string, number>;
      for (const part of parts) {
        const v = clamp(weight[part.dataset.for!] ?? 0);
        part.style.opacity = v.toFixed(3);
        part.style.visibility = v < 0.02 ? "hidden" : "";
      }
    };
    const request = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    let live = false;
    const sync = () => {
      const on = wide.matches && !reduce.matches;
      if (on === live) return;
      live = on;
      if (on) {
        draw(); // position first, then reveal (no jump)
        track.classList.add("persona-live");
        addEventListener("scroll", request, { passive: true });
        addEventListener("resize", request);
      } else {
        track.classList.remove("persona-live");
        delete track.dataset.landed;
        removeEventListener("scroll", request);
        removeEventListener("resize", request);
      }
    };
    // layout changes that move the boxes without a scroll (fonts, images, filters re-laying the ring)
    const ro = new ResizeObserver(request);
    ro.observe(track);
    sync();
    wide.addEventListener("change", sync);
    reduce.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wide.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
      track.classList.remove("persona-live");
      delete track.dataset.landed;
      track.style.removeProperty("--ring-in");
      removeEventListener("scroll", request);
      removeEventListener("resize", request);
    };
  }, []);

  const poses = PERSONA.poses;
  return (
    <div ref={layer} aria-hidden className="persona-layer pointer-events-none absolute inset-0 z-30 hidden overflow-x-clip">
      <div data-traveler data-pose="idle" className="persona-traveler absolute top-0 left-0 aspect-[677/800] will-change-transform">
        <div data-tilt className="size-full origin-bottom">
          <div className="ring-figure size-full">
            <PersonaFigure alt="" sizes="(min-width: 1536px) 384px, 336px" src={poses.idle} className="size-full" />
            {(["up", "down", "left", "right"] as const).map(
              (k) =>
                poses[k] && (
                  // eslint-disable-next-line @next/next/no-img-element -- static pose file
                  <img key={k} src={poses[k]} alt="" data-pose-img={k} loading="lazy" decoding="async" className="absolute inset-0 size-full object-contain object-bottom opacity-0" />
                ),
            )}
          </div>
        </div>
        <div data-for="hero" className="absolute inset-0">
          <PersonaExtras bubble={heroBubble} wave />
        </div>
        <div data-for="about" className="absolute inset-0" style={{ opacity: 0, visibility: "hidden" }}>
          <PersonaExtras bubble={aboutBubble} chips={chips} />
        </div>
      </div>
    </div>
  );
}
