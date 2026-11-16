/**
 * Finds the live link of a repo for the admin "add from GitHub" form, in this order:
 *   1. the repo's homepage field (what the card has always used)
 *   2. Vercel API (only when VERCEL_TOKEN is set): the production domain of the project linked
 *      to this repo, or of the project with the repo's name
 *   3. a probe of https://<repo-name>.vercel.app — unverified: the name may belong to someone
 *      else, so the admin shows it as a suggestion to check, never saves it silently
 *   4. GitHub Pages, when the repo has Pages turned on
 * Every request has a short timeout; nothing here throws.
 */
import type { GithubSnapshot } from "./github.js";

export type LiveSource = "homepage" | "vercel" | "vercel-probe" | "pages";
export type Live = { url: string | null; source: LiveSource | null; verified: boolean };

type Fetch = typeof fetch;
const TIMEOUT = 4000;

/** Vercel project slug for a repo name: lower case, letters/digits/dashes, ≤ 52 chars. */
export function vercelSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52)
    .replace(/-+$/, "");
}

const https = (u: string) => (/^https?:\/\//i.test(u) ? u.replace(/^http:/i, "https:") : `https://${u}`);

async function timed(f: Fetch, url: string, init: RequestInit = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    return await f(url, { ...init, signal: ctl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

type VercelProject = {
  name: string;
  link?: { type?: string; org?: string; repo?: string };
  targets?: { production?: { alias?: string[] } };
  alias?: { domain: string }[];
};

function productionDomain(p: VercelProject) {
  // prefer a custom or short alias over the long per-deployment one
  const aliases = [...(p.targets?.production?.alias ?? []), ...(p.alias ?? []).map((a) => a.domain)];
  return aliases.find((a) => !/-[a-z0-9]{9}-[^.]+\.vercel\.app$/.test(a)) ?? aliases[0] ?? `${p.name}.vercel.app`;
}

async function fromVercelApi(s: Pick<GithubSnapshot, "owner" | "name">, token: string, team: string | undefined, f: Fetch) {
  const q = team ? `&teamId=${encodeURIComponent(team)}` : "";
  const h = { headers: { Authorization: `Bearer ${token}` } };
  // 1) a project linked to this exact repo
  const byRepo = await timed(f, `https://api.vercel.com/v10/projects?repoUrl=${encodeURIComponent(`https://github.com/${s.owner}/${s.name}`)}${q}`, h);
  if (byRepo?.ok) {
    const j = (await byRepo.json().catch(() => null)) as { projects?: VercelProject[] } | null;
    const p = j?.projects?.find((x) => x.link?.repo?.toLowerCase() === s.name.toLowerCase()) ?? j?.projects?.[0];
    if (p) return productionDomain(p);
  }
  // 2) a project with the repo's name (CLI deploys have no Git link)
  const byName = await timed(f, `https://api.vercel.com/v9/projects/${encodeURIComponent(vercelSlug(s.name))}${q ? `?${q.slice(1)}` : ""}`, h);
  if (byName?.ok) {
    const p = (await byName.json().catch(() => null)) as VercelProject | null;
    if (p?.name) return productionDomain(p);
  }
  return null;
}

export async function resolveLive(
  s: Pick<GithubSnapshot, "owner" | "name" | "homepage" | "hasPages">,
  { fetchImpl = fetch, env = process.env }: { fetchImpl?: Fetch; env?: Record<string, string | undefined> } = {},
): Promise<Live> {
  if (s.homepage) return { url: https(s.homepage), source: "homepage", verified: true };

  if (env.VERCEL_TOKEN) {
    const d = await fromVercelApi(s, env.VERCEL_TOKEN, env.VERCEL_TEAM_ID, fetchImpl);
    if (d) return { url: `https://${d}`, source: "vercel", verified: true };
  }

  const slug = vercelSlug(s.name);
  if (slug) {
    const url = `https://${slug}.vercel.app/`;
    const r = await timed(fetchImpl, url, { method: "HEAD", redirect: "manual" });
    // 2xx/3xx = something is deployed there (Vercel answers 404 DEPLOYMENT_NOT_FOUND otherwise)
    if (r && r.status < 400) return { url, source: "vercel-probe", verified: false };
  }

  if (s.hasPages) {
    const url =
      s.name.toLowerCase() === `${s.owner.toLowerCase()}.github.io` ? `https://${s.owner}.github.io/` : `https://${s.owner}.github.io/${s.name}/`;
    return { url, source: "pages", verified: true };
  }
  return { url: null, source: null, verified: false };
}
