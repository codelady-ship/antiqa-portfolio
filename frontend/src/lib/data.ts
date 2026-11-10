import { cacheLife, cacheTag } from "next/cache";
import { SEED_PROFILE, SEED_REPOS } from "./seed";
import type { Profile, Project } from "./types";

const API_URL = process.env.API_URL?.replace(/\/$/, "");
const GH = "https://api.github.com";

async function api<T>(path: string): Promise<T | null> {
  if (!API_URL) return null;
  try {
    const r = await fetch(`${API_URL}${path}`, { headers: { Accept: "application/json" } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function getProfile(): Promise<Profile> {
  "use cache";
  cacheLife("minutes");
  cacheTag("profile");
  const p = await api<Partial<Profile>>("/api/profile");
  return p?.name ? ({ ...SEED_PROFILE, ...p, cv: { ...SEED_PROFILE.cv, ...p.cv } } as Profile) : SEED_PROFILE;
}

export async function getProjects(): Promise<Project[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("projects");
  const fromApi = await api<Project[]>("/api/projects");
  if (fromApi?.length) return fromApi;
  return fromGithub();
}

/* ---------- fallback: read GitHub directly (no database yet) ---------- */
function ghHeaders() {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "portfolio" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function fromGithub(): Promise<Project[]> {
  const out = await Promise.all(
    SEED_REPOS.map(async (s): Promise<Project | null> => {
      const m = s.url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!m) return null;
      const [, owner, name] = m;
      try {
        const [repo, langs] = await Promise.all([
          fetch(`${GH}/repos/${owner}/${name}`, { headers: ghHeaders() }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${GH}/repos/${owner}/${name}/languages`, { headers: ghHeaders() }).then((r) => (r.ok ? r.json() : {})),
        ]);
        if (!repo) return null;
        const total = Object.values(langs as Record<string, number>).reduce((a, b) => a + b, 0) || 1;
        const homepage: string | null = repo.homepage || null;
        return {
          id: `${owner}/${name}`,
          owner,
          name,
          title: s.title || name.replace(/[-_.]+/g, " ").trim(),
          summary: { az: "", en: "" },
          description: repo.description ?? "",
          repoUrl: repo.html_url,
          backendUrl: s.backend ?? null,
          demoUrl: homepage ? (/^https?:/.test(homepage) ? homepage : `https://${homepage}`) : repo.has_pages ? `https://${owner}.github.io/${name}/` : null,
          createdAt: repo.created_at,
          pushedAt: repo.pushed_at,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          topics: repo.topics ?? [],
          license: repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : null,
          languages: Object.entries(langs as Record<string, number>)
            .map(([n, v]) => ({ name: n, percent: Math.round((v / total) * 1000) / 10 }))
            .sort((a, b) => b.percent - a.percent),
          featured: !!s.featured,
        };
      } catch {
        return null;
      }
    }),
  );
  return out.filter((p): p is Project => !!p);
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://antiqacode.vercel.app").replace(/\/$/, "");

