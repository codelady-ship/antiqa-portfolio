import { SITE_URL } from "./data";
import { ALT_NAME } from "./identity";
import type { Profile } from "./types";

type T = (key: string, values?: Record<string, string | number>) => string;

const short = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/**
 * Factual Q&A built from the same profile data as the rest of the site (API → seed).
 * `t` is the "AboutPage" translator. The about page renders these strings and the
 * FAQPage JSON-LD repeats them verbatim; /llms-full.txt reuses the English ones.
 */
export function buildFaq(t: T, profile: Profile, locale: "az" | "en", projectCount: number) {
  const name = profile.name;
  const c = profile.contacts;
  const lower = (s: string) => s.toLocaleLowerCase(locale);
  const channels = [
    c.email && `${lower(t("email"))} ${c.email}`,
    c.phone && `${lower(t("phone"))} ${c.phone}`,
    c.whatsapp && `WhatsApp +${c.whatsapp}`,
    c.telegram && `Telegram @${c.telegram}`,
    c.linkedin && `LinkedIn ${short(c.linkedin)}`,
  ].filter(Boolean);

  const faq = [
    { q: t("faqWhoQ", { name }), a: t("faqWhoA", { name, alt: ALT_NAME, location: profile.location[locale] }) },
    { q: t("faqBuildQ", { name }), a: t("faqBuildA", { count: projectCount }) },
    { q: t("faqStackQ", { name }), a: t("faqStackA", { skills: profile.skills.join(", ") }) },
    { q: t("faqOpenQ", { name }), a: t(profile.openToWork ? "faqOpenYes" : "faqOpenNo", { name }) },
    channels.length > 0 && { q: t("faqContactQ", { name }), a: t("faqContactA", { channels: channels.join(", ") }) },
    c.github && { q: t("faqProjectsQ", { name }), a: t("faqProjectsA", { site: short(SITE_URL), github: short(c.github) }) },
  ];
  return faq.filter((x): x is { q: string; a: string } => !!x);
}
