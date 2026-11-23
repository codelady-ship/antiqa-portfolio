import type { Request } from "express";
import { isIP } from "node:net";

/**
 * Failed-login limiter. A login first RESERVES a slot on each of its keys atomically
 * (so a burst of parallel requests cannot all pass a read-only check), a successful
 * login gives the slots back, a failed one keeps them until the window expires.
 */
export interface LimitStore {
  /** atomically add 1 if the counter is below max; false = blocked. windowMs: life of a new counter (default 15 min) */
  reserve(key: string, max: number, windowMs?: number): Promise<boolean>;
  /** give one slot back */
  release(key: string): Promise<void>;
  /** forget the key */
  reset(key: string): Promise<void>;
}

export type Limit = readonly [key: string, max: number, windowMs?: number];

/** Reserve all limits or none. */
export async function reserveAll(store: LimitStore, limits: readonly Limit[]) {
  const taken: string[] = [];
  for (const [key, max, windowMs] of limits) {
    if (!(await store.reserve(key, max, windowMs))) {
      await Promise.all(taken.map((k) => store.release(k)));
      return false;
    }
    taken.push(key);
  }
  return true;
}

/** In-memory store with the same semantics, for tests. */
export function memoryStore(): LimitStore & { n: Map<string, number> } {
  const n = new Map<string, number>();
  return {
    n,
    async reserve(key, max) {
      await Promise.resolve(); // behave like an async store
      const v = n.get(key) ?? 0;
      if (v >= max) return false;
      n.set(key, v + 1);
      return true;
    },
    async release(key) {
      const v = n.get(key) ?? 0;
      if (v > 0) n.set(key, v - 1);
    },
    async reset(key) {
      n.delete(key);
    },
  };
}

/* ---------- which client a request comes from (the per-IP limiter key) ---------- */

/**
 * The client address the limits are counted under.
 *
 * On Vercel the request reaches this function through Vercel's edge (and, for the admin, first through
 * the frontend's `/api` rewrite). Vercel sets `x-vercel-forwarded-for` itself and overwrites any
 * `x-forwarded-for` / `x-vercel-forwarded-for` the browser sends, so these are not client-controlled.
 * If several hops are ever listed, the RIGHTMOST one is the hop Vercel itself saw: everything to its
 * left was written by someone else and could be made up to dodge the limit, so it is never used.
 *
 * Elsewhere (local dev, another host) `req.ip` honours `trust proxy` = 1, which is also the rightmost
 * `x-forwarded-for` hop (the one our single trusted proxy appended).
 *
 * If the platform ever shows the SAME address for every visitor (a proxy IP), the per-IP key becomes
 * shared; the other safeguards still hold: a browser that signed in before has its own key (device
 * cookie), and a password reset by e-mail clears the lockout (see app.ts).
 *
 * IPv6 addresses are cut to their /64 network: one home or phone line owns a whole /64 and could
 * otherwise rotate through addresses to get unlimited tries.
 */
export function clientIp(req: Request): string {
  const vercel = process.env.VERCEL ? rightmost(req.get("x-vercel-forwarded-for")) : "";
  return normalizeIp(vercel || req.ip || "") || "?";
}

const rightmost = (h: string | undefined) => (h ?? "").split(",").map((s) => s.trim()).filter(Boolean).at(-1) ?? "";

/** "::ffff:1.2.3.4" -> "1.2.3.4"; IPv6 -> its /64 prefix ("2001:db8:1:2::/64"); anything unparsable -> "" */
export function normalizeIp(raw: string): string {
  const ip = raw.trim().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const v4 = /^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip)?.[1];
  if (v4) return isIP(v4) === 4 ? v4 : "";
  if (isIP(ip) !== 6) return "";
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const a = head ? head.split(":") : [];
  const b = tail ? tail.split(":") : [];
  // an embedded IPv4 tail ("::1.2.3.4") counts as two groups; it never reaches the first four
  const missing = 8 - a.length - b.length - (b.at(-1)?.includes(".") ? 1 : 0);
  const groups = [...a, ...(ip.includes("::") ? Array(missing).fill("0") : []), ...b];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}
