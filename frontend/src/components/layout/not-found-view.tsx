import type { ReactNode } from "react";

/** Shared 404 look: used inside the locale layout and by the bare global 404 page. */
export function NotFoundView({ kicker, title, text, children }: { kicker: string; title: string; text: ReactNode; children: ReactNode }) {
  return (
    <section className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-32 sm:px-8">
      <div aria-hidden className="backdrop-grid absolute inset-0 opacity-60" />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[70vmin] -translate-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--violet) 45%, transparent), transparent 65%)" }}
      />
      <div className="relative mx-auto w-full max-w-4xl">
        <p className="kicker">{kicker}</p>
        <p aria-hidden className="display outline-text mt-4 text-[clamp(6rem,30vw,18rem)]">
          404
        </p>
        <h1 className="display mt-4 text-[clamp(2.2rem,7vw,5.5rem)] [overflow-wrap:anywhere]">{title}</h1>
        <p className="mt-6 max-w-xl text-lg text-muted">{text}</p>
        <div className="mt-10 flex flex-wrap gap-3">{children}</div>
      </div>
    </section>
  );
}

export const notFoundCta =
  "group relative overflow-hidden rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-bg transition-transform hover:-translate-y-0.5";
