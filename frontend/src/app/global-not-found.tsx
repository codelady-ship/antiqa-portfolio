import type { Metadata } from "next";
import Link from "next/link";
import { NotFoundView, notFoundCta } from "@/components/layout/not-found-view";
import az from "../../messages/az.json";
import en from "../../messages/en.json";
import { grotesk, serif } from "./fonts";
import "./globals.css";

/**
 * 404 for requests that never reach the locale layout (unknown locale → the layout calls notFound(),
 * or a URL no route matches). No locale is known here, so it shows both languages.
 */
export const metadata: Metadata = { title: `404 — ${az.NotFound.title} / ${en.NotFound.title}` };

// next-themes is not mounted on this page: apply the saved theme (default dark) before paint
const THEME = `try{var t=localStorage.getItem("pf-theme");var d=t?t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches):true;document.documentElement.classList.toggle("dark",d)}catch(e){document.documentElement.classList.add("dark")}`;

export default function GlobalNotFound() {
  return (
    <html lang="az" className={`${grotesk.variable} ${serif.variable} dark antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body className="min-h-dvh">
        <main>
          <NotFoundView kicker={az.NotFound.kicker} title={az.NotFound.title} text={`${az.NotFound.text} / ${en.NotFound.text}`}>
            <Link href="/az" hrefLang="az" className={notFoundCta}>
              {az.NotFound.home} →
            </Link>
            <Link href="/en" hrefLang="en" lang="en" className="rounded-full border border-line px-7 py-3.5 text-sm font-medium transition-colors hover:border-rose hover:text-rose">
              {en.NotFound.home} →
            </Link>
          </NotFoundView>
        </main>
      </body>
    </html>
  );
}
