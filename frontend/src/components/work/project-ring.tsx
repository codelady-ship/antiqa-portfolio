"use client";

import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PERSONA, type Pose } from "@/components/persona/config";
import { PersonaFigure, PointHand } from "@/components/persona/figure";
import { hasThumb } from "@/lib/seed";
import { shot } from "@/lib/shot";
import type { Project } from "@/lib/types";

type Props = {
  projects: Project[];
  locale: "az" | "en";
  onOpen: (p: Project) => void;
  alt: string;
};

const TWEEN = 700; // ms, filter re-layout
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

/** 1–2 sentences for the speech bubble (≤ 180 chars). */
export function blurb(p: Project, locale: "az" | "en") {
  const text = (p.summary?.[locale] || p.description || "").trim();
  if (!text) return "";
  // a sentence ends at . ! ? followed by a space and a capital letter (not inside "Next.js" or "3.5")
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-ZƏÖÜÇŞİĞ“"(])/u);
  let out = sentences[0].trim();
  if (sentences[1] && out.length + sentences[1].length <= 180) out += ` ${sentences[1].trim()}`;
  return out.length > 180 ? `${out.slice(0, 177).trimEnd()}…` : out;
}

function poseFor(deg: number): Exclude<Pose, "idle"> {
  const x = Math.cos((deg * Math.PI) / 180),
    y = Math.sin((deg * Math.PI) / 180);
  return Math.abs(x) >= Math.abs(y) ? (x > 0 ? "right" : "left") : y > 0 ? "down" : "up";
}

/** A small card: screenshot (or a pastel initial) and the title. Shared by the ring and the phone grid. */
function Thumb({ p, featured }: { p: Project; featured: boolean }) {
  const t = useTranslations("Work");
  return (
    <span
      className={`block overflow-hidden rounded-xl bg-surface shadow-[var(--shadow)] transition-transform duration-300 group-hover:scale-[1.08] group-focus-visible:scale-[1.08] group-data-[active]:scale-[1.08] motion-reduce:!scale-100 ${
        featured ? "border-2 border-ink" : "border border-line"
      }`}
    >
      <span className="relative block aspect-[16/10] bg-bg-2">
        {p.demoUrl && hasThumb(p.repoUrl) ? (
          // decorative: the button is named by the title below
          // eslint-disable-next-line @next/next/no-img-element -- remote screenshot, tiny
          <img src={shot(p.demoUrl, 400)} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover object-top" />
        ) : (
          <span aria-hidden className="display absolute inset-0 grid place-items-center bg-pink-soft text-3xl font-bold text-rose">
            {p.title.charAt(0)}
          </span>
        )}
        {p.comingSoon && (
          <span className="absolute top-1 left-1 rounded-full bg-butter-soft px-1.5 py-px text-[10px] font-bold text-ink">{t("comingSoon")}</span>
        )}
      </span>
      <span translate="no" className="notranslate block truncate px-2 py-1 text-left text-[11px] font-semibold sm:text-xs">
        {p.title}
      </span>
    </span>
  );
}

/** What she says about the active project (or an invitation when none is active). */
function Bubble({
  p,
  locale,
  idle,
  onOpen,
  touch,
  id,
  compact = false,
}: {
  p: Project | null;
  locale: "az" | "en";
  idle: string;
  onOpen: (p: Project) => void;
  touch: boolean;
  id?: string;
  /** phones: two lines of text and the open button beside them, so the sticky bar stays short */
  compact?: boolean;
}) {
  const t = useTranslations("Work");
  return (
    <div id={id} aria-live="polite" className={`min-w-0 flex-1 text-sm leading-snug ${compact && p ? "flex items-center gap-3" : ""}`}>
      {p ? (
        <>
          <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong translate="no" className="notranslate display text-base">
              {p.title}
            </strong>
            <span className={`rounded-full px-2 py-px text-[11px] font-semibold ${p.comingSoon ? "bg-butter-soft" : p.demoUrl ? "bg-mint-soft" : "bg-lilac-soft"}`}>
              {p.comingSoon ? t("comingSoon") : p.demoUrl ? t("live") : t("code")}
            </span>
          </p>
          <p className={`mt-1 text-muted ${compact ? "line-clamp-2" : "@max-4xl:line-clamp-4"}`}>{blurb(p, locale)}</p>
          </div>
          {touch && (
            <button
              type="button"
              onClick={() => onOpen(p)}
              className={`min-h-11 shrink-0 rounded-full border-2 border-ink bg-accent text-sm font-semibold text-on-accent ${compact ? "min-w-11 px-3" : "mt-2 px-4"}`}
            >
              {compact ? <span aria-hidden>→</span> : <>{t("openProject")} →</>}
              {compact && <span className="sr-only">{t("openProject")}: {p.title}</span>}
            </button>
          )}
        </>
      ) : (
        <p className="hand text-lg text-ink">{idle}</p>
      )}
    </div>
  );
}

/**
 * Projects around her (#38): small cards on an ellipse with the figure in the middle. Scroll or
 * drag turns the ring; hovering/focusing a card makes her lean and point towards it and say a
 * line about it in a speech bubble; a click opens the demo modal. On touch the first tap picks a
 * card (she talks about it), the second tap — or the bubble button — opens it.
 *
 * Filters re-lay the ring: every card glides (700 ms) to its new slot. Phones (< 768 px) get a
 * plain two-column grid with a small sticky figure + bubble instead of the ring.
 * prefers-reduced-motion: the ring does not turn and she does not move (the bubble still works).
 */
export function ProjectRing({ projects, locale, onOpen, alt }: Props) {
  const t = useTranslations("Work");
  const stage = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Project | null>(null);
  const [touch, setTouch] = useState(false);
  const activeId = useRef<string | null>(null);
  const pointer = useRef<string>("mouse");
  const moved = useRef(0);
  const api = useRef<{ aim: (id: string | null) => void; relayout: () => void } | null>(null);

  const ids = projects.map((p) => p.id).join("|");

  // the ring engine: positions are written straight to the DOM (no React render per frame)
  useEffect(() => {
    const el = stage.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0,
      H = 0,
      rot = 0,
      vel = 0,
      raf = 0,
      dragging = false,
      lx = 0,
      lastY = scrollY,
      inView = false;
    const base = new Map<string, { from: number; to: number; t0: number }>();

    const cards = () => [...el.querySelectorAll<HTMLElement>("[data-ring-id]")];
    const angleOf = (id: string, now: number) => {
      const b = base.get(id);
      if (!b) return 0;
      const k = reduce ? 1 : Math.min(1, (now - b.t0) / TWEEN);
      return b.from + wrap(b.to - b.from) * ease(k);
    };

    const draw = () => {
      raf = 0;
      if (!W) return;
      const now = performance.now();
      if (!dragging && !reduce) {
        vel *= 0.92;
        if (Math.abs(vel) < 0.01) vel = 0;
        if (!activeId.current) rot += vel;
      }
      const rx = W * 0.43,
        ry = H * 0.41,
        cx = W / 2,
        cy = H / 2;
      let busy = vel !== 0;
      for (const c of cards()) {
        const id = c.dataset.ringId!;
        const b = base.get(id);
        if (b && now - b.t0 < TWEEN && !reduce) busy = true;
        const deg = angleOf(id, now) + rot - 90;
        const r = (deg * Math.PI) / 180;
        const depth = (Math.sin(r) + 1) / 2; // 0 top (far) … 1 bottom (near)
        const s = 0.84 + depth * 0.2;
        c.style.transform = `translate(${cx + rx * Math.cos(r) - c.offsetWidth / 2}px, ${cy + ry * Math.sin(r) - c.offsetHeight / 2}px) scale(${s.toFixed(3)})`;
        c.style.zIndex = String(10 + Math.round(depth * 20));
        c.dataset.deg = String(deg);
      }
      if (busy) raf = requestAnimationFrame(draw);
    };
    const request = () => {
      if (!raf && inView) raf = requestAnimationFrame(draw);
    };

    // filter changed: new cards appear in their slot, the others glide to theirs
    const relayout = () => {
      const list = cards();
      const now = performance.now();
      const keep = new Set<string>();
      list.forEach((c, i) => {
        const id = c.dataset.ringId!;
        keep.add(id);
        const to = (i / list.length) * 360;
        const b = base.get(id);
        base.set(id, b ? { from: angleOf(id, now), to, t0: now } : { from: to, to, t0: now - TWEEN });
      });
      for (const id of base.keys()) if (!keep.has(id)) base.delete(id);
      request();
    };

    // she looks/points at a card (or back at the visitor)
    const aim = (id: string | null) => {
      activeId.current = id;
      const c = id ? el.querySelector<HTMLElement>(`[data-ring-id="${CSS.escape(id)}"]`) : null;
      const deg = c ? Number(c.dataset.deg) : 0;
      el.dataset.pose = c ? poseFor(deg) : "idle";
      el.style.setProperty("--aim", `${deg}deg`);
      if (c) vel = 0;
    };
    api.current = { aim, relayout };

    const ro = new ResizeObserver(() => {
      W = el.clientWidth;
      H = el.clientHeight;
      if (inView) draw();
    });
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      lastY = scrollY;
      if (inView) request();
    });
    io.observe(el);

    // scrolling past turns the ring a little (a flick of the wheel = a few degrees)
    const onScroll = () => {
      const dy = scrollY - lastY;
      lastY = scrollY;
      if (!inView || reduce || activeId.current || el.offsetParent === null) return;
      rot += dy * 0.06;
      request();
    };
    const down = (e: PointerEvent) => {
      pointer.current = e.pointerType;
      moved.current = 0;
      if (reduce) return;
      dragging = true;
      lx = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx;
      lx = e.clientX;
      moved.current += Math.abs(dx);
      if (moved.current < 6) return;
      if (activeId.current) aim(null);
      rot += dx * 0.3;
      vel = dx * 0.3;
      request();
    };
    const up = () => {
      dragging = false;
      request();
    };

    relayout();
    addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", down);
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", down);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      api.current = null;
    };
  }, []);

  // after React adds/removes cards for a filter, glide them to the new slots
  useLayoutEffect(() => {
    api.current?.relayout();
  }, [ids]);

  // the active card was filtered away: she looks back at the visitor
  const shownActive = active && projects.some((p) => p.id === active.id) ? active : null;
  useEffect(() => {
    if (!shownActive) api.current?.aim(null);
  }, [shownActive]);

  const pick = (p: Project | null) => {
    setActive(p);
    api.current?.aim(p?.id ?? null);
  };
  const click = (p: Project) => {
    if (moved.current >= 6) return; // that was a drag
    // touch: the first tap only picks the card (she talks about it), the second one opens it
    if (pointer.current !== "mouse" && pointer.current !== "" && active?.id !== p.id) {
      setTouch(true);
      return pick(p);
    }
    onOpen(p);
  };
  const leave = (e: React.FocusEvent | React.PointerEvent) => {
    if ("pointerType" in e && e.pointerType !== "mouse") return;
    const next = (e as React.FocusEvent).relatedTarget as HTMLElement | null;
    if (next?.closest?.("[data-ring-id]")) return;
    pick(null);
  };
  const poses = PERSONA.poses;
  const idle = touch ? t("ringIdleTouch") : t("ringIdle");

  // bubbleId: the bubble shown at this size (the ring and the phone grid each have their own)
  const button = (p: Project, bubbleId: string, extra = "") => (
    <button
      type="button"
      onClick={() => click(p)}
      onPointerDown={(e) => (pointer.current = e.pointerType)}
      onKeyDown={() => (pointer.current = "")}
      onPointerEnter={(e) => e.pointerType === "mouse" && pick(p)}
      onPointerLeave={leave}
      // keyboard focus only: a tap also focuses the button and must not count as the first tap
      onFocus={(e) => e.currentTarget.matches(":focus-visible") && pick(p)}
      onBlur={leave}
      data-active={active?.id === p.id ? "" : undefined}
      data-open-project={p.id}
      aria-describedby={active?.id === p.id ? bubbleId : undefined}
      className={`group block w-full text-left focus-visible:outline-none [&:focus-visible>span]:ring-2 [&:focus-visible>span]:ring-rose [&:focus-visible>span]:ring-offset-2 [&:focus-visible>span]:ring-offset-bg ${extra}`}
    >
      <Thumb p={p} featured={p.featured} />
      <span className="sr-only">
        {p.comingSoon ? `, ${t("comingSoon")}` : ""} — {p.demoUrl ? t("demo") : t("readme")}
      </span>
    </button>
  );

  return (
    <>
      {/* ≥ 1024 px: the ring (narrower rings crowd the cards) */}
      <div
        ref={stage}
        data-pose="idle"
        className="ring-stage @container relative mx-auto hidden aspect-[1/0.72] w-full max-w-[min(100%,74rem,calc(100svh*1.3))] touch-pan-y select-none lg:block"
      >
        <div aria-hidden className="pointer-events-none absolute inset-[16%] rounded-full bg-peach-soft opacity-70" />
        <div aria-hidden className="pointer-events-none absolute inset-[9%] rounded-full border-2 border-dashed border-line" />

        {/* her, in the middle */}
        {/* no z-index: the figure stays below the cards (z 10–30) */}
        <div className="absolute top-1/2 left-1/2 w-[19cqi] -translate-x-1/2 -translate-y-[52%]">
          <div className="ring-figure">
            <PersonaFigure alt="" sizes="(min-width: 1536px) 240px, 200px" src={poses.idle} />
            {/* real poses: one image per direction, cross-faded by data-pose (CSS) */}
            {(["up", "down", "left", "right"] as const).map(
              (k) =>
                poses[k] && (
                  // eslint-disable-next-line @next/next/no-img-element -- static pose file
                  <img key={k} src={poses[k]} alt="" data-pose-img={k} loading="lazy" decoding="async" className="absolute inset-0 size-full object-contain object-bottom opacity-0" />
                ),
            )}
          </div>
          {/* placeholder: a hand that turns towards the card */}
          {!poses.up && (
            <span aria-hidden className="ring-hand pointer-events-none absolute top-[48%] left-1/2 block h-0 w-0">
              <PointHand className="absolute top-[-0.9cqi] left-[9cqi] w-[7cqi]" />
            </span>
          )}
        </div>
        {/* speech bubble: from her mouth, on her right. A sibling of the cards: the figure box is
            transformed, so a z-index inside it could never rise above them */}
        <div
          id="ring-bubble"
          className="ring-bubble absolute top-[calc(50%-11.2cqi)] left-[calc(50%+5.7cqi)] z-40 w-[min(19rem,30cqi)] rounded-[1.4rem] rounded-bl-md border-2 border-ink bg-surface p-3.5 shadow-[4px_4px_0_var(--ink)]"
        >
          <Bubble p={shownActive} locale={locale} idle={idle} onOpen={onOpen} touch={touch} />
        </div>

        <ul aria-label={t("title")} className="absolute inset-0">
          {projects.map((p) => (
            <li key={p.id} data-ring-id={p.id} className="ring-card absolute top-0 left-0 w-[clamp(76px,9.6cqi,120px)]">
              {button(p, "ring-bubble")}
            </li>
          ))}
        </ul>
        <p aria-hidden className="absolute inset-x-0 bottom-1 text-center text-xs font-semibold text-muted">
          ↻ {t("ringHint")}
        </p>
      </div>

      {/* < 1024 px: a small sticky figure with the bubble, then a plain grid */}
      <div className="lg:hidden">
        <div className="sticky top-16 z-20 -mx-1 mb-4 flex items-start gap-3 rounded-[1.4rem] border-2 border-ink bg-surface p-3 shadow-[4px_4px_0_var(--ink)]">
          <PersonaFigure alt="" sizes="56px" src={poses.idle} className="w-14 shrink-0" />
          <Bubble id="ring-bubble-m" compact p={shownActive} locale={locale} idle={t("ringIdleTouch")} onOpen={onOpen} touch />
        </div>
        <ul aria-label={t("title")} className="grid grid-cols-2 gap-3">
          {projects.map((p) => (
            <li key={p.id}>{button(p, "ring-bubble-m", "[&>span]:!scale-100")}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
