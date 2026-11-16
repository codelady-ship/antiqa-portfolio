"use client";

import { useEffect, useRef } from "react";
import { PERSONA, type Pose } from "./config";
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
 * the figure is placed on a blend of those boxes: while a section boundary passes the middle of
 * the viewport (a window of 0.6 × the viewport height) she "falls" from one box to the next,
 * tilting and looking down on the way.
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

    const draw = () => {
      raf = 0;
      const slots = [q('[data-persona-slot="hero"]'), q('[data-persona-slot="about"]'), q('[data-persona-slot="work"]')];
      const about = q('[data-persona="skills"]'),
        work = q('[data-persona="work"]');
      if (slots.some((s) => !s) || !about || !work) return;
      const t = track.getBoundingClientRect();
      const [h, a, w] = slots.map((s) => {
        const r = s!.getBoundingClientRect();
        return { x: r.left - t.left, y: r.top - t.top, w: r.width };
      });

      // 0 → 1 while a section's top passes the middle of the viewport
      const mid = innerHeight * 0.55,
        win = innerHeight * 0.6;
      const w1 = smooth(clamp((mid - about.getBoundingClientRect().top + win / 2) / win));
      const w2 = smooth(clamp((mid - work.getBoundingClientRect().top + win / 2) / win));
      const p = mix(mix(h, a, w1), w, w2);
      const fall = Math.max(Math.sin(w1 * Math.PI) * (1 - w2), Math.sin(w2 * Math.PI)); // 0 resting … 1 mid-air

      fig.style.width = `${p.w}px`;
      fig.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      tilt.style.transform = `rotate(${(fall * -8).toFixed(2)}deg)`;
      const pose: Pose = fall > 0.6 ? "down" : w1 > 0.5 && w2 < 0.5 ? "left" : "idle";
      fig.dataset.pose = pose;
      const landed = w2 === 1 ? "work" : w1 === 0 ? "hero" : w1 === 1 && w2 === 0 ? "about" : "";
      if (landed) track.dataset.landed = landed;
      else delete track.dataset.landed;

      // bubbles / chips: only while resting in their section
      const weight = { hero: (1 - w1) * (1 - fall), about: w1 * (1 - w2) * (1 - fall) } as Record<string, number>;
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
