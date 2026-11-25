import type { ReactNode } from "react";

/** Shared 404 look: used inside the locale layout and by the bare global 404 page. */
export function NotFoundView({ kicker, title, text, children }: { kicker: string; title: string; text: ReactNode; children: ReactNode }) {
  return (
    // data-not-found: DropStaleNoindex (#85) keeps the 404's noindex while this view is on screen
    <section data-not-found className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-32 sm:px-8">
      <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 size-[30rem] rounded-full bg-peach-soft" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-16 size-64 rotate-12 rounded-[3rem] bg-lilac-soft" />
      <div className="relative mx-auto w-full max-w-4xl">
        <p className="kicker">{kicker}</p>
        {/* #68: in dark the pink-soft fill was 1.27:1 on the page; #a24a6f is 3.2:1 (light stays as it was) */}
        <p aria-hidden className="display mt-4 text-[clamp(6rem,30vw,16rem)] leading-none font-bold text-pink-soft [-webkit-text-stroke:2px_var(--rose)] dark:text-[#a24a6f]">
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
  "group relative overflow-hidden rounded-full border-2 border-ink bg-accent px-7 py-3.5 text-sm font-semibold text-on-accent shadow-[4px_4px_0_var(--ink)] transition-transform hover:-translate-y-0.5";
