import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { type AuthStore, checkCredentials, COOKIE, deviceId, isAdmin, issueDevice, issueSession, mongoAuth, requireAdminWith } from "./auth.js";
import { MailError, type Mailer, resendMailer } from "./mailer.js";
import { BCRYPT_COST, changedMail, hashToken, newToken, passwordProblem, RESET_TTL_MS, resetLink, resetMail, resetSiteUrl, safeEqual } from "./reset.js";
import { type Limit, type LimitStore, reserveAll } from "./limiter.js";
import { isValidObjectId } from "mongoose";
import { connectDb, Cv, LoginAttempt, Profile, Project } from "./models.js";
import { demoUrl, fetchReadmeText, fetchSnapshot, GithubError, listRepos, parseRepoUrl, readmeExcerpt } from "./services/github.js";
import { resolveLive } from "./services/live.js";

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const loc = z.object({ az: z.string().max(4000).default(""), en: z.string().max(4000).default("") });
// only https links: these end up in href, iframe src and JSON-LD
const httpsUrl = z.string().url().max(500).refine((u) => /^https:\/\//i.test(u), "https only");
const url = z.union([z.literal(""), httpsUrl]);

export const ProfileInput = z.object({
  name: z.string().min(1).max(120),
  initials: z.string().max(4).default(""),
  roles: z.object({ az: z.array(z.string().max(80)).max(8), en: z.array(z.string().max(80)).max(8) }),
  tagline: loc,
  about: loc,
  location: loc,
  openToWork: z.boolean(),
  skills: z.array(z.string().max(40)).max(40),
  education: z.array(z.object({ title: loc, place: z.string().max(120), period: z.string().max(60) })).max(10).default([]),
  experience: z
    .array(z.object({ title: loc, place: z.string().max(120), period: loc, summary: loc }))
    .max(10)
    .default([]),
  contacts: z.object({
    email: z.union([z.literal(""), z.string().email()]),
    phone: z.string().max(30),
    whatsapp: z.string().regex(/^\d{0,15}$/),
    telegram: z.string().regex(/^[A-Za-z0-9_]{0,32}$/),
    linkedin: url,
    github: url,
    instagram: z.string().regex(/^[A-Za-z0-9._]{0,30}$/),
  }),
  // other socials: short label + https link, a handful
  socials: z.array(z.object({ label: z.string().trim().min(1).max(40), url: httpsUrl })).max(6).optional(),
});

// extra card links (e.g. related repos): https only, short labels, a handful per project
export const ProjectLinks = z.array(z.object({ label: z.string().trim().min(1).max(60), url: httpsUrl })).max(6);

export const ProjectPatch = z.object({
  title: z.string().max(120).optional(),
  summary: loc.optional(),
  demoOverride: url.optional(),
  backendUrl: url.optional(),
  adminUrl: url.optional(),
  // a public demo login at most ("demo@… / demo"); one short line, no markup
  adminHint: z.string().trim().max(120).regex(/^[^<>]*$/, "no markup").optional(),
  featured: z.boolean().optional(),
  hidden: z.boolean().optional(),
  fullStack: z.boolean().optional(),
  order: z.number().int().min(-1000).max(1000).optional(),
  links: ProjectLinks.optional(),
  comingSoon: z.boolean().optional(),
  demoOff: z.boolean().optional(),
});
// POST /api/projects: the repo plus the fields the admin form pre-filled from GitHub.
// allowPrivate = the owner ticked "private / coming soon" for a private repo.
const ProjectCreate = ProjectPatch.extend({ repoUrl: z.string().max(300), allowPrivate: z.boolean().optional() });
const PRIVATE_MSG = "Private repository: tick “private / coming soon” to add it without a code link";

const README_ALLOWED: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "picture", "source", "details", "summary"]),
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    source: ["srcset", "media"],
    "*": ["align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // README links open in a new tab so the portfolio (and the demo modal) stays open
  transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }) },
};

/** Sanitize README HTML. Idempotent, so it is also applied on read (older stored HTML gets the link fix without a re-sync). */
export const sanitizeReadme = (html: string) => sanitizeHtml(html, README_ALLOWED);

/** Public shape of a project (no internal fields). */
export function present(p: any, admin = false) {
  const gh = p.gh ?? {};
  const priv = !!p.privateRepo;
  return {
    id: String(p._id),
    owner: p.owner,
    name: p.name,
    title: p.title || p.name.replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim(),
    summary: p.summary ?? { az: "", en: "" },
    description: gh.description ?? "",
    // private repo: no code link anywhere on the site ("" = hidden)
    repoUrl: priv ? "" : gh.url || p.repoUrl,
    backendUrl: p.backendUrl || null,
    adminUrl: p.adminUrl || null,
    adminHint: p.adminUrl ? p.adminHint || "" : "",
    // false: the admin panel cannot be framed, the modal shows an "open in a new tab" card
    ...(p.adminUrl && { adminFrame: !p.adminNoFrame }),
    demoUrl: liveUrl(p),
    // false: the live site cannot be framed, the Demo tab shows an "open in a new tab" card
    ...(liveUrl(p) && { demoFrame: !p.demoNoFrame }),
    createdAt: gh.createdAt ?? null,
    pushedAt: gh.pushedAt ?? null,
    stars: gh.stars ?? 0,
    forks: gh.forks ?? 0,
    topics: gh.topics ?? [],
    license: gh.license ?? null,
    languages: gh.languages ?? [],
    featured: !!p.featured,
    // only when set (seed script / admin): unset lets the site fall back to its own list
    ...(typeof p.fullStack === "boolean" && { fullStack: p.fullStack }),
    comingSoon: !!p.comingSoon,
    privateRepo: priv,
    ...(admin && { demoOff: !!p.demoOff }),
    hidden: !!p.hidden,
    order: p.order ?? 0,
    links: (p.links ?? []).map((l: { label?: string; url?: string }) => ({ label: l.label ?? "", url: l.url ?? "" })),
    syncedAt: p.syncedAt ?? null,
    // admin edits the raw overrides, not the computed values
    ...(admin && { syncError: p.syncError || null, titleRaw: p.title || "", demoOverride: p.demoOverride || "" }),
  };
}

/**
 * Does this page refuse to be shown in an iframe on the portfolio? (X-Frame-Options DENY/SAMEORIGIN,
 * or a CSP frame-ancestors list that allows neither "*" nor every portfolio origin). Unknown
 * (network error) = framable: the modal still has its open-in-new-tab link.
 */
const PORTFOLIO_ORIGINS = ["https://antiqa-portfolio.vercel.app", "https://antiqacode.vercel.app"];

/** Does one frame-ancestors source ("https://x.dev", "https://*.vercel.app", "https:", "*") match the origin? */
function sourceMatches(src: string, origin: string): boolean {
  const s = src.replace(/\/+$/, "").toLowerCase();
  if (s === "*" || s === "https:") return true;
  const m = /^(https?:\/\/)?(\*\.)?([^/:]+)$/.exec(s);
  if (!m) return false;
  const host = new URL(origin).hostname;
  if (m[1] && !origin.startsWith(m[1])) return false;
  return m[2] ? host.endsWith(`.${m[3]}`) : host === m[3];
}

export async function frameBlocked(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000) });
    void r.body?.cancel();
    const xfo = (r.headers.get("x-frame-options") ?? "").toLowerCase();
    if (/deny|sameorigin/.test(xfo)) return true;
    const fa = /frame-ancestors([^;]*)/i.exec(r.headers.get("content-security-policy") ?? "")?.[1]?.trim();
    if (fa === undefined) return false;
    const sources = fa.split(/\s+/).filter(Boolean);
    // framable only if the portfolio can embed it under each of its domains
    return !PORTFOLIO_ORIGINS.every((o) => sources.some((s) => sourceMatches(s, o)));
  } catch {
    return false;
  }
}

/** The live link the site shows (null: coming soon, switched off or none). */
function liveUrl(p: any): string | null {
  const gh = p.gh ?? {};
  return p.comingSoon || p.demoOff ? null : demoUrl({ owner: p.owner, name: p.name, homepage: gh.homepage ?? null, hasPages: !!gh.hasPages }, p.demoOverride);
}

/** Re-checks whether the live demo and the admin panel can be framed (after their links change, and on every sync). */
export async function checkFrames(p: any) {
  const live = liveUrl(p);
  [p.demoNoFrame, p.adminNoFrame] = await Promise.all([live ? frameBlocked(live) : false, p.adminUrl ? frameBlocked(p.adminUrl) : false]);
}

/** Refreshes and saves a project's GitHub snapshot (POST /api/projects, sync, scripts). Never throws on GitHub errors: sets syncError. */
export async function sync(p: any) {
  try {
    // private repos are read too (metadata only, no README), so a repo that turns private loses its code link
    const { private: priv, ...s } = await fetchSnapshot({ owner: p.owner, name: p.name }, { allowPrivate: true });
    p.gh = { ...s, readmeHtml: priv ? "" : sanitizeReadme(s.readmeHtml) };
    p.privateRepo = priv;
    p.owner = s.owner;
    p.name = s.name;
    p.syncError = "";
  } catch (e) {
    p.syncError = e instanceof Error ? e.message : "sync failed";
  }
  // after the snapshot: the live link may come from the (new) GitHub homepage
  await checkFrames(p);
  p.syncedAt = new Date();
  return p.save();
}

/** Failed-login counter in Mongo (shared by all serverless instances, TTL 15 min). */
const WINDOW = 15 * 60_000;
const MAX_PER_CLIENT = 5;
const MAX_GLOBAL = 100;

const mongoLimits: LimitStore = {
  async reserve(key, max, windowMs = WINDOW) {
    await connectDb();
    const filter = { _id: key, n: { $lt: max } };
    try {
      return !!(await LoginAttempt.findOneAndUpdate(
        filter,
        { $inc: { n: 1 }, $setOnInsert: { expireAt: new Date(Date.now() + windowMs) } },
        { upsert: true, new: true },
      ).lean());
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e;
      // E11000: the key exists and is full (the upsert tried to insert a duplicate _id),
      // or a parallel first request created it a moment ago: try once more without upsert
      return !!(await LoginAttempt.findOneAndUpdate(filter, { $inc: { n: 1 } }, { new: true }).lean());
    }
  },
  async release(key) {
    await connectDb();
    await LoginAttempt.updateOne({ _id: key, n: { $gt: 0 } }, { $inc: { n: -1 } });
  },
  async reset(key) {
    await connectDb();
    await LoginAttempt.deleteOne({ _id: key });
  },
};

/**
 * Known device (signed cookie from an earlier login): its own key, no global cap.
 * Otherwise per IP + global. req.ip honours "trust proxy" (the hop the platform proxy added);
 * the leftmost X-Forwarded-For entry is client-controlled and is not used.
 */
function loginLimits(req: Request, dev: string | null): Limit[] {
  return dev ? [[`dev:${dev}`, MAX_PER_CLIENT]] : [[`ip:${req.ip || "?"}`, MAX_PER_CLIENT], ["global", MAX_GLOBAL]];
}

/* ---------- password reset by e-mail: limits (counters live in the login limiter's collection, 1 h) ---------- */
const HOUR = 60 * 60_000;
/** "send me a link" requests of one client / of everybody who is not a known device */
const RESET_REQ_PER_CLIENT = 3;
const RESET_REQ_GLOBAL = 20;
/** reset mails really sent, whoever asked: the hard cap on what can land in her inbox */
const RESET_MAILS = 5;
/** wrong / expired tokens of one client / of everybody */
const RESET_TRY_PER_CLIENT = 10;
const RESET_TRY_GLOBAL = 100;
/** every "send me a link" answer leaves at this moment, whether a mail went out or not */
const RESET_ANSWER_MS = 2000;

function resetLimits(req: Request, dev: string | null, kind: "req" | "try"): Limit[] {
  const [perClient, global] = kind === "req" ? [RESET_REQ_PER_CLIENT, RESET_REQ_GLOBAL] : [RESET_TRY_PER_CLIENT, RESET_TRY_GLOBAL];
  return dev
    ? [[`reset-${kind}:dev:${dev}`, perClient, HOUR]]
    : [[`reset-${kind}:ip:${req.ip || "?"}`, perClient, HOUR], [`reset-${kind}:global`, global, HOUR]];
}

/** Lets work finish after the answer was sent on Vercel (the platform's waitUntil); false = not available, await it instead. */
function keepAlive(work: Promise<unknown>): boolean {
  const ctx = (globalThis as Record<symbol, any>)[Symbol.for("@vercel/request-context")]?.get?.();
  if (typeof ctx?.waitUntil !== "function") return false;
  ctx.waitUntil(work);
  return true;
}

/** Server log line of the reset flow: never a token, a password, an address or a key. */
const resetLog = (what: string, e?: unknown) =>
  console.error(`[password-reset] ${what}${e === undefined ? "" : `: ${e instanceof MailError ? e.message : e instanceof Error ? e.name : "error"}`}`);

export interface AppDeps {
  auth: AuthStore;
  limits: LimitStore;
  mailer: Mailer;
  /** ms after which a reset request is answered (tests: 0) */
  resetAnswerMs: number;
}

export function createApp(deps: Partial<AppDeps> = {}) {
  const { auth = mongoAuth, limits = mongoLimits, mailer = resendMailer, resetAnswerMs = RESET_ANSWER_MS } = deps;
  const admin = (req: Request) => isAdmin(req, auth);
  const requireAdmin = requireAdminWith(auth);
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  // state-changing requests must be JSON (blocks simple cross-site form posts) except the CV upload
  app.use((req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !req.path.startsWith("/api/cv/")) {
      const hasBody = Number(req.headers["content-length"] || 0) > 0 || !!req.headers["transfer-encoding"];
      if (hasBody && !req.is("application/json")) return res.status(415).json({ error: "json only" });
    }
    next();
  });

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  /* ---------- auth ---------- */
  app.post(
    "/api/auth/login",
    wrap(async (req, res) => {
      const { email, password } = z.object({ email: z.string().max(200), password: z.string().max(200) }).parse(req.body);
      const dev = deviceId(req);
      const keys = loginLimits(req, dev);
      // the slot is taken BEFORE the slow bcrypt check, so parallel requests cannot all slip through
      if (!(await reserveAll(limits, keys))) return res.status(429).json({ error: "too many attempts" });
      const ok = await checkCredentials(email, password, auth);
      if (!ok) return res.status(401).json({ error: "invalid credentials" });
      // success: forget this client's failures and give back the global slot (only failures count)
      await Promise.all(keys.map(([k]) => (k === "global" ? limits.release(k) : limits.reset(k))));
      issueSession(res, ok.sessionVersion);
      issueDevice(res, dev ?? randomBytes(16).toString("hex"));
      res.json({ ok: true });
    }),
  );
  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie(COOKIE, { path: "/" });
    res.json({ ok: true });
  });
  app.get(
    "/api/auth/me",
    wrap(async (req, res) => res.json({ admin: await admin(req) })),
  );

  /* ---------- forgotten password: a single-use link mailed to ADMIN_EMAIL ---------- */
  const adminEmail = () => (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

  /** Mails a fresh link if the address is the admin's and mail is set up. Tells the caller nothing. */
  async function sendResetLink(email: string, locale: "az" | "en") {
    const problem = mailer.problem();
    if (problem) return resetLog(`no mail sent, ${problem}`);
    const site = resetSiteUrl(PORTFOLIO_ORIGINS);
    if (!site) return resetLog("no mail sent, SITE_URL is not one of the site's own addresses");
    const to = adminEmail();
    if (!to || !safeEqual(email.trim().toLowerCase(), to)) return;
    if (!(await limits.reserve("reset-mail", RESET_MAILS, HOUR))) return resetLog("no mail sent, hourly mail cap reached");
    const { token, hash } = newToken();
    // replaces the pending token: an earlier link stops working
    await auth.setReset(hash, new Date(Date.now() + RESET_TTL_MS));
    await mailer.send(resetMail(resetLink(site, locale, token)));
  }

  app.post(
    "/api/auth/reset/request",
    wrap(async (req, res) => {
      const { email, locale } = z.object({ email: z.string().max(200), locale: z.enum(["az", "en"]).default("az") }).parse(req.body);
      res.setHeader("Cache-Control", "no-store");
      // by client only, before the address is looked at: a 429 says nothing about the address
      if (!(await reserveAll(limits, resetLimits(req, deviceId(req), "req")))) return res.status(429).json({ error: "too many attempts" });
      let done = false;
      const work = sendResetLink(email, locale)
        .catch((e) => resetLog("request failed", e))
        .finally(() => (done = true));
      // one answer at one moment for every address, sent or not, configured or not
      await new Promise((r) => setTimeout(r, resetAnswerMs));
      if (!done && !keepAlive(work)) await work;
      res.json({ ok: true });
    }),
  );

  /** Is this the pending, unexpired token? Compared in constant time against the stored hash. */
  async function tokenPending(token: string) {
    const { reset } = await auth.get();
    const same = safeEqual(hashToken(token), reset?.hash ?? "");
    return same && !!reset && reset.expiresAt.getTime() > Date.now();
  }
  const Token = z.string().min(20).max(200);

  // the reset page asks this first, to show "link expired" instead of a form that cannot work
  app.post(
    "/api/auth/reset/verify",
    wrap(async (req, res) => {
      const { token } = z.object({ token: Token }).parse(req.body);
      res.setHeader("Cache-Control", "no-store");
      const keys = resetLimits(req, deviceId(req), "try");
      if (!(await reserveAll(limits, keys))) return res.status(429).json({ error: "too many attempts" });
      const valid = await tokenPending(token);
      // only wrong tokens count
      if (valid) await Promise.all(keys.map(([k]) => limits.release(k)));
      res.json({ valid });
    }),
  );

  app.post(
    "/api/auth/reset/confirm",
    wrap(async (req, res) => {
      const { token, password, confirm } = z.object({ token: Token, password: z.string().max(200), confirm: z.string().max(200) }).parse(req.body);
      res.setHeader("Cache-Control", "no-store");
      const keys = resetLimits(req, deviceId(req), "try");
      if (!(await reserveAll(limits, keys))) return res.status(429).json({ error: "too many attempts" });
      if (!(await tokenPending(token))) return res.status(400).json({ error: "invalid token" });
      const release = () => Promise.all(keys.map(([k]) => limits.release(k)));
      const weak = passwordProblem(password, confirm, adminEmail());
      if (weak) {
        await release();
        return res.status(400).json({ error: `weak password: ${weak}`, reason: weak });
      }
      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      // one atomic update: of two parallel submits (or a replay) only one can win
      if (!(await auth.consumeReset(hashToken(token), new Date(), passwordHash))) return res.status(400).json({ error: "invalid token" });
      await release();
      // every session is signed out (session version + 1); this browser's cookie goes too
      res.clearCookie(COOKIE, { path: "/" });
      if (!mailer.problem()) await mailer.send(changedMail()).catch((e) => resetLog("password changed, notice not sent", e));
      res.json({ ok: true });
    }),
  );

  // admin-only GitHub helpers: refuse before touching the database
  app.use("/api/github", requireAdmin);

  app.use("/api", (_req, _res, next) => {
    connectDb().then(() => next(), next);
  });

  /* ---------- profile ---------- */
  app.get(
    "/api/profile",
    wrap(async (_req, res) => {
      const p = await Profile.findById("main").lean();
      const cvs = await Cv.find({}, { _id: 1, updatedAt: 1 }).lean();
      res.json({ ...(p ?? {}), cv: Object.fromEntries(cvs.map((c: any) => [c._id, `/api/cv/${c._id}?v=${new Date(c.updatedAt ?? 0).getTime()}`])) });
    }),
  );
  app.put(
    "/api/profile",
    requireAdmin,
    wrap(async (req, res) => {
      const data = ProfileInput.parse(req.body);
      const p = await Profile.findByIdAndUpdate("main", data, { upsert: true, new: true, runValidators: true }).lean();
      res.json(p);
    }),
  );

  /* ---------- CV ---------- */
  app.get(
    "/api/cv/:lang",
    wrap(async (req, res) => {
      const lang = req.params.lang === "en" ? "en" : "az";
      const cv: any = (await Cv.findById(lang).lean()) ?? (await Cv.findOne().lean());
      if (!cv) return res.status(404).json({ error: "no cv" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${String(cv.fileName || "cv.pdf").replace(/[^\w.-]/g, "_")}"`);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(Buffer.from(cv.data.buffer ?? cv.data));
    }),
  );
  app.put(
    "/api/cv/:lang",
    requireAdmin,
    express.raw({ type: "application/pdf", limit: "2mb" }),
    wrap(async (req, res) => {
      const lang = z.enum(["az", "en"]).parse(req.params.lang);
      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.subarray(0, 5).toString() !== "%PDF-") return res.status(400).json({ error: "pdf only" });
      let fileName = `cv-${lang}.pdf`;
      try {
        fileName = decodeURIComponent(req.get("x-file-name") || fileName).slice(0, 100);
      } catch {
        /* malformed header: keep default */
      }
      await Cv.findByIdAndUpdate(lang, { fileName, data: body, size: body.length }, { upsert: true });
      res.json({ ok: true, size: body.length });
    }),
  );

  /* ---------- projects ---------- */
  app.get(
    "/api/projects",
    wrap(async (req, res) => {
      const all = req.query.all === "1" && (await admin(req));
      const list = await Project.find(all ? {} : { hidden: false }, { "gh.readmeHtml": 0 })
        .sort({ featured: -1, order: -1, "gh.createdAt": -1 })
        .lean();
      // no CDN cache: Next caches the list itself and must see admin changes right after revalidation
      res.setHeader("Cache-Control", "private, no-store");
      res.json(list.map((p) => present(p, all)));
    }),
  );
  app.get(
    "/api/projects/:owner/:name/readme",
    wrap(async (req, res) => {
      const p: any = await Project.findOne({ owner: req.params.owner, name: req.params.name, hidden: false, privateRepo: { $ne: true } }, { "gh.readmeHtml": 1 })
        .collation({ locale: "en", strength: 2 })
        .lean();
      if (!p) return res.status(404).json({ error: "not found" });
      res.setHeader("Cache-Control", "public, s-maxage=3600");
      res.json({ html: sanitizeReadme(p.gh?.readmeHtml ?? "") });
    }),
  );
  app.post(
    "/api/projects",
    requireAdmin,
    wrap(async (req, res) => {
      const { repoUrl, allowPrivate, ...patch } = ProjectCreate.parse(req.body);
      const ref = parseRepoUrl(repoUrl);
      if (!ref) return res.status(400).json({ error: "Not a GitHub repository URL" });
      const exists = await Project.findOne(ref).collation({ locale: "en", strength: 2 });
      if (exists) return res.status(409).json({ error: "Already added", project: present(exists, true) });
      const p = new Project({ ...ref, repoUrl: `https://github.com/${ref.owner}/${ref.name}`, ...patch });
      await sync(p);
      const refuse = p.syncError || (p.privateRepo && !allowPrivate ? PRIVATE_MSG : "");
      if (refuse) {
        await p.deleteOne();
        return res.status(422).json({ error: refuse });
      }
      res.status(201).json(present(p, true));
    }),
  );
  app.patch(
    "/api/projects/:id",
    requireAdmin,
    wrap(async (req, res) => {
      if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: "not found" });
      const patch = ProjectPatch.parse(req.body);
      const p = await Project.findByIdAndUpdate(req.params.id, patch, { new: true });
      if (!p) return res.status(404).json({ error: "not found" });
      if (patch.adminUrl !== undefined || patch.demoOverride !== undefined || patch.comingSoon !== undefined || patch.demoOff !== undefined) {
        await checkFrames(p);
        await p.save();
      }
      res.json(present(p, true));
    }),
  );
  app.delete(
    "/api/projects/:id",
    requireAdmin,
    wrap(async (req, res) => {
      if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: "not found" });
      await Project.findByIdAndDelete(req.params.id);
      res.status(204).end();
    }),
  );
  /* ---------- admin: pick one of her repos / pre-fill the add form from GitHub ---------- */
  const ghOwner = async () => {
    if (process.env.GITHUB_OWNER) return process.env.GITHUB_OWNER;
    const prof: any = await Profile.findById("main", { "contacts.github": 1 }).lean();
    return String(prof?.contacts?.github ?? "").match(/github\.com\/([A-Za-z0-9-]{1,39})/)?.[1] ?? "codelady-ship";
  };
  app.get(
    "/api/github/repos",
    requireAdmin,
    wrap(async (_req, res) => {
      const owner = await ghOwner();
      const [repos, added] = await Promise.all([listRepos(owner), Project.find({}, { owner: 1, name: 1 }).lean()]);
      const have = new Set(added.map((p: any) => `${p.owner}/${p.name}`.toLowerCase()));
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ owner, repos: repos.map((r) => ({ ...r, added: have.has(`${owner}/${r.name}`.toLowerCase()) })) });
    }),
  );
  app.get(
    "/api/github/preview",
    requireAdmin,
    wrap(async (req, res) => {
      const ref = parseRepoUrl(z.string().max(300).parse(req.query.url ?? ""));
      if (!ref) return res.status(400).json({ error: "Not a GitHub repository URL" });
      const s = await fetchSnapshot(ref, { allowPrivate: true });
      const [live, readme, exists] = await Promise.all([
        resolveLive(s),
        s.description ? "" : fetchReadmeText(ref),
        Project.exists({ owner: s.owner, name: s.name }).collation({ locale: "en", strength: 2 }),
      ]);
      res.setHeader("Cache-Control", "private, no-store");
      res.json({
        owner: s.owner,
        name: s.name,
        repoUrl: s.url,
        title: s.name.replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim(),
        description: s.description || readmeExcerpt(readme),
        languages: s.languages,
        topics: s.topics,
        stars: s.stars,
        forks: s.forks,
        createdAt: s.createdAt,
        pushedAt: s.pushedAt,
        private: s.private,
        live,
        exists: !!exists,
      });
    }),
  );

  const syncAll = wrap(async (req, res) => {
      // admin, or Vercel Cron with CRON_SECRET
      const cron = process.env.CRON_SECRET && req.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
      if (!cron && !(await admin(req))) return res.status(401).json({ error: "unauthorized" });
      const list = await Project.find();
      // 4 at a time: fast enough for the function timeout, gentle on the GitHub limit
      for (let i = 0; i < list.length; i += 4) await Promise.allSettled(list.slice(i, i + 4).map(sync));
      res.json({ synced: list.length, errors: list.filter((p: any) => p.syncError).map((p: any) => `${p.name}: ${p.syncError}`) });
  });
  app.post("/api/projects/sync", syncAll);
  app.get("/api/projects/sync", syncAll); // Vercel Cron uses GET

  /* ---------- errors ---------- */
  app.use((_req: Request, res: Response) => res.status(404).json({ error: "not found" }));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "invalid input", issues: err.issues });
    if (err instanceof GithubError) return res.status(err.status === 404 ? 404 : 502).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "server error" });
  });
  return app;
}
