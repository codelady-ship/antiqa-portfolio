/** Which hosts a project link may point to: never the portfolio itself, never a private network. */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** The portfolio's production addresses (also the allowed reset-link sites and frame-ancestors check). */
export const PORTFOLIO_ORIGINS = ["https://antiqa-portfolio.vercel.app", "https://antiqacode.vercel.app"];

/** Vercel preview / branch URLs of the portfolio projects: antiqa-portfolio-git-<branch>-<team>.vercel.app etc. */
const OWN_PREVIEW = /^(antiqa-portfolio|antiqacode)(-[a-z0-9-]+)?\.vercel\.app$/;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.+$/, "");
  } catch {
    return "";
  }
};

/**
 * Is this URL the portfolio itself (production, a Vercel preview, or SITE_URL)? The demo modal frames
 * demo/admin links with allow-scripts + allow-same-origin, so such a page would run with the
 * portfolio's own origin inside the portfolio.
 */
export function isOwnHost(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  const own = [...PORTFOLIO_ORIGINS, process.env.SITE_URL ?? ""].map(hostOf).filter(Boolean);
  return own.includes(host) || OWN_PREVIEW.test(host);
}

/** Loopback, private, link-local, CGNAT, unspecified, multicast/reserved (IPv4 and IPv6). */
export function isPrivateAddress(ip: string): boolean {
  const a = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a)?.[1];
  if (mapped) return isPrivateAddress(mapped);
  if (isIP(a) === 4) {
    const [x, y] = a.split(".").map(Number);
    return (
      x === 0 || x === 10 || x === 127 || x >= 224 ||
      (x === 100 && y >= 64 && y <= 127) ||
      (x === 169 && y === 254) ||
      (x === 172 && y >= 16 && y <= 31) ||
      (x === 192 && y === 168) ||
      (x === 198 && (y === 18 || y === 19))
    );
  }
  if (isIP(a) === 6) {
    return a === "::" || a === "::1" || /^f[cd]/.test(a) || /^fe[89ab]/.test(a) || /^ff/.test(a) || a.startsWith("64:ff9b:");
  }
  return false;
}

export type Lookup = (host: string) => Promise<string[]>;
export const dnsLookup: Lookup = async (host) => (await lookup(host, { all: true, verbatim: true })).map((r) => r.address);

/**
 * May the server fetch this URL? "public": http(s) on a public host. "private": not http(s), an IP in a
 * private range, localhost / *.local / *.internal, or a name that resolves to a private address: never
 * fetched. "unresolved": the name does not resolve right now (not fetched either; the caller decides).
 */
export async function hostKind(url: string, resolve: Lookup = dnsLookup): Promise<"public" | "private" | "unresolved"> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "private";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "private";
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  if (!host || host === "localhost" || /\.(localhost|local|internal|lan|home\.arpa)$/.test(host)) return "private";
  if (isIP(host)) return isPrivateAddress(host) ? "private" : "public";
  try {
    const addrs = await resolve(host);
    if (!addrs.length) return "unresolved";
    return addrs.some(isPrivateAddress) ? "private" : "public";
  } catch {
    return "unresolved";
  }
}
