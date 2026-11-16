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
  /** private repo (read with GITHUB_TOKEN): its URL and README never reach the site */
  private: boolean;
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

/**
 * Private repos are refused unless `allowPrivate` (the owner ticked "private / coming soon"):
 * then only the metadata is read; the README is never fetched, so it can never reach the site.
 */
export async function fetchSnapshot(ref: RepoRef, { allowPrivate = false } = {}): Promise<GithubSnapshot> {
  const repo = await get<RepoJson>(`/repos/${ref.owner}/${ref.name}`);
  if (repo.private && !allowPrivate) throw new GithubError(403, "Private repository: tick “private / coming soon” to add it without a code link");
  const [langs, readme] = await Promise.all([
    get<Record<string, number>>(`/repos/${ref.owner}/${ref.name}/languages`),
    repo.private
      ? ""
      : fetch(`${API}/repos/${ref.owner}/${ref.name}/readme`, { headers: headers("application/vnd.github.html+json") })
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
    private: repo.private,
  };
}

/** First prose paragraph of a README (markdown), for the admin "description" suggestion. */
export function readmeExcerpt(md: string, max = 320) {
  const block = md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]+>/g, "")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .find((b) => b && !/^(#|!\[|\||-{3,}|>|\[!\[)/.test(b));
  if (!block) return "";
  const clean = block
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Raw README markdown ("" when missing). Admin preview only (private repos included, never stored). */
export async function fetchReadmeText(ref: RepoRef) {
  const r = await fetch(`${API}/repos/${ref.owner}/${ref.name}/readme`, { headers: headers("application/vnd.github.raw") }).catch(() => null);
  return r?.ok ? r.text() : "";
}

export type RepoListItem = {
  name: string;
  url: string;
  description: string;
  homepage: string | null;
  language: string | null;
  stars: number;
  pushedAt: string;
  private: boolean;
  fork: boolean;
};

/**
 * The owner's repos, newest push first. With a token that belongs to the owner, private repos
 * are included (they can be added as "coming soon" cards); otherwise only public ones.
 */
export async function listRepos(owner: string): Promise<RepoListItem[]> {
  type R = RepoJson & { fork: boolean; language: string | null };
  let list: R[] = [];
  if (process.env.GITHUB_TOKEN) {
    list = await get<R[]>("/user/repos?affiliation=owner&per_page=100&sort=pushed").catch(() => [] as R[]);
    list = list.filter((r) => r.owner.login.toLowerCase() === owner.toLowerCase());
  }
  if (!list.length) list = await get<R[]>(`/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=pushed`);
  return list.map((r) => ({
    name: r.name,
    url: r.html_url,
    description: r.description ?? "",
    homepage: r.homepage || null,
    language: r.language,
    stars: r.stargazers_count,
    pushedAt: r.pushed_at,
    private: r.private,
    fork: r.fork,
  }));
}
