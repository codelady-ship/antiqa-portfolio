"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from "react";

type Props = Omit<HTMLAttributes<HTMLElement>, "style"> & {
  children: ReactNode;
  index?: number;
  as?: ElementType;
};

/** Fades/blurs its content up once, the first time it scrolls into view (styles in globals.css). */
export function Reveal({ children, index = 0, as: Tag = "div", ...rest }: Props) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => el.setAttribute("data-reveal", "shown");
    if (typeof IntersectionObserver === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return show();
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          show();
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag {...rest} ref={ref} data-reveal="hidden" style={{ "--reveal-index": index } as CSSProperties}>
      {children}
    </Tag>
  );
}

/** Splits text into words that rise one by one (use inside <Reveal> or with className="split-in"). */
export function SplitWords({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="split-word" aria-hidden="true">
          <span style={{ "--i": i } as CSSProperties}>{w}&nbsp;</span>
        </span>
      ))}
    </span>
  );
}
