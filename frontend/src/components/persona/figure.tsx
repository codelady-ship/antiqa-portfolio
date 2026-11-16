import Image from "next/image";
import type { Ref } from "react";
import photo from "@/components/hero/antiqa.jpg";

/**
 * The figure itself. Placeholder (no AI asset yet): her photo in a pastel arch, the same
 * "print on coloured card" look as the rest of the site. `src` swaps in a real cut-out pose
 * (transparent WebP) when one exists; the box keeps the same aspect ratio, so nothing shifts.
 */
export function PersonaFigure({
  alt,
  sizes,
  src,
  className = "",
  innerRef,
  eager = false,
}: {
  alt: string;
  sizes: string;
  /** a real cut-out pose from /persona/poses/ (transparent background) */
  src?: string;
  className?: string;
  innerRef?: Ref<HTMLDivElement>;
  eager?: boolean;
}) {
  return (
    <div ref={innerRef} data-fig className={`relative aspect-[677/800] will-change-transform ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- static pose file, sized by the box
        <img src={src} alt={alt} decoding="async" loading={eager ? "eager" : "lazy"} className="absolute inset-0 size-full object-contain object-bottom" />
      ) : (
        <div className="absolute inset-0 overflow-hidden rounded-t-[999px] rounded-b-[2rem] border-[6px] border-surface bg-gradient-to-b from-[#ffd3df] to-[#ffe4d1] shadow-[var(--shadow)]">
          <Image
            src={photo}
            alt={alt}
            sizes={sizes}
            placeholder="blur"
            loading={eager ? "eager" : "lazy"}
            className="absolute inset-0 size-full object-cover object-top mix-blend-multiply"
          />
        </div>
      )}
    </div>
  );
}

/** A small waving hand (decorative), drawn rather than an emoji so it looks the same everywhere. */
export function WaveHand({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={`persona-wave ${className}`}>
      <path
        d="M14 26V12a3 3 0 0 1 6 0v10V8a3 3 0 0 1 6 0v14V10a3 3 0 0 1 6 0v14-8a3 3 0 0 1 6 0v14c0 8-6 14-14 14h-1c-5 0-8-2-11-6l-7-9a3 3 0 0 1 5-4l4 4"
        fill="#ffd9c2"
        stroke="var(--ink)"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A pointing hand (decorative); rotate its wrapper to aim it. Points right at 0°. */
export function PointHand({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 32" aria-hidden className={className}>
      <path
        d="M4 12h10l4-6c1-2 4-2 5 0l1 6h26a3 3 0 0 1 0 6H30v2a3 3 0 0 1-3 3v1a3 3 0 0 1-3 3h-2a3 3 0 0 1-3 3H11c-4 0-7-3-7-7Z"
        fill="#ffd9c2"
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
