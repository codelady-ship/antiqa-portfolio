"use client";

import { useEffect, useRef, useState } from "react";
import type { Clip, PointClip } from "./config";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

type Props = {
  clip: Clip | PointClip;
  /**
   * loop  — plays (from the start) each time she appears, then loops (hero, contact)
   * scrub — the scroll through `track` picks the time (About)
   * point — rests; holds on the "arm out" frame while `point` is set, mirrored for the other side (Projects)
   */
  mode: "loop" | "scrub" | "point";
  /** scrub: the element whose scroll-through drives the clip (CSS selector) */
  track?: string;
  /** point: the side of the hovered plate, null = rest */
  point?: "left" | "right" | null;
  className?: string;
};

/** true on screens ≥ 1024 px without reduced motion (followed live) */
function useMotionDesktop() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const wide = matchMedia("(min-width: 1024px)");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setOn(wide.matches && !reduce.matches);
    update();
    wide.addEventListener("change", update);
    reduce.addEventListener("change", update);
    return () => {
      wide.removeEventListener("change", update);
      reduce.removeEventListener("change", update);
    };
  }, []);
  return on;
}

/**
 * One of her section videos (owner, 2026-11-17: she does not travel any more, she appears in each
 * section). The server HTML has the poster (a still frame): that is also what shows without JS,
 * with reduced motion and on screens < 1024 px. On desktop the video takes over: it starts loading
 * when the box is near the viewport, and she fades / scales in each time the box comes into view.
 * Decorative (aria-hidden); the "AI-generated video" note is rendered by the parent.
 */
export function PersonaClip({ clip, mode, track, point = null, className = "" }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const on = useMotionDesktop();
  const [near, setNear] = useState(false);
  const [shown, setShown] = useState(false);
  // point mode reads the latest target from the rAF loop
  const want = useRef(point);
  const kick = useRef<() => void>(() => {});

  // near the viewport → load; in view → appear (again each time)
  useEffect(() => {
    if (!on) return;
    const el = box.current!;
    const load = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "800px 0px" });
    const see = new IntersectionObserver((es) => setShown(es[es.length - 1].isIntersecting), { threshold: 0.2 });
    load.observe(el);
    see.observe(el);
    return () => {
      load.disconnect();
      see.disconnect();
    };
  }, [on]);

  // loop: from the start each time she appears; paused while out of view
  useEffect(() => {
    const v = vid.current;
    if (!on || !near || mode !== "loop" || !v) return;
    if (shown) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else v.pause();
  }, [on, near, shown, mode]);

  // scrub: the scroll through the track (its top at 80 % of the viewport → its bottom at 60 %) is the clip
  useEffect(() => {
    const v = vid.current;
    const el = track ? document.querySelector<HTMLElement>(track) : null;
    if (!on || !near || mode !== "scrub" || !v || !el) return;
    let raf = 0;
    let cur = 0;
    const target = () => {
      const r = el.getBoundingClientRect();
      const p = clamp((innerHeight * 0.8 - r.top) / Math.max(1, r.height - innerHeight * 0.2));
      const d = Number.isFinite(v.duration) ? v.duration : 0;
      return p * Math.max(0, d - 0.05);
    };
    const step = () => {
      raf = 0;
      const t = target();
      cur += (t - cur) * 0.22; // eased, so a wheel notch is a movement, not a jump
      if (Math.abs(t - cur) < 0.01) cur = t;
      if (!v.seeking && Math.abs(v.currentTime - cur) > 0.001) v.currentTime = cur;
      if (cur !== t) raf = requestAnimationFrame(step);
    };
    const request = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    v.addEventListener("loadedmetadata", request);
    request();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", request);
      removeEventListener("resize", request);
      v.removeEventListener("loadedmetadata", request);
    };
  }, [on, near, mode, track]);

  // point: real-time forwards to `hold`, backwards to `rest`; switching sides goes back to rest,
  // flips (mirror), then raises the arm again
  useEffect(() => {
    const v = vid.current;
    if (!on || !near || mode !== "point" || !v || !("hold" in clip)) return;
    const { rest, hold, faces } = clip;
    let raf = 0;
    let last = 0;
    let t = rest;
    let flip = false;
    const settle = () => {
      if (!v.seeking && Math.abs(v.currentTime - t) > 0.001) v.currentTime = t;
      v.style.transform = flip ? "scaleX(-1)" : "";
    };
    const step = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const side = want.current;
      const wantFlip = side ? side !== faces : flip;
      // at rest the two sides look the same: flip there
      if (wantFlip !== flip && t - rest < 0.02) flip = wantFlip;
      const goal = side && wantFlip === flip ? hold : rest;
      const speed = goal === hold ? 1.15 : 1.6;
      t = goal > t ? Math.min(goal, t + dt * speed) : Math.max(goal, t - dt * speed);
      settle();
      if (t !== goal || wantFlip !== flip) raf = requestAnimationFrame(step);
      else {
        raf = 0;
        last = 0;
      }
    };
    kick.current = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };
    const ready = () => settle();
    v.addEventListener("loadeddata", ready);
    if (v.readyState >= 2) ready();
    kick.current();
    return () => {
      cancelAnimationFrame(raf);
      kick.current = () => {};
      v.removeEventListener("loadeddata", ready);
    };
  }, [on, near, mode, clip]);

  useEffect(() => {
    want.current = point;
    kick.current();
  }, [point]);

  return (
    <div
      ref={box}
      aria-hidden
      data-state={on ? (shown ? "in" : "out") : undefined}
      data-mode={mode}
      className={`persona-clip relative ${className}`}
      style={{ aspectRatio: `${clip.width} / ${clip.height}` }}
    >
      {on ? (
        <video
          ref={vid}
          muted
          playsInline
          disablePictureInPicture
          loop={mode === "loop"}
          preload={near ? "auto" : "none"}
          src={near ? clip.src : undefined}
          poster={clip.poster}
          width={clip.width}
          height={clip.height}
          className="absolute inset-0 size-full object-contain"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a still frame of the video, same box
        <img src={clip.poster} alt="" width={clip.width} height={clip.height} loading="lazy" decoding="async" className="absolute inset-0 size-full object-contain" />
      )}
    </div>
  );
}
