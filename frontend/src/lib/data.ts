import { cacheLife, cacheTag } from "next/cache";
import { mergeProfile } from "./merge";
import { SEED_PROFILE, SEED_REPOS } from "./seed";
import type { Profile, Project } from "./types";

const API_URL = process.env.API_URL?.replace(/\/$/, "");
const GH = "https://api.github.com";

/** cache profile of the fallback data: refetched after a minute, gone after five */
const FALLBACK_LIFE = { stale: 30, revalidate: 60, expire: 300 };

async function api<T>(path: string): Promise<T | null> {
  if (!API_URL) return null;
  try {
    // long enough for a cold start of the API's serverless function; a timeout falls back (briefly cached)
    const r = await fetch(`${API_URL}${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(25_000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function getProfile(): Promise<Profile> {
  "use cache";
  cacheTag("profile");
  const p = await api<Partial<Profile>>("/api/profile");
  // API down or cold: the seed profile is kept only briefly
  if (p) cacheLife("minutes");
  else cacheLife(FALLBACK_LIFE);
  return mergeProfile(SEED_PROFILE, p);
}

export async function getProjects(): Promise<Project[]> {
  "use cache";
  cacheTag("projects");
  const fromApi = await api<Project[]>("/api/projects");
  if (fromApi?.length) {
    // minutes, not hours: a change written straight to the database (seed script, the daily GitHub
    // sync) without a revalidate call still shows within minutes (2026-11-17: "7 projects" lingered)
    cacheLife("minutes");
    return fromApi;
  }
  // the API failed or was cold: the GitHub/seed fallback is kept only briefly (never longer than the
  // API result), so one failed refetch cannot pin the fallback list on the site
  cacheLife(FALLBACK_LIFE);
  const gh = await fromGithub();
  // repos GitHub did not return (rate limit) still show, from the static seed
  const got = new Set(gh.map((p) => p.id.toLowerCase()));
  return [...gh, ...staticSeed().filter((p) => !got.has(p.id.toLowerCase()))];
}

/* ---------- fallback: read GitHub directly (no database yet) ---------- */
function ghHeaders() {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "portfolio" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

function staticSeed(): Project[] {
  return SEED_REPOS.map((s) => {
    const [, owner = "", name = ""] = s.url.match(/github\.com\/([^/]+)\/([^/]+)/) ?? [];
    return {
      id: `${owner}/${name}`, owner, name, title: s.title || name, summary: { az: "", en: "" }, description: "",
      repoUrl: s.url, backendUrl: s.backend ?? null, demoUrl: s.demo ?? null, createdAt: null, pushedAt: null,
      stars: 0, forks: 0, topics: [], license: null, languages: [], featured: !!s.featured, order: 0, links: s.links,
    };
  });
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
          order: 0,
          links: s.links,
        };
      } catch {
        return null;
      }
    }),
  );
  return out.filter((p): p is Project => !!p);
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://antiqacode.vercel.app").replace(/\/$/, "");

