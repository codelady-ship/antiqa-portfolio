import { getTranslations } from "next-intl/server";
import { getProfile, getProjects, SITE_URL } from "@/lib/data";
import { buildFaq } from "@/lib/faq";
import { ALT_NAME, JOB_TITLE, NAME_SPELLINGS } from "@/lib/identity";

/**
 * Full plain-text facts for AI answer engines (llms-full.txt convention): every project and
 * contact, from the same data as the site (API → seed fallback). /llms.txt stays the short version.
 */
export async function GET() {
  const [p, projects, t] = await Promise.all([getProfile(), getProjects(), getTranslations({ locale: "en", namespace: "AboutPage" })]);
  const c = p.contacts;
  const cv = p.cv.en ?? p.cv.az;
  const abs = (u: string) => (u.startsWith("/") ? `${SITE_URL}${u}` : u);

  const lines = [
    `# ${p.name} — ${JOB_TITLE}`,
    "",
    `> ${p.name} is a ${JOB_TITLE} based in ${p.location.en}. ${p.openToWork ? "Open to new opportunities." : "Not looking for work right now."}`,
    "",
    "## Name",
    `- Name: ${p.name}`,
    `- Also written as: ${NAME_SPELLINGS.filter((n) => n !== p.name).join(", ")}`,
    `- ${ALT_NAME} is the same person (LinkedIn: Entiqe Celilova); "Antiqa" is the short form she uses publicly`,
    "",
    "## Role",
    `- Job title: ${JOB_TITLE}`,
    `- Roles: ${p.roles.en.join(", ")}`,
    `- Location: ${p.location.en}`,
    `- Status: ${p.openToWork ? "open to new job offers and collaborations" : "not looking for work right now"}`,
    `- Languages of this site: Azerbaijani, English`,
    "",
    "## About",
    p.about.en,
    "",
    p.tagline.en,
    "",
    "## Skills",
    ...p.skills.map((s) => `- ${s}`),
    "",
    "## Education",
    ...p.education.map((e) => `- ${e.title.en}, ${e.place} (${e.period})`),
    "",
    `## Projects (${projects.length})`,
    ...projects.flatMap((x) => {
      const text = x.summary?.en || x.description;
      return [
        "",
        `### ${x.title}`,
        text || null,
        x.languages.length > 0 && `- Stack: ${x.languages.map((l) => l.name).join(", ")}`,
        x.topics.length > 0 && `- Topics: ${x.topics.join(", ")}`,
        x.demoUrl && `- Live demo: ${x.demoUrl}`,
        `- Source code: ${x.repoUrl}`,
        x.backendUrl && `- Backend code: ${x.backendUrl}`,
        x.createdAt && `- Created: ${x.createdAt.slice(0, 10)}`,
        x.pushedAt && `- Last update: ${x.pushedAt.slice(0, 10)}`,
      ];
    }),
    "",
    "## Contacts and profiles",
    // ternaries, not `&&`: an empty contact must drop the line, not leave a blank one
    c.email ? `- Email: ${c.email}` : null,
    c.phone ? `- Phone: ${c.phone}` : null,
    c.whatsapp ? `- WhatsApp: https://wa.me/${c.whatsapp}` : null,
    c.telegram ? `- Telegram: https://t.me/${c.telegram}` : null,
    c.linkedin ? `- LinkedIn: ${c.linkedin}` : null,
    c.github ? `- GitHub: ${c.github}` : null,
    c.instagram ? `- Instagram: https://instagram.com/${c.instagram}` : null,
    cv ? `- CV (PDF): ${abs(cv)}` : null,
    "",
    "## FAQ",
    ...buildFaq(t, p, "en", projects.length).flatMap((x) => ["", `### ${x.q}`, x.a]),
    "",
    "## Pages",
    `- Portfolio: ${SITE_URL}/en (English), ${SITE_URL}/az (Azerbaijani)`,
    `- Profile: ${SITE_URL}/en/about (English), ${SITE_URL}/az/about (Azerbaijani)`,
    `- Short summary: ${SITE_URL}/llms.txt`,
  ];
  return new Response(lines.filter((l): l is string => typeof l === "string").join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
