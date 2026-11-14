import { Cormorant_Garamond, Inter_Tight } from "next/font/google";

export const grotesk = Inter_Tight({
  variable: "--font-grotesk",
  subsets: ["latin", "latin-ext"],
  // one cut keeps the payload small; 600 reads as display type without the slab-heavy look (#22)
  weight: ["600"],
  display: "swap",
});

export const serif = Cormorant_Garamond({
  variable: "--font-serif-it",
  subsets: ["latin", "latin-ext"],
  weight: ["500"],
  style: ["italic"],
  display: "swap",
  preload: false,
});
