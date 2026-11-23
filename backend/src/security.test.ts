/** Security hardening (issue #71): sessions, JWT, sync, own-host links, frame check, duplicates, client IP. No database, no network. */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { COOKIE, memoryAuth } from "./auth.js";
import { clientIp, memoryStore, normalizeIp } from "./limiter.js";
import { hostKind, isOwnHost, isPrivateAddress } from "./hosts.js";
import { Project } from "./models.js";

vi.mock("./models.js", async (orig) => ({ ...(await orig<typeof import("./models.js")>()), connectDb: vi.fn(async () => {}) }));
vi.mock("./services/github.js", async (orig) => ({
  ...(await orig<typeof import("./services/github.js")>()),
  fetchSnapshot: vi.fn(async (ref: { owner: string; name: string }) => ({
    ...ref, url: `https://github.com/${ref.owner}/${ref.name}`, description: "", homepage: null, hasPages: false,
    createdAt: "2026-01-01T00:00:00Z", pushedAt: "2026-01-01T00:00:00Z", stars: 0, forks: 0, topics: [], license: null,
    defaultBranch: "main", languages: [], readmeHtml: "", private: false,
  })),
}));

const { createApp, frameBlocked, present, ProjectPatch } = await import("./app.js");

const SECRET = "x".repeat(40);
beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CRON_SECRET;
  delete process.env.VERCEL;
  delete process.env.SITE_URL;
});

const session = (sv = 0, algorithm: jwt.Algorithm = "HS256") => `${COOKIE}=${jwt.sign({ role: "admin", sv }, SECRET, { algorithm })}`;
function setup() {
  const auth = memoryAuth();
  const app = createApp({ auth, limits: memoryStore(), mailer: { problem: () => "off", send: async () => {} }, resetAnswerMs: 0 });
  const me = async (cookie: string) => (await request(app).get("/api/auth/me").set("Cookie", cookie)).body.admin as boolean;
  return { app, auth, me };
}

describe("JWT algorithm is pinned to HS256", () => {
  it("accepts HS256 and refuses other algorithms and unsigned tokens with the same secret", async () => {
    const { me } = setup();
    expect(await me(session(0, "HS256"))).toBe(true);
    expect(await me(session(0, "HS384"))).toBe(false);
    expect(await me(session(0, "HS512"))).toBe(false);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from('{"role":"admin","sv":0}').toString("base64url")}.`;
    expect(await me(`${COOKIE}=${none}`)).toBe(false);
  });
});

describe("logout", () => {
  it("clears the cookie with the attributes it was set with", async () => {
    const r = await request(setup().app).post("/api/auth/logout");
    const c = (r.get("Set-Cookie") ?? []).find((s) => s.startsWith(`${COOKIE}=`)) ?? "";
    expect(c).toMatch(/Path=\//);
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/SameSite=Strict/);
    expect(c).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("sign out everywhere bumps the session version: every earlier cookie stops working", async () => {
    const { app, auth, me } = setup();
    const a = session(0);
    const b = session(0); // another browser, same version
    expect(await me(b)).toBe(true);
    const r = await request(app).post("/api/auth/logout-all").set("Cookie", a);
    expect(r.status).toBe(200);
    expect(auth.state.sessionVersion).toBe(1);
    expect((r.get("Set-Cookie") ?? []).some((s) => s.startsWith(`${COOKIE}=;`))).toBe(true);
    expect(await me(a)).toBe(false);
    expect(await me(b)).toBe(false);
    // a new login (version 1) works again
    expect(await me(session(1))).toBe(true);
  });

  it("sign out everywhere needs a valid session", async () => {
    const { app, auth } = setup();
    expect((await request(app).post("/api/auth/logout-all")).status).toBe(401);
    expect((await request(app).post("/api/auth/logout-all").set("Cookie", session(0, "HS384"))).status).toBe(401);
    expect(auth.state.sessionVersion).toBe(0);
  });
});

describe("full sync: admin by POST only, cron by GET with the secret", () => {
  const noProjects = () => vi.spyOn(Project, "find").mockResolvedValue([] as never);

  it("GET with the admin cookie is refused (no cross-site <img> trigger)", async () => {
    const find = noProjects();
    const r = await request(setup().app).get("/api/projects/sync").set("Cookie", session());
    expect(r.status).toBe(401);
    expect(find).not.toHaveBeenCalled();
  });

  it("GET needs exactly the cron secret", async () => {
    const find = noProjects();
    const { app } = setup();
    expect((await request(app).get("/api/projects/sync").set("Authorization", "Bearer ")).status).toBe(401); // no CRON_SECRET set
    process.env.CRON_SECRET = "cron-secret-value-1234";
    expect((await request(app).get("/api/projects/sync")).status).toBe(401);
    expect((await request(app).get("/api/projects/sync").set("Authorization", "Bearer cron-secret-value-123")).status).toBe(401);
    expect((await request(app).get("/api/projects/sync").set("Authorization", "cron-secret-value-1234")).status).toBe(401);
    expect(find).not.toHaveBeenCalled();
    const ok = await request(app).get("/api/projects/sync").set("Authorization", "Bearer cron-secret-value-1234");
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ synced: 0, errors: [] });
  });

  it("POST needs the admin session; the cron secret alone does not do", async () => {
    noProjects();
    process.env.CRON_SECRET = "cron-secret-value-1234";
    const { app } = setup();
    expect((await request(app).post("/api/projects/sync")).status).toBe(401);
    expect((await request(app).post("/api/projects/sync").set("Authorization", "Bearer cron-secret-value-1234")).status).toBe(401);
    const r = await request(app).post("/api/projects/sync").set("Cookie", session()).send({});
    expect(r.status).toBe(200);
  });
});

describe("the portfolio's own address is never a framed link", () => {
  it("knows the production hosts, Vercel previews and SITE_URL", () => {
    expect(isOwnHost("https://antiqacode.vercel.app/az")).toBe(true);
    expect(isOwnHost("https://ANTIQA-PORTFOLIO.vercel.app./")).toBe(true);
    expect(isOwnHost("https://antiqa-portfolio-git-fix-x-codelady-ship.vercel.app/")).toBe(true);
    expect(isOwnHost("https://antiqacode-abc123def-codelady-ship.vercel.app/")).toBe(true);
    process.env.SITE_URL = "https://antiqa.dev";
    expect(isOwnHost("https://antiqa.dev/en")).toBe(true);
    expect(isOwnHost("https://share-rental.vercel.app/az")).toBe(false);
    expect(isOwnHost("https://antiqacode.vercel.app.evil.dev/")).toBe(false);
    expect(isOwnHost("https://my-antiqacode.vercel.app/")).toBe(false);
  });

  it("rejects it as admin-panel link, keeps other links", () => {
    for (const u of ["https://antiqacode.vercel.app", "https://antiqa-portfolio.vercel.app/az/admin", "https://antiqa-portfolio-git-main-codelady-ship.vercel.app"])
      expect(ProjectPatch.safeParse({ adminUrl: u }).success).toBe(false);
    expect(ProjectPatch.safeParse({ demoOverride: "https://share-rental.vercel.app/az", adminUrl: "https://x.dev/admin" }).success).toBe(true);
    expect(ProjectPatch.safeParse({ demoOverride: "", adminUrl: "" }).success).toBe(true);
  });

  it("the portfolio's own card may link to the site, but it is never framed", () => {
    // the "antiqa-portfolio" card has had this live link since the start: saving its form must keep working
    expect(ProjectPatch.safeParse({ demoOverride: "https://antiqa-portfolio.vercel.app/" }).success).toBe(true);
    const own = { _id: "1", owner: "codelady-ship", name: "antiqa-portfolio", gh: {}, demoOverride: "https://antiqa-portfolio.vercel.app/" };
    expect(present(own)).toMatchObject({ demoUrl: "https://antiqa-portfolio.vercel.app/", demoFrame: false });
    expect(present({ ...own, adminUrl: "https://antiqacode.vercel.app/az/admin" })).toMatchObject({ adminFrame: false });
    expect(present({ ...own, demoOverride: "https://x.dev/", adminUrl: "https://x.dev/admin" })).toMatchObject({ demoFrame: true, adminFrame: true });
  });

  it("the API answers 400 before touching the database", async () => {
    const update = vi.spyOn(Project, "findByIdAndUpdate");
    const r = await request(setup().app)
      .patch("/api/projects/0123456789abcdef01234567")
      .set("Cookie", session())
      .send({ adminUrl: "https://antiqacode.vercel.app/en/admin" });
    expect(r.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("frame check never fetches private or own hosts", () => {
  const pub = async () => ["93.184.215.14"];
  const fetchMock = (...replies: Response[]) => {
    const f = vi.fn(async () => replies.shift() ?? new Response(""));
    vi.stubGlobal("fetch", f);
    return f;
  };
  afterEach(() => vi.unstubAllGlobals());

  it("classifies addresses", async () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "93.184.215.14", "2606:4700::1111", "172.32.0.1"]) expect(isPrivateAddress(ip), ip).toBe(false);
    expect(await hostKind("https://localhost:3000/")).toBe("private");
    expect(await hostKind("https://printer.local/")).toBe("private");
    expect(await hostKind("https://[::1]/")).toBe("private");
    expect(await hostKind("https://x.dev/", async () => ["10.0.0.5"])).toBe("private");
    expect(await hostKind("https://x.dev/", async () => ["93.184.215.14", "192.168.0.1"])).toBe("private");
    expect(await hostKind("https://x.dev/", pub)).toBe("public");
    expect(await hostKind("https://x.dev/", async () => Promise.reject(new Error("ENOTFOUND")))).toBe("unresolved");
  });

  it("own and private hosts count as blocked without a request", async () => {
    const f = fetchMock();
    expect(await frameBlocked("https://antiqacode.vercel.app/", pub)).toBe(true);
    expect(await frameBlocked("https://169.254.169.254/latest/meta-data/", pub)).toBe(true);
    expect(await frameBlocked("https://internal.example/", async () => ["10.0.0.7"])).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });

  it("checks every redirect hop before following it, and caps the hops", async () => {
    const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });
    let f = fetchMock(redirect("http://127.0.0.1/admin"));
    expect(await frameBlocked("https://x.dev/", pub)).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);

    f = fetchMock(redirect("/login"), new Response("", { headers: { "x-frame-options": "DENY" } }));
    expect(await frameBlocked("https://x.dev/", pub)).toBe(true);
    expect(f.mock.calls.map((c) => (c as unknown[])[0])).toEqual(["https://x.dev/", "https://x.dev/login"]);
    expect(f.mock.calls.every((c) => ((c as unknown[])[1] as RequestInit).redirect === "manual")).toBe(true);

    f = fetchMock(...Array.from({ length: 10 }, (_, i) => redirect(`/r${i}`)));
    expect(await frameBlocked("https://x.dev/", pub)).toBe(false); // unknown, like a network error
    expect(f).toHaveBeenCalledTimes(6);
  });
});

describe("adding the same repo twice in parallel", () => {
  it("answers 409 Already added when the unique index refuses the second insert", async () => {
    const doc = { _id: "0123456789abcdef01234567", owner: "codelady-ship", name: "share-rental", repoUrl: "https://github.com/codelady-ship/share-rental", gh: {} };
    const found = [null, doc];
    vi.spyOn(Project, "findOne").mockImplementation((() => ({ collation: async () => found.shift() ?? null })) as never);
    vi.spyOn(Project.prototype, "save").mockRejectedValue(Object.assign(new Error("E11000 duplicate key error"), { code: 11000 }));
    const r = await request(setup().app).post("/api/projects").set("Cookie", session()).send({ repoUrl: "https://github.com/codelady-ship/share-rental" });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ error: "Already added", project: { name: "share-rental" } });
  });
});

describe("client address for the limiter", () => {
  const req = (headers: Record<string, string>, ip = "198.51.100.9") =>
    ({ ip, get: (h: string) => headers[h.toLowerCase()] }) as unknown as Parameters<typeof clientIp>[0];

  it("normalizes addresses; IPv6 counts per /64", () => {
    expect(normalizeIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(normalizeIp("203.0.113.7")).toBe("203.0.113.7");
    expect(normalizeIp("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
    expect(normalizeIp("2001:db8:1:2::9")).toBe("2001:db8:1:2::/64");
    expect(normalizeIp("2001:0db8::1")).toBe("2001:db8:0:0::/64");
    expect(normalizeIp("[2001:db8:1:2::9]")).toBe("2001:db8:1:2::/64");
    expect(normalizeIp("not an ip")).toBe("");
  });

  it("on Vercel uses the rightmost x-vercel-forwarded-for hop, elsewhere req.ip", () => {
    const h = { "x-vercel-forwarded-for": "6.6.6.6, 203.0.113.7" };
    expect(clientIp(req(h))).toBe("198.51.100.9");
    process.env.VERCEL = "1";
    expect(clientIp(req(h))).toBe("203.0.113.7");
    expect(clientIp(req({}))).toBe("198.51.100.9");
    expect(clientIp(req({}, ""))).toBe("?");
  });

  it("a spoofed leftmost X-Forwarded-For entry does not change the key", async () => {
    // 5 failures from one client lock it out even when it puts a new fake address in front each time
    const { app } = setup();
    process.env.ADMIN_EMAIL = "owner@example.com";
    process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash("the-password", 4);
    const codes = [];
    for (let i = 0; i < 6; i++)
      codes.push((await request(app).post("/api/auth/login").set("X-Forwarded-For", `10.0.0.${i}, 203.0.113.7`).send({ email: "a@b.c", password: "nope" })).status);
    expect(codes).toEqual([401, 401, 401, 401, 401, 429]);
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD_HASH;
  });
});
