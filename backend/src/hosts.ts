/** Which hosts a project link may point to: never the portfolio itself, never a private network. */
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

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

/** Never fetched: loopback, private, link-local, CGNAT, documentation, benchmark, multicast, reserved. */
const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];
/**
 * IPv6 ranges that are private or can carry an arbitrary IPv4 address (so could reach a private one):
 * ::/96 (unspecified, loopback, IPv4-compatible), ::ffff:0:0:0/96 (SIIT), NAT64 (64:ff9b::/96, 64:ff9b:1::/48),
 * discard 100::/64, Teredo 2001::/32, documentation 2001:db8::/32, 6to4 2002::/16, ULA, link-/site-local, multicast.
 * IPv4-mapped ::ffff:0:0/96 is not listed: it is turned into its IPv4 address and checked against V4_BLOCKED.
 */
const V6_BLOCKED: [string, number][] = [
  ["::", 96], ["::ffff:0:0:0", 96], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 32],
  ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
];
const blocked = new BlockList();
for (const [net, bits] of V4_BLOCKED) blocked.addSubnet(net, bits, "ipv4");
for (const [net, bits] of V6_BLOCKED) blocked.addSubnet(net, bits, "ipv6");

/** An IPv6 address as its 8 numeric groups (any spelling: "::", embedded dotted IPv4, leading zeros); null if invalid. */
function ipv6Groups(a: string): number[] | null {
  if (isIP(a) !== 6) return null;
  let s = a;
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s)?.[1];
  if (v4) {
    const [w, x, y, z] = v4.split(".").map(Number);
    s = s.slice(0, -v4.length) + ((w << 8) | x).toString(16) + ":" + ((y << 8) | z).toString(16);
  }
  const [head, tail] = s.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const groups = tail === undefined ? h : [...h, ...Array(8 - h.length - t.length).fill("0"), ...t];
  return groups.length === 8 ? groups.map((g) => parseInt(g, 16)) : null;
}

/**
 * Loopback, private, link-local, CGNAT, unspecified, multicast/reserved (IPv4 and IPv6), in every spelling:
 * IPv4-mapped IPv6 ("::ffff:127.0.0.1", which the URL parser turns into "::ffff:7f00:1", "0:0:0:0:0:ffff:7f00:1")
 * is checked as the IPv4 address it carries.
 */
export function isPrivateAddress(ip: string): boolean {
  const a = ip.toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (isIP(a) === 4) return blocked.check(a, "ipv4");
  const g = ipv6Groups(a);
  if (!g) return false;
  // ::ffff:a.b.c.d (any spelling): the IPv4 address decides
  if (g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff)
    return blocked.check([g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join("."), "ipv4");
  return blocked.check(g.map((n) => n.toString(16)).join(":"), "ipv6");
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
