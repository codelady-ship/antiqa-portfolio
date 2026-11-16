"use client";

import { useEffect, useRef, useState } from "react";
import type { Film } from "./config";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** playhead easing per frame towards the scroll's time (the guide's 0.16) */
const EASE = 0.16;
const SECTIONS = ["hero", "about", "work", "contact"] as const;
type Section = (typeof SECTIONS)[number];

/**
 * The scroll-scrubbed film of Antiqa (owner's "AI Character Portfolio" guide, 2026-11-16), used
 * instead of the photo traveller once PERSONA.film is set:
 *
 * - one <video> in a fixed stage BEHIND the page (-z-10 in the isolated track), every frame a
 *   keyframe, so setting currentTime is an instant seek;
 * - the scroll position sets a target time: on load the hero clip plays by itself up to
 *   marks.hero (she turns and waves), then each section HOLDS on its mark while it is read and
 *   the film plays on to the next mark on the way down (config.ts `hold`);
 * - the playhead follows the target with a lerp (EASE) and never seeks while a seek is running;
 * - the film is shifted sideways so the point where she stands (`focus`) sits where the section
 *   wants her (`place`): right in the hero, left in About, on the project belt in Projects;
 *   phones keep her centred;
 * - loading: after `load`, on idle, fetch → blob with a small progress pill; the poster shows
 *   until the first frame is decoded. iOS needs one play()/pause() from a gesture before it seeks
 *   a muted inline video: done on the first touch / click;
 * - edges are feathered into the page colour (CSS mask, globals.css "persona film"); in dark mode
 *   a soft spotlight around her instead, since the studio is cream;
 * - prefers-reduced-motion: nothing here runs; the static figures in the slots stay.
 *
 * While it runs `film-live` on <html> hides the static slot figures (and the contact stage when the
 * film has a contact mark), so she is never drawn twice.
 */
export function PersonaFilm({ film, loadingLabel }: { film: Film; loadingLabel: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    const el = root.current!;
    const track = el.parentElement!;
    const video = el.querySelector("video")!;
    const html = document.documentElement;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const wide = matchMedia("(min-width: 1024px)");
    if (reduce.matches) return;

    const fps = 24;
    const used = SECTIONS.filter((s) => film.marks[s] !== undefined);
    const hold = clamp(film.hold, 0, 0.9);
    let raf = 0,
      cur = 0,
      ready = false,
      introStart = 0,
      introDone = false,
      url = "",
      stopped = false;
    const abort = new AbortController();

    html.classList.add("film-live");
    if (film.marks.contact !== undefined) html.classList.add("film-contact");

    const docTop = (sel: string) => {
      const e = document.querySelector(sel);
      return e ? e.getBoundingClientRect().top + scrollY : null;
    };
    /** scroll y where she has reached each section's pose */
    const anchors = (): number[] => {
      const vh = innerHeight;
      const belt = document.querySelector(".ring-stage");
      const about = docTop('[data-persona="skills"]') ?? vh;
      const r = belt?.getBoundingClientRect();
      const work = r ? r.top + scrollY + r.height / 2 - vh / 2 : (docTop('[data-persona="work"]') ?? about + vh);
      const contact = docTop('[data-persona="contact"]');
      const raw: Record<Section, number> = { hero: 0, about: about - vh * 0.12, work, contact: (contact ?? work + vh) - vh * 0.2 };
      const out: number[] = [];
      for (const s of used) out.push(Math.max(out.at(-1) ?? 0, raw[s]) + (out.length ? 1 : 0));
      return out;
    };
    /** section position: 0 = hero, 1 = about … with fractions while she moves between them */
    const position = (y: number, P: number[]) => {
      for (let i = 0; i < P.length - 1; i++) {
        if (y >= P[i + 1]) continue;
        const f = clamp((y - P[i]) / (P[i + 1] - P[i]));
        return f < hold ? i : i + smooth((f - hold) / (1 - hold));
      }
      return P.length - 1;
    };
    const at = <T,>(rec: Partial<Record<Section, T>>, i: number, dflt: T): T => {
      for (let k = i; k >= 0; k--) {
        const v = rec[used[k]];
        if (v !== undefined) return v;
      }
      return dflt;
    };
    const markAt = (pos: number) => {
      const i = Math.floor(pos);
      const a = film.marks[used[i]] ?? 0,
        b = film.marks[used[Math.min(i + 1, used.length - 1)]] ?? a;
      return lerp(a, b, pos - i);
    };
    const placeX = (v: number | "belt") => {
      if (v !== "belt") return v;
      const stage = document.querySelector(".ring-stage [data-stage]") ?? document.querySelector(".ring-stage");
      if (!stage) return 0.5;
      const r = stage.getBoundingClientRect();
      return (r.left + r.width / 2) / innerWidth;
    };

    const frame = () => {
      raf = 0;
      if (stopped) return;
      const P = anchors();
      const pos = position(scrollY, P);
      // the intro: the hero clip plays in real time until marks.hero, unless she was scrolled on
      let target = markAt(pos);
      if (!introDone) {
        if (pos > 0) introDone = true;
        else if (!ready) target = 0; // the poster is the first frame
        else {
          if (!introStart) introStart = performance.now();
          const t = (performance.now() - introStart) / 1000;
          target = Math.min(film.marks.hero, t);
          if (t >= film.marks.hero) introDone = true;
        }
      }
      cur += (target - cur) * EASE;
      if (Math.abs(target - cur) < 0.002) cur = target;
      // seek guard: one seek at a time, and only when the frame would change
      if (ready && !video.seeking && Math.abs(video.currentTime - cur) > 1 / (fps * 2)) video.currentTime = clamp(cur, 0, film.duration - 0.01);

      // sideways: the point where she stands (focus) goes where this section wants her (place)
      const i = Math.floor(pos),
        e = pos - i,
        j = Math.min(i + 1, used.length - 1);
      const focus = lerp(at(film.focus, i, 0.5), at(film.focus, j, 0.5), e);
      const place = wide.matches ? lerp(placeX(at(film.place, i, 0.5)), placeX(at(film.place, j, 0.5)), e) : 0.5;
      const h = innerHeight,
        w = (h * film.width) / film.height;
      video.style.width = `${w}px`;
      video.style.transform = `translate3d(${(place * innerWidth - focus * w).toFixed(1)}px,0,0)`;
      el.style.setProperty("--fx", `${(focus * 100).toFixed(1)}%`);

      // without a contact mark she leaves with the project section
      if (film.marks.contact === undefined) {
        const bottom = track.getBoundingClientRect().bottom;
        el.style.opacity = clamp((bottom - h * 0.35) / (h * 0.4)).toFixed(3);
      }
      if (target !== cur || (ready && !introDone)) raf = requestAnimationFrame(frame);
    };
    const request = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    // iOS seeks a muted inline video only after a play() from a user gesture
    const unlock = () => {
      video.play().then(() => video.pause(), () => {});
      removeEventListener("touchstart", unlock);
      removeEventListener("pointerdown", unlock);
    };
    addEventListener("touchstart", unlock, { passive: true, once: true });
    addEventListener("pointerdown", unlock, { once: true });

    const onData = () => {
      ready = true;
      el.dataset.ready = "1";
      setProgress(null);
      request();
    };
    video.addEventListener("loadeddata", onData);

    // after the page has loaded, on idle: fetch → blob (progress), then the video
    const load = async () => {
      if (stopped) return;
      const src = wide.matches ? film.desktop : film.mobile;
      try {
        setProgress(0);
        const res = await fetch(src, { signal: abort.signal });
        if (!res.ok || !res.body) throw new Error(String(res.status));
        const size = Number(res.headers.get("content-length")) || 0;
        const reader = res.body.getReader();
        const parts: BlobPart[] = [];
        let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value);
          got += value.length;
          if (size) setProgress(Math.round((got / size) * 100));
        }
        url = URL.createObjectURL(new Blob(parts, { type: "video/mp4" }));
        video.src = url;
      } catch {
        if (stopped) return;
        video.src = src; // streaming still scrubs (all keyframes), just less smoothly
      }
      video.load();
    };
    const start = () => {
      if ("requestIdleCallback" in window) requestIdleCallback(() => void load(), { timeout: 2000 });
      else setTimeout(() => void load(), 500);
    };
    if (document.readyState === "complete") start();
    else addEventListener("load", start, { once: true });

    const ro = new ResizeObserver(request);
    ro.observe(track);
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    request();
    return () => {
      stopped = true;
      abort.abort();
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener("load", start);
      removeEventListener("scroll", request);
      removeEventListener("resize", request);
      removeEventListener("touchstart", unlock);
      removeEventListener("pointerdown", unlock);
      video.removeEventListener("loadeddata", onData);
      html.classList.remove("film-live", "film-contact");
      if (url) URL.revokeObjectURL(url);
    };
  }, [film]);

  return (
    <div ref={root} aria-hidden className="persona-film pointer-events-none fixed inset-0 -z-10 overflow-hidden motion-reduce:hidden">
      <video
        muted
        playsInline
        preload="none"
        poster={film.poster}
        width={film.width}
        height={film.height}
        className="absolute top-0 left-0 h-full max-w-none will-change-transform"
        style={{ aspectRatio: `${film.width}/${film.height}` }}
      />
      {progress !== null && (
        <p className="absolute right-4 bottom-4 rounded-full border border-line bg-surface/90 px-3 py-1 text-xs font-semibold text-muted tabular-nums shadow-[var(--shadow)]">
          {loadingLabel} {progress}%
        </p>
      )}
    </div>
  );
}
