import { Caveat, Fraunces, Plus_Jakarta_Sans } from "next/font/google";

/*
 * Type (#32): all three families carry the full Azerbaijani set (Ə ə Ğ ğ İ ı Ö ö Ş ş Ç ç Ü ü),
 * checked glyph by glyph; Bricolage, Manrope, Outfit and Figtree were rejected because ə falls back.
 *  - Fraunces (soft, warm serif) for headings and her name,
 *  - Plus Jakarta Sans for body text,
 *  - Caveat for two or three handwritten notes (not preloaded).
 */
export const display = Fraunces({
  variable: "--font-display-face",
  subsets: ["latin", "latin-ext"],
  axes: ["SOFT"],
  display: "swap",
});

export const sans = Plus_Jakarta_Sans({
  variable: "--font-sans-face",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const hand = Caveat({
  variable: "--font-hand-face",
  subsets: ["latin", "latin-ext"],
  weight: ["600"],
  display: "swap",
  preload: false,
});

export const fontVars = `${display.variable} ${sans.variable} ${hand.variable}`;
