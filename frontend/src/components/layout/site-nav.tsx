"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const noop = () => () => {};

export function SiteNav({ initials }: { initials: string }) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  // false on the server and during hydration, true afterwards (theme is only known on the client)
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [hidden, setHidden] = useState(false);
  const [menu, setMenu] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const menuList = useRef<HTMLUListElement>(null);

  // compact menu (phones): Esc closes and returns focus to the toggle
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenu(false);
      menuBtn.current?.focus();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [menu]);

  // progress bar + hide on scroll down / show on scroll up
  useEffect(() => {
    let last = scrollY;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - innerHeight;
        bar.current?.style.setProperty("transform", `scaleX(${max > 0 ? scrollY / max : 0})`);
        const down = scrollY > 400 && scrollY > last;
        setHidden(down);
        if (down) {
          // closing hides the menu: do not strand keyboard focus inside it
          if (menuList.current?.contains(document.activeElement)) menuBtn.current?.focus();
          setMenu(false);
        }
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
    ["about", t("about")],
    ["work", t("work")],
    ["contact", t("contact")],
  ] as const;
  // on the home page a plain hash link scrolls; elsewhere (404, /admin) go home first
  const onHome = pathname === "/";
  const section = (hash: string, className: string, children: ReactNode, onClick?: () => void) =>
    onHome ? (
      <a href={`#${hash}`} className={className} onClick={onClick}>
        {children}
      </a>
    ) : (
      <Link href={{ pathname: "/", hash }} className={className} onClick={onClick}>
        {children}
      </Link>
    );

  return (
    <>
      <div ref={bar} aria-hidden className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left scale-x-0" style={{ background: "var(--grad)" }} />
      <header
        className={`fixed top-4 left-1/2 z-50 w-[min(calc(100%-32px),64rem)] -translate-x-1/2 transition-transform duration-500 ${hidden ? "-translate-y-[150%]" : ""}`}
      >
        <nav aria-label={t("main")}>
          {/* every control is ≥ 44×44 px (touch target); the pill stays one row down to 320 px */}
          <div className="flex items-center justify-between gap-1 rounded-full border border-line bg-bg/70 py-1 pr-1 pl-3 backdrop-blur-xl sm:gap-3 sm:pl-4">
            {/* accessible name must contain the visible text (WCAG 2.5.3): "AC — Home" */}
            <Link href="/" className="display inline-flex min-h-11 min-w-11 items-center px-1 text-lg tracking-tight">
              {initials}
              <span className="text-rose" aria-hidden>
                .
              </span>
              <span className="sr-only"> — {t("home")}</span>
            </Link>
            <ul className="hidden items-center gap-3 text-sm text-muted sm:flex md:gap-5">
              {links.map(([hash, label]) => (
                <li key={hash}>
                  {section(
                    hash,
                    "group relative inline-flex min-h-11 min-w-11 items-center justify-center px-1 transition-colors hover:text-ink",
                    <>
                      {label}
                      <span className="absolute bottom-2.5 left-1 h-px w-0 bg-rose transition-all duration-300 group-hover:w-[calc(100%-0.5rem)]" />
                    </>,
                  )}
                </li>
              ))}
            </ul>
            <div className="flex shrink-0 items-center gap-1">
              <div role="group" aria-label={t("language")} className="flex rounded-full border border-line text-xs">
                {routing.locales.map((l) => (
                  <Link
                    key={l}
                    href={pathname}
                    locale={l}
                    hrefLang={l}
                    aria-current={l === locale ? "true" : undefined}
                    className={`grid size-11 place-items-center rounded-full font-medium uppercase transition-colors ${l === locale ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
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
                className="grid size-11 place-items-center rounded-full border border-line transition-transform duration-500 hover:rotate-45"
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
              <button
                ref={menuBtn}
                type="button"
                onClick={() => setMenu((m) => !m)}
                aria-expanded={menu}
                aria-controls="nav-menu"
                aria-label={t("menu")}
                className="grid size-11 place-items-center rounded-full border border-line sm:hidden"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  {menu ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 8h16M4 16h16" />}
                </svg>
              </button>
            </div>
          </div>
          <ul
            ref={menuList}
            id="nav-menu"
            hidden={!menu}
            className="mt-2 grid gap-1 rounded-[1.4rem] border border-line bg-bg/90 p-2 backdrop-blur-xl sm:hidden"
          >
            {links.map(([hash, label]) => (
              <li key={hash}>
                {section(hash, "block rounded-full px-4 py-3 text-sm transition-colors hover:bg-bg-2", label, () => setMenu(false))}
              </li>
            ))}
          </ul>
        </nav>
      </header>
    </>
  );
}
