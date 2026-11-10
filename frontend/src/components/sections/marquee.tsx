"use client";

import { useEffect, useRef } from "react";

/** Two kinetic rows of big type; scrolling speeds them up and skews them (editorial feel). */
export function Marquee({ items, label }: { items: string[]; label: string }) {
  const rows = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let x = 0,
      vel = 0,
      last = scrollY,
      raf = 0,
      running = false;
    const host = rows.current[0]?.parentElement?.parentElement;
    const tick = () => {
      const dy = scrollY - last;
      last = scrollY;
      vel += (dy * 0.25 - vel) * 0.1;
      x -= 0.6 + Math.abs(vel);
      rows.current.forEach((row, i) => {
        if (!row) return;
        const w = row.scrollWidth / 2;
        const off = ((x % w) + w) % w;
        const dir = i % 2 ? 1 : -1;
        row.style.transform = `translate3d(${dir < 0 ? -off : off - w}px,0,0) skewX(${Math.max(-12, Math.min(12, -vel * 0.8))}deg)`;
      });
      if (running) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      running = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(tick);
    });
    if (host) io.observe(host);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  const line = (outline: boolean) =>
    [...items, ...items].map((s, i) => (
      <span key={i} className={`display flex items-center gap-[0.35em] pr-[0.35em] ${outline ? "outline-text" : ""}`}>
        {s}
        <span className="text-[0.45em] text-rose" aria-hidden>
          ✦
        </span>
      </span>
    ));

  return (
    <section aria-label={label} className="overflow-hidden border-y border-line py-10 text-[clamp(2.6rem,8vw,7rem)]">
      <ul className="sr-only">
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <div aria-hidden>
        <div ref={(el) => void (rows.current[0] = el)} className="marquee">
          {line(false)}
        </div>
      </div>
      <div className="mt-2">
        <div ref={(el) => void (rows.current[1] = el)} className="marquee" aria-hidden>
          {line(true)}
        </div>
      </div>
    </section>
  );
}
