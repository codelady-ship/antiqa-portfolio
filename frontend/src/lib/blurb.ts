import type { Project } from "./types";

/** the longest caption the belt shows */
export const BLURB_MAX = 180;

/**
 * The project's summary for the belt caption and the work list, at most 180 characters. A longer text
 * is cut at a word and ends with "…" (#67: it used to keep only the first sentence, so masapay read
 * just "Komanda layihəsi.").
 */
export function blurb(p: Project, locale: "az" | "en") {
  const text = (p.summary?.[locale] || p.description || "").trim().replace(/\s+/g, " ");
  if (text.length <= BLURB_MAX) return text;
  const cut = text.slice(0, BLURB_MAX - 1);
  const space = cut.lastIndexOf(" ");
  // at the last whole word (unless that throws away most of the line), without a dangling comma, colon or full stop
  return `${(space > BLURB_MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:–—-]+$/u, "")}…`;
}
