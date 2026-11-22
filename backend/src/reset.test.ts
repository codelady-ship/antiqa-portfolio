import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { COOKIE, memoryAuth } from "./auth.js";
import { memoryStore } from "./limiter.js";
import { type Mail, MailError, type Mailer, resendMailer } from "./mailer.js";
import { hashToken, passwordProblem, resetSiteUrl } from "./reset.js";

const ADMIN = "owner@example.com";
const OLD_PASSWORD = "the-old-password";
const NEW_PASSWORD = "a-brand-new-password";
const SITE = "https://antiqa-portfolio.vercel.app";
const ENV_KEYS = ["ADMIN_EMAIL", "ADMIN_PASSWORD_HASH", "SITE_URL", "RESEND_API_KEY", "MAIL_FROM", "VERCEL_ENV", "NODE_ENV"] as const;

let envHash = "";
beforeAll(async () => {
  process.env.JWT_SECRET = "x".repeat(40);
  envHash = await bcrypt.hash(OLD_PASSWORD, 4);
});

let saved: Record<string, string | undefined> = {};
let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.ADMIN_EMAIL = ADMIN;
  process.env.ADMIN_PASSWORD_HASH = envHash;
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

/** The app on in-memory stores with a mailer that only records: no database, no network, no real mail. */
function setup(problem: string | null = null) {
  const auth = memoryAuth();
  const limits = memoryStore();
  const sent: Mail[] = [];
  const mailer: Mailer = {
    problem: () => problem,
    async send(mail) {
      sent.push(mail);
    },
  };
  const app = createApp({ auth, limits, mailer, resetAnswerMs: 0 });
  const ask = (email = ADMIN, ip = "203.0.113.1", locale?: string) =>
    request(app).post("/api/auth/reset/request").set("X-Forwarded-For", ip).send({ email, ...(locale && { locale }) });
  const tokenOf = (mail: Mail | undefined) => /\/admin\/reset#token=([\w-]+)/.exec(mail?.text ?? "")?.[1] ?? "";
  /** asks for a link and returns the token from the recorded mail */
  const token = async (ip?: string) => {
    await ask(ADMIN, ip);
    return tokenOf(sent.at(-1));
  };
  const confirm = (t: string, password = NEW_PASSWORD, again = password) =>
    request(app).post("/api/auth/reset/confirm").send({ token: t, password, confirm: again });
  const verify = (t: string) => request(app).post("/api/auth/reset/verify").send({ token: t });
  const login = (password: string, email = ADMIN) => request(app).post("/api/auth/login").send({ email, password });
  const sessionOf = (r: request.Response) => (r.get("Set-Cookie") ?? []).find((c) => c.startsWith(`${COOKIE}=`))!.split(";")[0];
  const me = async (cookie: string) => (await request(app).get("/api/auth/me").set("Cookie", cookie)).body.admin as boolean;
  return { app, auth, limits, sent, ask, token, tokenOf, confirm, verify, login, sessionOf, me };
}

describe("password reset: asking for the link", () => {
  it("mails one link for the admin address; only the hash of its token is stored", async () => {
    const s = setup();
    const r = await s.ask(ADMIN.toUpperCase(), undefined, "en");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
    expect(r.get("Cache-Control")).toBe("no-store");
    expect(s.sent).toHaveLength(1);
    const t = s.tokenOf(s.sent[0]);
    // 32 random bytes, base64url
    expect(Buffer.from(t, "base64url")).toHaveLength(32);
    expect(s.sent[0].text).toContain(`${SITE}/en/admin/reset#token=${t}`);
    expect(s.sent[0].text).toMatch(/30 dəqiqə/);
    expect(s.sent[0].text).toMatch(/valid for 30 minutes/);
    expect(s.sent[0].text).toMatch(/If you did not ask for this, ignore/);
    expect(s.auth.state.reset!.hash).toBe(hashToken(t));
    expect(JSON.stringify(s.auth.state)).not.toContain(t);
    const left = s.auth.state.reset!.expiresAt.getTime() - Date.now();
    expect(left).toBeGreaterThan(29 * 60_000);
    expect(left).toBeLessThanOrEqual(30 * 60_000);
  });

  it("answers a wrong address exactly like the right one and mails nothing", async () => {
    const s = setup();
    const right = await s.ask(ADMIN, "203.0.113.1");
    const wrong = await s.ask("someone@else.example", "203.0.113.2");
    expect([wrong.status, wrong.body]).toEqual([right.status, right.body]);
    expect(Object.keys(wrong.headers).sort()).toEqual(Object.keys(right.headers).sort());
    expect(s.sent).toHaveLength(1);
  });

  it("builds the link from the configured site, never from request headers", async () => {
    const s = setup();
    await request(s.app)
      .post("/api/auth/reset/request")
      .set({ Host: "evil.example", "X-Forwarded-Host": "evil.example", Origin: "https://evil.example", Referer: "https://evil.example/az/admin" })
      .send({ email: ADMIN });
    expect(s.sent).toHaveLength(1);
    expect(s.sent[0].text).toContain(`${SITE}/az/admin/reset#token=`);
    expect(s.sent[0].text).not.toContain("evil");
    // the locale is one of two words, not a path
    expect((await s.ask(ADMIN, "203.0.113.9", "//evil.example")).status).toBe(400);
  });

  it("a SITE_URL that is not the site's own address sends nothing (same answer)", async () => {
    process.env.SITE_URL = "https://evil.example";
    const s = setup();
    expect((await s.ask()).body).toEqual({ ok: true });
    expect(s.sent).toHaveLength(0);
    expect(errors).toHaveBeenCalledWith(expect.stringContaining("SITE_URL"));
    process.env.SITE_URL = "https://antiqacode.vercel.app/";
    await s.ask();
    expect(s.sent[0].text).toContain("https://antiqacode.vercel.app/az/admin/reset#token=");
  });

  it("mail not configured: same neutral answer, nothing sent, a clear log line without secrets", async () => {
    const s = setup("RESEND_API_KEY not set");
    const r = await s.ask();
    expect([r.status, r.body]).toEqual([200, { ok: true }]);
    expect(s.sent).toHaveLength(0);
    expect(s.auth.state.reset).toBeUndefined();
    expect(errors).toHaveBeenCalledWith("[password-reset] no mail sent, RESEND_API_KEY not set");
  });

  it("a mailer failure is not shown to the caller and the log has no token", async () => {
    const s = setup();
    const app = createApp({
      auth: s.auth,
      limits: s.limits,
      resetAnswerMs: 0,
      mailer: { problem: () => null, send: () => Promise.reject(new MailError("mail provider answered HTTP 500")) },
    });
    const r = await request(app).post("/api/auth/reset/request").send({ email: ADMIN });
    expect([r.status, r.body]).toEqual([200, { ok: true }]);
    expect(errors).toHaveBeenCalledWith("[password-reset] request failed: mail provider answered HTTP 500");
  });

  it("limits requests per client, whatever the address", async () => {
    const s = setup();
    for (let i = 0; i < 3; i++) expect((await s.ask("x@y.example", "198.51.100.7")).status).toBe(200);
    expect((await s.ask("x@y.example", "198.51.100.7")).status).toBe(429);
    expect((await s.ask(ADMIN, "198.51.100.7")).status).toBe(429);
    // another client is not blocked
    expect((await s.ask(ADMIN, "198.51.100.8")).status).toBe(200);
  });

  it("caps the mails per hour for everybody together, without changing the answer", async () => {
    const s = setup();
    for (let i = 0; i < 8; i++) expect((await s.ask(ADMIN, `198.51.100.${i}`)).body).toEqual({ ok: true });
    expect(s.sent).toHaveLength(5);
    // the request that sent nothing did not replace the last mailed token
    expect(s.auth.state.reset!.hash).toBe(hashToken(s.tokenOf(s.sent[4])));
  });

  it("caps the requests of all unknown clients together", async () => {
    const s = setup();
    for (let i = 0; i < 20; i++) expect((await s.ask("x@y.example", `198.51.100.${i}`)).status).toBe(200);
    expect((await s.ask(ADMIN, "198.51.100.99")).status).toBe(429);
  });
});

describe("password reset: the link", () => {
  it("verify accepts the pending token and nothing else", async () => {
    const s = setup();
    const t = await s.token();
    expect((await s.verify(t)).body).toEqual({ valid: true });
    expect((await s.verify(`${t.slice(0, -1)}${t.endsWith("A") ? "B" : "A"}`)).body).toEqual({ valid: false });
    expect((await s.verify("x".repeat(43))).body).toEqual({ valid: false });
    expect((await s.verify("short")).status).toBe(400);
    // no token was ever issued
    expect((await setup().verify(t)).body).toEqual({ valid: false });
  });

  it("an expired token is refused by verify and confirm", async () => {
    const s = setup();
    const t = await s.token();
    s.auth.state.reset!.expiresAt = new Date(Date.now() - 1000);
    expect((await s.verify(t)).body).toEqual({ valid: false });
    const r = await s.confirm(t);
    expect([r.status, r.body]).toEqual([400, { error: "invalid token" }]);
    expect(s.auth.state.passwordHash).toBeUndefined();
    expect((await s.login(OLD_PASSWORD)).status).toBe(200);
  });

  it("a newer request invalidates the earlier link", async () => {
    const s = setup();
    const first = await s.token("203.0.113.1");
    const second = await s.token("203.0.113.2");
    expect(second).not.toBe(first);
    expect((await s.confirm(first)).status).toBe(400);
    expect((await s.confirm(second)).status).toBe(200);
  });

  it("a wrong token changes nothing", async () => {
    const s = setup();
    await s.token();
    expect((await s.confirm("y".repeat(43))).status).toBe(400);
    expect(s.auth.state.passwordHash).toBeUndefined();
    expect(s.auth.state.sessionVersion).toBe(0);
  });

  it("wrong tokens are rate limited per client; a valid one does not use the budget", async () => {
    const s = setup();
    const t = await s.token();
    for (let i = 0; i < 12; i++) expect((await s.verify(t)).body).toEqual({ valid: true });
    for (let i = 0; i < 10; i++) expect((await s.confirm("z".repeat(43))).status).toBe(400);
    expect((await s.confirm("z".repeat(43))).status).toBe(429);
    // even the right token waits now: no oracle for a blocked client
    expect((await s.verify(t)).status).toBe(429);
  });
});

describe("password reset: the new password", () => {
  it("before the first reset the login is the ADMIN_PASSWORD_HASH of the environment", async () => {
    const s = setup();
    expect((await s.login(OLD_PASSWORD)).status).toBe(200);
    expect((await s.login(NEW_PASSWORD)).status).toBe(401);
    expect((await s.login(OLD_PASSWORD, "someone@else.example")).status).toBe(401);
  });

  it("refuses a weak password and keeps the link usable", async () => {
    const s = setup();
    const t = await s.token();
    const reason = async (password: string, again = password) => {
      const r = await s.confirm(t, password, again);
      expect(r.status).toBe(400);
      return r.body.reason;
    };
    expect(await reason("short-pw1")).toBe("short");
    expect(await reason(NEW_PASSWORD, `${NEW_PASSWORD}x`)).toBe("mismatch");
    expect(await reason("Owner@Example.com")).toBe("email");
    expect(await reason("p".repeat(73))).toBe("long");
    expect(s.auth.state.passwordHash).toBeUndefined();
    expect((await s.confirm(t)).status).toBe(200);
  });

  it("happy path: the new password works, the old one and the link do not, a notice is mailed", async () => {
    const s = setup();
    const t = await s.token();
    const r = await s.confirm(t);
    expect([r.status, r.body]).toEqual([200, { ok: true }]);
    expect(r.get("Cache-Control")).toBe("no-store");
    // stored as a bcrypt hash of the same cost the hash-password script uses
    expect(s.auth.state.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(s.auth.state.reset).toBeUndefined();
    expect((await s.login(NEW_PASSWORD)).status).toBe(200);
    expect((await s.login(OLD_PASSWORD)).status).toBe(401);
    // single use
    expect((await s.verify(t)).body).toEqual({ valid: false });
    expect((await s.confirm(t, "another-new-password")).status).toBe(400);
    expect((await s.login("another-new-password")).status).toBe(401);
    expect(s.sent).toHaveLength(2);
    expect(s.sent[1].subject).toMatch(/password changed/);
    expect(s.sent[1].text).not.toContain("token=");
  });

  it("a double submit resets once", async () => {
    const s = setup();
    const t = await s.token();
    const both = await Promise.all([s.confirm(t), s.confirm(t, "the-second-password")]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(s.auth.state.sessionVersion).toBe(1);
    const won = both[0].status === 200 ? NEW_PASSWORD : "the-second-password";
    expect((await s.login(won)).status).toBe(200);
  });

  it("signs every existing session out, also one from before session versions existed", async () => {
    const s = setup();
    const session = s.sessionOf(await s.login(OLD_PASSWORD));
    const legacy = `${COOKIE}=${jwt.sign({ role: "admin" }, process.env.JWT_SECRET!, { expiresIn: 3600 })}`;
    expect(await s.me(session)).toBe(true);
    expect(await s.me(legacy)).toBe(true);
    const r = await s.confirm(await s.token());
    // the browser that did the reset loses its cookie too
    expect((r.get("Set-Cookie") ?? []).some((c) => c.startsWith(`${COOKIE}=;`))).toBe(true);
    expect(await s.me(session)).toBe(false);
    expect(await s.me(legacy)).toBe(false);
    expect((await request(s.app).get("/api/github/repos").set("Cookie", session)).status).toBe(401);
    // a new login is a session again
    expect(await s.me(s.sessionOf(await s.login(NEW_PASSWORD)))).toBe(true);
  });

  it("the password is still changed when the notice cannot be mailed", async () => {
    const s = setup();
    const t = await s.token();
    const app = createApp({
      auth: s.auth,
      limits: s.limits,
      resetAnswerMs: 0,
      mailer: { problem: () => null, send: () => Promise.reject(new MailError("mail provider answered HTTP 500")) },
    });
    expect((await request(app).post("/api/auth/reset/confirm").send({ token: t, password: NEW_PASSWORD, confirm: NEW_PASSWORD })).status).toBe(200);
    expect((await s.login(NEW_PASSWORD)).status).toBe(200);
  });

  it("no token, password or address reaches a response or the log", async () => {
    const s = setup();
    const bodies: string[] = [];
    const keep = (r: request.Response) => (bodies.push(JSON.stringify(r.body) + JSON.stringify(r.headers)), r);
    keep(await s.ask());
    const t = s.tokenOf(s.sent[0]);
    keep(await s.verify(t));
    keep(await s.confirm(t, "short"));
    keep(await s.confirm(t));
    keep(await s.confirm(t));
    const out = bodies.join("") + JSON.stringify(errors.mock.calls);
    for (const secret of [t, hashToken(t), NEW_PASSWORD, ADMIN, s.auth.state.passwordHash!]) expect(out).not.toContain(secret);
  });

  it("reset posts must be JSON (no cross-site form post)", async () => {
    const s = setup();
    const t = await s.token();
    expect((await request(s.app).post("/api/auth/reset/request").type("form").send(`email=${ADMIN}`)).status).toBe(415);
    expect((await request(s.app).post("/api/auth/reset/confirm").type("form").send(`token=${t}&password=${NEW_PASSWORD}&confirm=${NEW_PASSWORD}`)).status).toBe(415);
    expect((await request(s.app).post("/api/auth/reset/confirm").type("text/plain").send(JSON.stringify({ token: t, password: NEW_PASSWORD, confirm: NEW_PASSWORD }))).status).toBe(415);
    expect(s.auth.state.passwordHash).toBeUndefined();
  });
});

describe("password rules and link host", () => {
  it("passwordProblem", () => {
    expect(passwordProblem("0123456789", "0123456789", ADMIN)).toBeNull();
    expect(passwordProblem("012345678", "012345678", ADMIN)).toBe("short");
    expect(passwordProblem("ə".repeat(36), "ə".repeat(36), ADMIN)).toBeNull();
    expect(passwordProblem("ə".repeat(37), "ə".repeat(37), ADMIN)).toBe("long");
    expect(passwordProblem(` ${ADMIN.toUpperCase()} `, ` ${ADMIN.toUpperCase()} `, ADMIN)).toBe("email");
  });
  it("resetSiteUrl accepts only the site's own addresses (localhost outside production)", () => {
    const allowed = [SITE, "https://antiqacode.vercel.app"];
    expect(resetSiteUrl(allowed)).toBe(SITE);
    process.env.SITE_URL = "https://antiqacode.vercel.app";
    expect(resetSiteUrl(allowed)).toBe("https://antiqacode.vercel.app");
    process.env.SITE_URL = "https://antiqa-portfolio.vercel.app.evil.example";
    expect(resetSiteUrl(allowed)).toBeNull();
    process.env.SITE_URL = "http://localhost:3100";
    expect(resetSiteUrl(allowed)).toBe("http://localhost:3100");
    process.env.NODE_ENV = "production";
    expect(resetSiteUrl(allowed)).toBeNull();
  });
});

describe("resend mailer (fetch mocked: nothing leaves the machine)", () => {
  it("says which variable is missing, by name only, and stays off on previews", () => {
    expect(resendMailer.problem()).toBe("RESEND_API_KEY not set");
    delete process.env.ADMIN_EMAIL;
    expect(resendMailer.problem()).toBe("RESEND_API_KEY and ADMIN_EMAIL not set");
    process.env.ADMIN_EMAIL = ADMIN;
    process.env.RESEND_API_KEY = "re_test_key";
    expect(resendMailer.problem()).toBeNull();
    process.env.VERCEL_ENV = "preview";
    expect(resendMailer.problem()).toMatch(/preview/);
    process.env.VERCEL_ENV = "production";
    expect(resendMailer.problem()).toBeNull();
  });

  it("sends plain text to ADMIN_EMAIL only and never puts the key into an error", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const calls: { url: string; init: RequestInit }[] = [];
    let status = 200;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => (calls.push({ url, init }), new Response("{}", { status })));
    try {
      await resendMailer.send({ subject: "s", text: "t" });
      expect(calls[0].url).toBe("https://api.resend.com/emails");
      expect(JSON.parse(String(calls[0].init.body))).toEqual({ from: "Antiqa Portfolio <onboarding@resend.dev>", to: [ADMIN], subject: "s", text: "t" });
      expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
      status = 403;
      const err = await resendMailer.send({ subject: "s", text: "t" }).catch((e) => e);
      expect(err).toBeInstanceOf(MailError);
      expect(err.message).toBe("mail provider answered HTTP 403");
      delete process.env.RESEND_API_KEY;
      await expect(resendMailer.send({ subject: "s", text: "t" })).rejects.toThrow("RESEND_API_KEY not set");
      expect(calls).toHaveLength(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("the real mailer without its key makes the request endpoint fail closed", async () => {
    const auth = memoryAuth();
    const r = await request(createApp({ auth, limits: memoryStore(), resetAnswerMs: 0 }))
      .post("/api/auth/reset/request")
      .send({ email: ADMIN });
    expect([r.status, r.body]).toEqual([200, { ok: true }]);
    expect(auth.state.reset).toBeUndefined();
    expect(errors).toHaveBeenCalledWith("[password-reset] no mail sent, RESEND_API_KEY not set");
  });
});
