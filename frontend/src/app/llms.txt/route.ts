import { getProfile, getProjects, SITE_URL } from "@/lib/data";
import { JOB_TITLE, NAME_SPELLINGS } from "@/lib/identity";

/** Plain-text summary for AI answer engines (llms.txt convention). */
export async function GET() {
  const [p, projects] = await Promise.all([getProfile(), getProjects()]);
  const c = p.contacts;
  const lines = [
    `# ${p.name}`,
    "",
    `> ${JOB_TITLE} (${p.roles.en.join(", ")}) based in ${p.location.en}. ${p.openToWork ? "Open to new opportunities." : ""}`,
    "",
    `Also written as: ${NAME_SPELLINGS.filter((n) => n !== p.name).join(", ")}.`,
    "",
    p.about.en,
    "",
    "## Skills",
    p.skills.join(", "),
    "",
    "## Education",
    ...p.education.map((e) => `- ${e.title.en}, ${e.place} (${e.period})`),
    "",
    "## Projects",
    ...projects.map(
      (x) =>
        `- [${x.title}](${x.repoUrl})${x.demoUrl ? ` — live demo: ${x.demoUrl}` : ""}${x.description ? ` — ${x.description}` : ""}${x.languages.length ? ` (${x.languages.map((l) => l.name).join(", ")})` : ""}`,
    ),
    "",
    "## Contact",
    c.email ? `- Email: ${c.email}` : null,
    c.linkedin ? `- LinkedIn: ${c.linkedin}` : null,
    c.github ? `- GitHub: ${c.github}` : null,
    c.instagram ? `- Instagram: https://instagram.com/${c.instagram}` : null,
    "",
    `Website: ${SITE_URL}/en (English), ${SITE_URL}/az (Azerbaijani)`,
    `Full profile: ${SITE_URL}/en/about (English), ${SITE_URL}/az/about (Azerbaijani)`,
    `All facts in plain text (every project, contacts, FAQ): ${SITE_URL}/llms-full.txt`,
  ];
  return new Response(lines.filter((l): l is string => typeof l === "string").join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
