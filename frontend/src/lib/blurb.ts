import type { Project } from "./types";

/** the longest caption the belt shows */
export const BLURB_MAX = 180;

/**
 * 1–2 sentences (≤ 180 chars) for the belt caption, the dialog and the work list. Whole sentences as
 * before; only when the first sentence is a stub (#67: masapay read just "Komanda layihəsi.") and the
 * next one does not fit, the next one is added cut at a word with "…".
 */
export function blurb(p: Project, locale: "az" | "en") {
  const text = (p.summary?.[locale] || p.description || "").trim();
  if (!text) return "";
  // a sentence ends at . ! ? followed by a space and a capital letter (not inside "Next.js" or "3.5")
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-ZƏÖÜÇŞİĞ“"(])/u);
  let out = sentences[0].trim();
  const next = sentences[1]?.trim();
  if (next && out.length + sentences[1].length <= BLURB_MAX) out += ` ${sentences[1].trim()}`;
  else if (next && out.length < BLURB_MAX / 2) {
    // room for a space, the cut sentence and "…"
    const cut = next.slice(0, BLURB_MAX - out.length - 2);
    const space = cut.lastIndexOf(" ");
    const words = (space > 0 ? cut.slice(0, space) : cut).replace(/[\s.,;:–—-]+$/u, "");
    if (words) out += ` ${words}…`;
  }
  return out.length > BLURB_MAX ? `${out.slice(0, BLURB_MAX - 3).trimEnd()}…` : out;
}
