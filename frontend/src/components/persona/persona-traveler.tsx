"use client";

import { useEffect, useRef } from "react";
import { PERSONA } from "./config";
import { PersonaFigure } from "./figure";
import { loadFrame, nearestLoaded, preload } from "./frames";
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
 * Layout (owner, 2026-11-16 #3): hero → she is on the right; About → on the left, the text on
 * the right; Projects → in the middle of the ring, standing.
 *
 * What is drawn, best first:
 * 1. a frame sequence (PERSONA.frames, e.g. a Google Flow video cut by scripts/persona-frames.mjs)
 *    scrubbed on a canvas by the scroll: frames 1 … ABOUT_AT·count while she travels from the
 *    hero to About (the wave, the turn), the rest while she travels down into the ring;
 * 2. pose stills (PERSONA.poses): hero → idle, falling → down, About → right (turned towards
 *    the text), projects → idle;
 * 3. her photo, leaning the same way (CSS, globals.css "persona travel").
 *
 * Hand-off: while she rests exactly on a slot (`data-landed` on the track) the slot's own static
 * figure is shown and this one is hidden, so the ring's figure (and its hover poses) takes over
 * in the project section and the cards stay above her.
 *
 * Runs only ≥ 1024 px without prefers-reduced-motion. Otherwise nothing moves: the static figure
 * in each slot stays (the class `persona-live` on the track hides those while this one runs).
 * The layer is absolutely positioned and pointer-events:none: no layout shift, no clicks taken.
 * It sits BELOW the page content (z-index -10 inside the isolated track, review #41/#42): she stays
 * fully visible while she travels, and headings, text, buttons, chips and cards always paint on
 * top of her, readable and clickable (text gets a soft halo in the page colour, globals.css).
 */
/** share of the frame sequence used between the hero and About (the rest: About → the ring) */
const ABOUT_AT = 0.45;
/** how much of her own way down (px of document) a sideways crossing takes */
const CROSS = 420;

export function PersonaTraveler({ heroBubble, aboutBubble }: { heroBubble: string; aboutBubble: string }) {
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
    const canvas = el.querySelector<HTMLCanvasElement>("canvas");
    const seq = PERSONA.frames;
    let raf = 0,
      lastFrame = -1,
      framesOn = false,
      stopped = false;

    const drawFrame = (n: number) => {
      if (!seq || !canvas || n === lastFrame) return;
      const img = nearestLoaded(n, 1, seq.count);
      if (!img) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      lastFrame = n;
      if (!framesOn) {
        framesOn = true;
        fig.dataset.frames = "1"; // hides the photo / pose images under the canvas (CSS)
      }
    };

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
      // sideways moves happen while her middle passes the empty band between two sections
      // (hero → About: above the About kicker; About → ring: above the Projects kicker), so she
      // falls straight down in her own column before and after, and crosses mostly empty space
      const mid = t.top + scrollY + p.y + (p.w * 800) / 677 / 2; // her centre, document y
      const cross = (gapY: number) => smooth(clamp((mid - gapY + CROSS / 2) / CROSS));
      const c1 = Math.max(cross(docTop(about) + 30), smooth(clamp((t1 - 0.85) / 0.15)));
      const c2 = t2 > 0 ? Math.max(cross(docTop(work) + 20), smooth(clamp((t2 - 0.85) / 0.15))) : 0;
      p.x = lerp(lerp(h.x, a.x, c1), w.x, c2);
      const fall = Math.max(Math.sin(t1 * Math.PI) * (1 - t2), Math.sin(t2 * Math.PI)); // 0 resting … 1 mid-air

      fig.style.width = `${p.w}px`;
      fig.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      // a video sequence moves by itself: no tilt and no pose swap on top of it
      tilt.style.transform = framesOn ? "" : `rotate(${(fall * -8).toFixed(2)}deg)`;
      fig.dataset.pose = framesOn ? "idle" : fall > 0.35 ? "down" : t1 > 0.5 && t2 < 0.5 ? "right" : "idle";
      if (seq) drawFrame(1 + Math.round((t1 * ABOUT_AT + t2 * (1 - ABOUT_AT)) * (seq.count - 1)));
      // the last part of the way into the ring: she fades out above the cards, then the ring's own
      // figure (which sits below the cards) drops into the centre. One after the other, so there is
      // never a double figure and she never covers the top cards while landing.
      const ringIn = clamp((t2 - 0.6) / 0.4);
      track.style.setProperty("--ring-in", smooth(ringIn).toFixed(3));
      fig.style.opacity = (1 - clamp((t2 - 0.38) / 0.22)).toFixed(3);
      // with frames she stays the canvas in the hero and About (the stills there are not frames)
      const landed = t2 === 1 ? "work" : framesOn ? "" : y <= 0 ? "hero" : t1 === 1 && t2 === 0 ? "about" : "";
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
        if (document.readyState === "complete") startFrames();
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
    // frames: after `load`, on idle, coarse to fine, only while the traveller runs
    const startFrames = () => {
      if (!seq || !canvas || stopped || !live) return;
      canvas.width = seq.width;
      canvas.height = seq.height;
      const go = () => {
        loadFrame(1).decode().then(request, () => {});
        preload(1, seq.count, () => stopped).then(() => {
          lastFrame = -1;
          request();
        });
      };
      if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 2500 });
      else setTimeout(go, 600);
    };
    if (document.readyState === "complete") startFrames();
    else addEventListener("load", startFrames, { once: true });

    // layout changes that move the boxes without a scroll (fonts, images, filters re-laying the ring)
    const ro = new ResizeObserver(request);
    ro.observe(track);
    sync();
    wide.addEventListener("change", sync);
    reduce.addEventListener("change", sync);
    return () => {
      stopped = true;
      removeEventListener("load", startFrames);
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
    <div ref={layer} aria-hidden className="persona-layer pointer-events-none absolute inset-0 -z-10 hidden overflow-x-clip">
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
            {PERSONA.frames && <canvas className="persona-canvas absolute inset-0 size-full object-contain object-bottom" />}
          </div>
        </div>
        <div data-for="hero" className="absolute inset-0">
          <PersonaExtras bubble={heroBubble} wave />
        </div>
        <div data-for="about" className="absolute inset-0" style={{ opacity: 0, visibility: "hidden" }}>
          <PersonaExtras bubble={aboutBubble} />
        </div>
      </div>
    </div>
  );
}
