import { SITE_URL } from "@/lib/data";
import type { Profile, Project } from "@/lib/types";

/** schema.org Person node shared by the home and /about pages. */
function personNode(profile: Profile, locale: "az" | "en") {
  const c = profile.contacts;
  const sameAs = [c.github, c.linkedin, c.instagram && `https://instagram.com/${c.instagram}`].filter(Boolean);
  return {
    "@type": "Person",
    "@id": `${SITE_URL}/#person`,
    name: profile.name,
    alternateName: "Antiqa",
    jobTitle: profile.roles.en[0] ?? "Full Stack Developer",
    description: profile.about[locale],
    url: SITE_URL,
    homeLocation: { "@type": "Place", name: profile.location.en },
    knowsAbout: profile.skills,
    knowsLanguage: ["az", "en"],
    alumniOf: profile.education.map((e) => ({ "@type": "EducationalOrganization", name: e.place })),
    sameAs,
  };
}

function LdScript({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** Structured data for search and AI answer engines (Person + WebSite + list of source code). */
export function JsonLd({ profile, projects, locale }: { profile: Profile; projects: Project[]; locale: "az" | "en" }) {
  const person = personNode(profile, locale);
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      person,
      { "@type": "WebSite", "@id": `${SITE_URL}/#site`, url: SITE_URL, name: profile.name, inLanguage: ["az", "en"], author: { "@id": `${SITE_URL}/#person` } },
      {
        "@type": "ProfilePage",
        url: `${SITE_URL}/${locale}`,
        inLanguage: locale,
        mainEntity: { "@id": `${SITE_URL}/#person` },
      },
      {
        "@type": "ItemList",
        name: "Projects",
        itemListElement: projects.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "SoftwareSourceCode",
            name: p.title,
            description: p.summary?.[locale] || p.description || undefined,
            codeRepository: p.repoUrl,
            url: p.demoUrl ?? p.repoUrl,
            programmingLanguage: p.languages.map((l) => l.name),
            dateCreated: p.createdAt ?? undefined,
            dateModified: p.pushedAt ?? undefined,
            author: { "@id": `${SITE_URL}/#person` },
          },
        })),
      },
    ],
  };
  return <LdScript data={data} />;
}

/** /about: an AboutPage whose main entity is the same Person as on the home page. */
export function AboutJsonLd({ profile, locale, name }: { profile: Profile; locale: "az" | "en"; name: string }) {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      personNode(profile, locale),
      {
        "@type": "AboutPage",
        url: `${SITE_URL}/${locale}/about`,
        name,
        inLanguage: locale,
        isPartOf: { "@id": `${SITE_URL}/#site` },
        mainEntity: { "@id": `${SITE_URL}/#person` },
      },
    ],
  };
  return <LdScript data={data} />;
}
