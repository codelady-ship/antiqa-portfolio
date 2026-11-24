import { getProfile, getProjects, SITE_URL } from "@/lib/data";
import { localizeProjects, projectLanguages, visibleProjects } from "@/lib/showcase";
import { JOB_TITLE, NAME_SPELLINGS } from "@/lib/identity";

/** Plain-text summary for AI answer engines (llms.txt convention). */
export async function GET() {
  const [p, all] = await Promise.all([getProfile(), getProjects()]);
  const projects = visibleProjects(localizeProjects(all, "en"));
  const c = p.contacts;
  // the roles besides the job title: "Full Stack Developer (Full Stack Developer, …)" read twice (#70)
  const otherRoles = p.roles.en.filter((r) => r.trim().toLowerCase() !== JOB_TITLE.toLowerCase());
  const lines = [
    `# ${p.name}`,
    "",
    `> ${JOB_TITLE}${otherRoles.length ? ` (${otherRoles.join(", ")})` : ""} based in ${p.location.en}.${p.openToWork ? " Open to new opportunities." : ""}`,
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
        `- ${x.repoUrl ? `[${x.title}](${x.repoUrl})` : x.title}${x.demoUrl ? ` — live demo: ${x.demoUrl}` : ""}${x.description ? ` — ${x.description}` : ""}${projectLanguages(x).length ? ` (${projectLanguages(x).join(", ")})` : ""}`,
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
