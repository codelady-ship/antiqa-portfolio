"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { Chapter } from "./config";
import { PersonaFigure, WaveHand } from "./figure";

type Props = {
  /** the chapters (data-persona sections inside the same parent) this stage plays through */
  chapters: Exclude<Chapter, "work">[];
  /** speech bubble per chapter */
  bubbles: Partial<Record<Chapter, string>>;
  /** tech names that float around her in the skills chapter */
  chips?: string[];
  alt: string;
};

// placeholder poses: where the figure leans in each chapter (% of its box, degrees, scale)
const POSE: Record<Exclude<Chapter, "work">, { x: number; y: number; r: number; s: number }> = {
  hero: { x: 0, y: 0, r: 0, s: 1 },
  skills: { x: -6, y: 3, r: -3, s: 0.94 },
  contact: { x: 3, y: 0, r: 2.5, s: 1 },
};
const CHIP_SPOTS = ["-left-[18%] top-[14%]", "-right-[16%] top-[26%]", "-left-[22%] top-[52%]", "-right-[20%] top-[62%]", "left-[4%] -bottom-[4%]", "-left-[6%] -top-[6%]"];
const CHIP_TINTS = ["bg-pink-soft", "bg-lilac-soft", "bg-mint-soft", "bg-peach-soft", "bg-butter-soft", "bg-pink-soft"];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;


/**
 * Sticky stage beside the text (desktop, ≥ 1024 px): the figure plays through its chapters as
 * they scroll past. The chapter under the middle of the viewport sets the pose; the last 40 % of a
 * chapter blends into the next one: the photo leans/scales and per-chapter props fade in. When the
 * film (PERSONA.film) has a contact mark, the film plays this chapter and this stage is hidden (CSS).
 *
 * - phones/tablets: the stage is display:none and nothing here runs or loads;
 * - prefers-reduced-motion: a static pose (the first chapter), no scroll listener;
 * - the stage box has a fixed size (sticky, 100svh): no layout shift.
 */
export function PersonaStage({ chapters, bubbles, chips = [], alt }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current!;
    const group = el.parentElement!;
    const wide = matchMedia("(min-width: 1024px)");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const secs = chapters.map((c) => group.querySelector<HTMLElement>(`[data-persona="${c}"]`)).filter((x): x is HTMLElement => !!x);
    const fig = el.querySelector<HTMLElement>("[data-fig]")!;
    const props = [...el.querySelectorAll<HTMLElement>("[data-for]")];
    let raf = 0;

    const show = (k: number) =>
      props.forEach((p) => {
        const w = clamp(1 - Math.abs(k - Number(p.dataset.for)) * 1.6);
        p.style.opacity = w.toFixed(3);
        p.style.setProperty("--w", w.toFixed(3));
        p.style.visibility = w < 0.02 ? "hidden" : "";
      });

    if (reduce || !secs.length) {
      show(0);
      return;
    }

    // chapter index + progress through it, measured at the middle of the viewport
    const where = () => {
      const a = innerHeight * 0.5;
      let i = 0;
      for (let j = 0; j < secs.length; j++) if (secs[j].getBoundingClientRect().top <= a) i = j;
      const r = secs[i].getBoundingClientRect();
      return { i, frac: clamp((a - r.top) / Math.max(1, r.height)) };
    };

    const draw = () => {
      raf = 0;
      if (!wide.matches) return;
      const { i, frac } = where();
      const last = i === secs.length - 1;
      const e = last ? 0 : smooth(clamp((frac - 0.6) / 0.4));
      const a = POSE[chapters[i]],
        b = POSE[chapters[Math.min(i + 1, chapters.length - 1)]];
      const sway = Math.sin(frac * Math.PI) * 1.5; // a slight lean while a chapter scrolls by
      fig.style.transform = `translate(${lerp(a.x, b.x, e)}%, ${lerp(a.y, b.y, e)}%) rotate(${lerp(a.r, b.r, e) + sway}deg) scale(${lerp(a.s, b.s, e)})`;
      show(i + e);
    };
    const request = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    wide.addEventListener("change", request);
    draw();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", request);
      removeEventListener("resize", request);
      wide.removeEventListener("change", request);
    };
  }, [chapters]);

  return (
    <div ref={root} className="persona-stage relative hidden lg:block">
      <div className="sticky top-0 flex h-svh items-center justify-center px-6 pt-16">
        {/* soft paper shapes behind her */}
        <div aria-hidden className="pointer-events-none absolute top-[18%] right-[6%] size-[62%] max-w-[26rem] rounded-full bg-peach-soft opacity-80" />
        <div aria-hidden className="pointer-events-none absolute bottom-[12%] left-[8%] size-24 rotate-12 rounded-[1.75rem] bg-lilac-soft" />

        <div className="relative w-[min(78%,21rem)] 2xl:w-[min(78%,24rem)]">
          <PersonaFigure alt={alt} sizes="(min-width: 1536px) 384px, 336px" eager className="persona-placeholder transition-none" />

          {chapters.map((c, k) => (
            <div key={c} data-for={k} aria-hidden className="pointer-events-none absolute inset-0" style={{ opacity: k === 0 ? 1 : 0 } as CSSProperties}>
              {bubbles[c] && (
                <p className="persona-bubble hand absolute top-[6%] -right-[8%] max-w-[12rem] -rotate-3 rounded-[1.4rem] border-2 border-ink bg-surface px-4 py-2.5 text-[1.35rem] leading-tight text-ink shadow-[4px_4px_0_var(--ink)]">
                  {bubbles[c]}
                </p>
              )}
              {(c === "hero" || c === "contact") && <WaveHand className="absolute top-[34%] -left-[10%] size-16" />}
              {c === "skills" && (
                <ul translate="no" lang="en" className="notranslate">
                  {chips.slice(0, 6).map((s, i) => (
                    <li
                      key={s}
                      className={`absolute rounded-full border border-line px-3 py-1 text-[0.8125rem] font-semibold whitespace-nowrap shadow-[var(--shadow)] ${CHIP_SPOTS[i]} ${CHIP_TINTS[i]}`}
                      style={{ transform: `translateY(calc((1 - var(--w, 1)) * ${i % 2 ? 24 : -24}px)) rotate(${[-6, 5, -3, 4, -2, 6][i]}deg)` }}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
