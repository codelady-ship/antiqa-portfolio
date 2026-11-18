"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const noop = () => () => {};

export function SiteNav() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  // false on the server and during hydration, true afterwards (theme is only known on the client)
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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
        setScrolled(scrollY > 8);
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

  // owner, 2026-11-18: the "plain text / interactive" switch moves from the footer to the header
  const plain = pathname === "/about";
  const viewToggle = (className: string) => (
    <div role="group" aria-label={t("view")} className={`rounded-full border border-line bg-surface text-xs font-medium ${className}`}>
      {(
        [
          ["/", t("viewInteractive"), !plain],
          ["/about", t("viewPlain"), plain],
        ] as const
      ).map(([href, label, active]) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          onClick={() => setMenu(false)}
          className={`inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-full px-3 transition-colors ${active ? "bg-accent text-on-accent" : "text-muted hover:text-ink"}`}
        >
          {label}
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <div ref={bar} aria-hidden className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left scale-x-0 bg-accent" />
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[transform,background-color,border-color] duration-500 ${scrolled || menu ? "border-line bg-bg" : "border-transparent bg-bg/0"} ${hidden ? "-translate-y-full" : ""}`}
      >
        <nav aria-label={t("main")} className="wrap">
          {/* every control is ≥ 44×44 px (touch target); the bar stays one row down to 320 px */}
          <div className="flex h-16 items-center justify-between gap-1 sm:h-[4.5rem] sm:gap-3">
            {/* text logo (#32): the bare "AC" monogram was machine-translated to "KONDISIONER" (#21);
                accessible name contains the visible text (WCAG 2.5.3): "antiqa.code — Home" */}
            <Link href="/" translate="no" className="notranslate display group inline-flex min-h-11 min-w-11 items-center text-[1.35rem] leading-none font-bold sm:text-2xl">
              antiqa
              <span className="text-rose transition-colors group-hover:text-violet">.code</span>
              <span className="sr-only"> — {t("home")}</span>
            </Link>
            <ul className="hidden items-center gap-1 text-[0.95rem] font-medium sm:flex">
              {links.map(([hash, label]) => (
                <li key={hash}>
                  {section(
                    hash,
                    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-4 transition-colors hover:bg-pink-soft",
                    label,
                  )}
                </li>
              ))}
            </ul>
            <div className="flex shrink-0 items-center gap-1">
              {viewToggle("hidden lg:flex")}
              <div role="group" aria-label={t("language")} translate="no" className="notranslate flex rounded-full border border-line bg-surface text-xs">
                {routing.locales.map((l) => (
                  <Link
                    key={l}
                    href={pathname}
                    locale={l}
                    hrefLang={l}
                    aria-current={l === locale ? "true" : undefined}
                    className={`grid size-11 place-items-center rounded-full font-medium uppercase transition-colors ${l === locale ? "bg-accent text-on-accent" : "text-muted hover:text-ink"}`}
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
                className="grid size-11 place-items-center rounded-full border border-line bg-surface transition-transform duration-500 hover:rotate-45"
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
                className="grid size-11 place-items-center rounded-full border border-line bg-surface lg:hidden"
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
            className="mb-3 grid gap-1 rounded-3xl border border-line bg-surface p-2 shadow-[var(--shadow)] lg:hidden"
          >
            {links.map(([hash, label]) => (
              <li key={hash} className="sm:hidden">
                {section(hash, "block rounded-full px-4 py-3 font-medium transition-colors hover:bg-pink-soft", label, () => setMenu(false))}
              </li>
            ))}
            <li className="p-1">{viewToggle("flex text-sm")}</li>
          </ul>
        </nav>
      </header>
    </>
  );
}
