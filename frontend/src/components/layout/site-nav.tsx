"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function SiteNav({ initials }: { initials: string }) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  // true only in the browser (theme is unknown during server render)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [hidden, setHidden] = useState(false);
  const bar = useRef<HTMLDivElement>(null);


  // progress bar + hide on scroll down / show on scroll up
  useEffect(() => {
    let last = scrollY;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - innerHeight;
        bar.current?.style.setProperty("transform", `scaleX(${max > 0 ? scrollY / max : 0})`);
        setHidden(scrollY > 400 && scrollY > last);
        last = scrollY;
      });
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);

  function toggleTheme(e: React.MouseEvent) {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (!doc.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return setTheme(next);
    const root = document.documentElement;
    root.style.setProperty("--vt-x", `${e.clientX}px`);
    root.style.setProperty("--vt-y", `${e.clientY}px`);
    doc.startViewTransition(() => setTheme(next));
  }

  const links = [
    ["#about", t("about")],
    ["#work", t("work")],
    ["#contact", t("contact")],
  ] as const;

  return (
    <>
      <div ref={bar} aria-hidden className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left scale-x-0" style={{ background: "var(--grad)" }} />
      <header
        className={`fixed top-4 left-1/2 z-50 w-[min(calc(100%-32px),64rem)] -translate-x-1/2 transition-transform duration-500 ${hidden ? "-translate-y-[150%]" : ""}`}
      >
        <nav
          aria-label="Main"
          className="flex items-center justify-between gap-3 rounded-full border border-line bg-bg/70 py-2 pr-2 pl-5 backdrop-blur-xl"
        >
          <Link href="/" className="display text-lg tracking-tight" aria-label="Home">
            {initials}
            <span className="text-rose">.</span>
          </Link>
          <ul className="hidden items-center gap-7 text-sm text-muted sm:flex">
            {links.map(([href, label]) => (
              <li key={href}>
                <a href={href} className="group relative transition-colors hover:text-ink">
                  {label}
                  <span className="absolute -bottom-1 left-0 h-px w-0 bg-rose transition-all duration-300 group-hover:w-full" />
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-1.5">
            <div role="group" aria-label={t("language")} className="flex rounded-full border border-line p-0.5 text-xs">
              {routing.locales.map((l) => (
                <Link
                  key={l}
                  href={pathname}
                  locale={l}
                  hrefLang={l}
                  aria-current={l === locale ? "true" : undefined}
                  className={`rounded-full px-2.5 py-1.5 font-medium uppercase transition-colors ${l === locale ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
                >
                  {l}
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={t("theme")}
              title={mounted ? (resolvedTheme === "dark" ? t("light") : t("dark")) : t("theme")}
              className="grid size-9 place-items-center rounded-full border border-line transition-transform duration-500 hover:rotate-45"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                {mounted && resolvedTheme === "light" ? (
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                ) : (
                  <>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </nav>
      </header>
    </>
  );
}
