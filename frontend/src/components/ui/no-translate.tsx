import { Fragment, type ReactNode } from "react";

/**
 * Names that machine translation must leave alone: her name, tech and brand names.
 * Chrome's auto-translate turned "AC" into "KONDISIONER" and "React" into "REAKSİYA VERİN" (#21);
 * translate="no" (standard) plus the "notranslate" class (Google) keeps them as written.
 */
export function NoTr({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span translate="no" className={`notranslate ${className}`.trim()}>
      {children}
    </span>
  );
}

/** Brand words that show up in prose but are not in the profile's skill list. */
const BRANDS = ["MERN", "Express", "GitHub", "LinkedIn", "WhatsApp", "Telegram", "Instagram", "Jet Academy", "Full Stack", "Frontend", "Backend"];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Wraps every known name inside a sentence in <NoTr>, so the sentence still translates
 * but the names in it do not. Longest names first ("Next.js" before "Next"); a name only
 * matches as a whole word.
 */
export function withNames(text: string, names: readonly string[]): ReactNode {
  const list = [...new Set([...names, ...BRANDS])].filter((n) => n.trim().length > 1).sort((a, b) => b.length - a.length);
  if (!text || list.length === 0) return text;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${list.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "gu");
  const parts = text.split(re);
  // split with one capture group: odd indexes are the matched names
  return parts.map((p, i) => (i % 2 ? <NoTr key={i}>{p}</NoTr> : <Fragment key={i}>{p}</Fragment>));
}
