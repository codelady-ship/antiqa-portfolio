import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { checkCredentials, COOKIE, deviceId, isAdmin, issueDevice, issueSession, requireAdmin } from "./auth.js";
import { type Limit, type LimitStore, reserveAll } from "./limiter.js";
import { isValidObjectId } from "mongoose";
import { connectDb, Cv, LoginAttempt, Profile, Project } from "./models.js";
import { demoUrl, fetchSnapshot, GithubError, parseRepoUrl } from "./services/github.js";

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
  contacts: z.object({
    email: z.union([z.literal(""), z.string().email()]),
    phone: z.string().max(30),
    whatsapp: z.string().regex(/^\d{0,15}$/),
    telegram: z.string().regex(/^[A-Za-z0-9_]{0,32}$/),
    linkedin: url,
    github: url,
    instagram: z.string().regex(/^[A-Za-z0-9._]{0,30}$/),
  }),
});

// extra card links (e.g. related repos): https only, short labels, a handful per project
export const ProjectLinks = z.array(z.object({ label: z.string().trim().min(1).max(60), url: httpsUrl })).max(6);

const ProjectCreate = z.object({ repoUrl: z.string().max(300) });
export const ProjectPatch = z.object({
  title: z.string().max(120).optional(),
  summary: loc.optional(),
  demoOverride: url.optional(),
  backendUrl: url.optional(),
  featured: z.boolean().optional(),
  hidden: z.boolean().optional(),
  order: z.number().int().min(-1000).max(1000).optional(),
  links: ProjectLinks.optional(),
});

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
  return {
    id: String(p._id),
    owner: p.owner,
    name: p.name,
    title: p.title || p.name.replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim(),
    summary: p.summary ?? { az: "", en: "" },
    description: gh.description ?? "",
    repoUrl: gh.url || p.repoUrl,
    backendUrl: p.backendUrl || null,
    demoUrl: demoUrl({ owner: p.owner, name: p.name, homepage: gh.homepage ?? null, hasPages: !!gh.hasPages }, p.demoOverride),
    createdAt: gh.createdAt ?? null,
    pushedAt: gh.pushedAt ?? null,
    stars: gh.stars ?? 0,
    forks: gh.forks ?? 0,
    topics: gh.topics ?? [],
    license: gh.license ?? null,
    languages: gh.languages ?? [],
    featured: !!p.featured,
    hidden: !!p.hidden,
    order: p.order ?? 0,
    links: (p.links ?? []).map((l: { label?: string; url?: string }) => ({ label: l.label ?? "", url: l.url ?? "" })),
    syncedAt: p.syncedAt ?? null,
    // admin edits the raw overrides, not the computed values
    ...(admin && { syncError: p.syncError || null, titleRaw: p.title || "", demoOverride: p.demoOverride || "" }),
  };
}

/** Refreshes and saves a project's GitHub snapshot (POST /api/projects, sync, scripts). Never throws on GitHub errors: sets syncError. */
export async function sync(p: any) {
  try {
    const s = await fetchSnapshot({ owner: p.owner, name: p.name });
    p.gh = { ...s, readmeHtml: sanitizeReadme(s.readmeHtml) };
    p.owner = s.owner;
    p.name = s.name;
    p.syncError = "";
  } catch (e) {
    p.syncError = e instanceof Error ? e.message : "sync failed";
  }
  p.syncedAt = new Date();
  return p.save();
}

/** Failed-login counter in Mongo (shared by all serverless instances, TTL 15 min). */
const WINDOW = 15 * 60_000;
const MAX_PER_CLIENT = 5;
const MAX_GLOBAL = 100;

const mongoLimits: LimitStore = {
  async reserve(key, max) {
    const filter = { _id: key, n: { $lt: max } };
    try {
      return !!(await LoginAttempt.findOneAndUpdate(
        filter,
        { $inc: { n: 1 }, $setOnInsert: { expireAt: new Date(Date.now() + WINDOW) } },
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
    await LoginAttempt.updateOne({ _id: key, n: { $gt: 0 } }, { $inc: { n: -1 } });
  },
  async reset(key) {
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

export function createApp() {
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

  /* ---------- auth (no database needed) ---------- */
  app.post(
    "/api/auth/login",
    wrap(async (req, res) => {
      await connectDb();
      const { email, password } = z.object({ email: z.string().max(200), password: z.string().max(200) }).parse(req.body);
      const dev = deviceId(req);
      const limits = loginLimits(req, dev);
      // the slot is taken BEFORE the slow bcrypt check, so parallel requests cannot all slip through
      if (!(await reserveAll(mongoLimits, limits))) return res.status(429).json({ error: "too many attempts" });
      if (!(await checkCredentials(email, password))) return res.status(401).json({ error: "invalid credentials" });
      // success: forget this client's failures and give back the global slot (only failures count)
      await Promise.all(limits.map(([k]) => (k === "global" ? mongoLimits.release(k) : mongoLimits.reset(k))));
      issueSession(res);
      issueDevice(res, dev ?? randomBytes(16).toString("hex"));
      res.json({ ok: true });
    }),
  );
  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie(COOKIE, { path: "/" });
    res.json({ ok: true });
  });
  app.get("/api/auth/me", (req, res) => res.json({ admin: isAdmin(req) }));

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
      const all = req.query.all === "1" && isAdmin(req);
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
      const p: any = await Project.findOne({ owner: req.params.owner, name: req.params.name, hidden: false }, { "gh.readmeHtml": 1 })
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
      const ref = parseRepoUrl(ProjectCreate.parse(req.body).repoUrl);
      if (!ref) return res.status(400).json({ error: "Not a GitHub repository URL" });
      const exists = await Project.findOne(ref).collation({ locale: "en", strength: 2 });
      if (exists) return res.status(409).json({ error: "Already added", project: present(exists, true) });
      const p = new Project({ ...ref, repoUrl: `https://github.com/${ref.owner}/${ref.name}` });
      await sync(p);
      if (p.syncError) {
        await p.deleteOne();
        return res.status(422).json({ error: p.syncError });
      }
      res.status(201).json(present(p, true));
    }),
  );
  app.patch(
    "/api/projects/:id",
    requireAdmin,
    wrap(async (req, res) => {
      if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: "not found" });
      const p = await Project.findByIdAndUpdate(req.params.id, ProjectPatch.parse(req.body), { new: true });
      if (!p) return res.status(404).json({ error: "not found" });
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
  const syncAll = wrap(async (req, res) => {
      // admin, or Vercel Cron with CRON_SECRET
      const cron = process.env.CRON_SECRET && req.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
      if (!cron && !isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
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
