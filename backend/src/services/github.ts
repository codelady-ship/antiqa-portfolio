/**
 * Reads everything the portfolio shows about a project from the public GitHub API.
 * Set GITHUB_TOKEN (fine-grained, public read-only) to lift the 60 req/h limit.
 */

export type RepoRef = { owner: string; name: string };

export type GithubSnapshot = {
  owner: string;
  name: string;
  url: string;
  description: string;
  homepage: string | null;
  hasPages: boolean;
  createdAt: string;
  pushedAt: string;
  stars: number;
  forks: number;
  topics: string[];
  license: string | null;
  defaultBranch: string;
  languages: { name: string; percent: number }[];
  readmeHtml: string;
};

const API = "https://api.github.com";

export function parseRepoUrl(input: string): RepoRef | null {
  const m = String(input)
    .trim()
    .match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?(?:[#?].*)?$/i);
  if (!m) return null;
  return { owner: m[1], name: m[2] };
}

function headers(accept = "application/vnd.github+json"): Record<string, string> {
  const h: Record<string, string> = { Accept: accept, "User-Agent": "portfolio-api", "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

export class GithubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(API + path, { headers: headers() });
  if (!r.ok) throw new GithubError(r.status, r.status === 404 ? "Repository not found" : `GitHub ${r.status}`);
  return (await r.json()) as T;
}

export function toPercentages(langs: Record<string, number>) {
  const total = Object.values(langs).reduce((a, b) => a + b, 0);
  if (!total) return [];
  return Object.entries(langs)
    .map(([name, bytes]) => ({ name, percent: Math.round((bytes / total) * 1000) / 10 }))
    .sort((a, b) => b.percent - a.percent);
}

export function demoUrl(s: Pick<GithubSnapshot, "owner" | "name" | "homepage" | "hasPages">, override?: string | null) {
  if (override) return override;
  if (s.homepage) return /^https?:\/\//i.test(s.homepage) ? s.homepage : `https://${s.homepage}`;
  if (s.hasPages) {
    return s.name.toLowerCase() === `${s.owner.toLowerCase()}.github.io`
      ? `https://${s.owner}.github.io/`
      : `https://${s.owner}.github.io/${s.name}/`;
  }
  return null;
}

/** Rewrites relative image/link URLs in GitHub-rendered README HTML to absolute ones. */
export function absolutizeReadme(html: string, ref: RepoRef, branch: string) {
  const raw = `https://raw.githubusercontent.com/${ref.owner}/${ref.name}/${branch}/`;
  const blob = `https://github.com/${ref.owner}/${ref.name}/blob/${branch}/`;
  return html
    .replace(/(<img[^>]+src=")(?!https?:|data:|\/\/)\.?\/?([^"]+)"/gi, `$1${raw}$2"`)
    .replace(/(<a[^>]+href=")(?!https?:|#|mailto:|\/\/)\.?\/?([^"]+)"/gi, `$1${blob}$2"`);
}

type RepoJson = {
  name: string;
  owner: { login: string };
  html_url: string;
  description: string | null;
  homepage: string | null;
  has_pages: boolean;
  created_at: string;
  pushed_at: string;
  stargazers_count: number;
  forks_count: number;
  topics?: string[];
  license: { spdx_id: string } | null;
  default_branch: string;
  private: boolean;
};

export async function fetchSnapshot(ref: RepoRef): Promise<GithubSnapshot> {
  const repo = await get<RepoJson>(`/repos/${ref.owner}/${ref.name}`);
  if (repo.private) throw new GithubError(403, "Private repositories are not shown");
  const [langs, readme] = await Promise.all([
    get<Record<string, number>>(`/repos/${ref.owner}/${ref.name}/languages`),
    fetch(`${API}/repos/${ref.owner}/${ref.name}/readme`, { headers: headers("application/vnd.github.html+json") })
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => ""),
  ]);
  const real = { owner: repo.owner.login, name: repo.name };
  return {
    ...real,
    url: repo.html_url,
    description: repo.description ?? "",
    homepage: repo.homepage || null,
    hasPages: repo.has_pages,
    createdAt: repo.created_at,
    pushedAt: repo.pushed_at,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    topics: repo.topics ?? [],
    license: repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : null,
    defaultBranch: repo.default_branch,
    languages: toPercentages(langs),
    readmeHtml: readme ? absolutizeReadme(readme, real, repo.default_branch) : "",
  };
}
