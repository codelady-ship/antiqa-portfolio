import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

beforeAll(() => {
  process.env.JWT_SECRET = "x".repeat(40);
});

describe("api without database", () => {
  const app = createApp();
  it("health works", async () => {
    const r = await request(app).get("/api/health");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });
  it("me reports not admin without cookie", async () => {
    const r = await request(app).get("/api/auth/me");
    expect(r.body).toEqual({ admin: false });
  });
  it("rejects non-JSON writes", async () => {
    const r = await request(app).post("/api/projects").type("form").send("repoUrl=x");
    expect(r.status).toBe(415);
  });
});

describe("readme sanitizer", () => {
  it("opens links in a new tab and still strips scripts and handlers", async () => {
    const { sanitizeReadme } = await import("./app.js");
    const out = sanitizeReadme(
      '<p><a href="https://x.com" target="_self" onclick="alert(1)">site</a><script>alert(1)</script><img src="https://x.com/a.png" onerror="alert(1)"></p>',
    );
    expect(out).toContain('<a href="https://x.com" target="_blank" rel="noopener noreferrer">site</a>');
    expect(out).not.toMatch(/script|onerror|onclick|_self/);
    expect(sanitizeReadme(out)).toBe(out);
    expect(sanitizeReadme('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript");
  });
});

describe("validation", () => {
  it("rejects javascript: and http: links in the profile", async () => {
    const { ProfileInput } = await import("./app.js");
    const base = {
      name: "A", initials: "A", roles: { az: [], en: [] }, tagline: { az: "", en: "" }, about: { az: "", en: "" },
      location: { az: "", en: "" }, openToWork: true, skills: [],
      contacts: { email: "", phone: "", whatsapp: "", telegram: "", linkedin: "", github: "", instagram: "" },
    };
    expect(ProfileInput.safeParse({ ...base, contacts: { ...base.contacts, linkedin: "javascript:alert(1)" } }).success).toBe(false);
    expect(ProfileInput.safeParse({ ...base, contacts: { ...base.contacts, linkedin: "http://x.com" } }).success).toBe(false);
    expect(ProfileInput.safeParse({ ...base, contacts: { ...base.contacts, linkedin: "https://x.com/a" } }).success).toBe(true);
  });
  it("accepts only short, https project links and at most 6", async () => {
    const { ProjectPatch } = await import("./app.js");
    const ok = { label: "Repo", url: "https://github.com/a/b" };
    expect(ProjectPatch.safeParse({ links: [ok] }).success).toBe(true);
    expect(ProjectPatch.safeParse({ links: [] }).success).toBe(true);
    expect(ProjectPatch.safeParse({ links: [{ ...ok, url: "http://github.com/a/b" }] }).success).toBe(false);
    expect(ProjectPatch.safeParse({ links: [{ ...ok, url: "javascript:alert(1)" }] }).success).toBe(false);
    expect(ProjectPatch.safeParse({ links: [{ ...ok, label: "" }] }).success).toBe(false);
    expect(ProjectPatch.safeParse({ links: [{ ...ok, label: "x".repeat(61) }] }).success).toBe(false);
    expect(ProjectPatch.safeParse({ links: Array(7).fill(ok) }).success).toBe(false);
  });
  it("returns links in the public project shape", async () => {
    const { present } = await import("./app.js");
    const base = { _id: "1", owner: "o", name: "my-repo", gh: {} };
    expect(present({ ...base, links: [{ label: "A", url: "https://a.dev" }] }).links).toEqual([{ label: "A", url: "https://a.dev" }]);
    expect(present(base).links).toEqual([]);
  });
  it("hides the code link of a private repo and the live link of a coming-soon project", async () => {
    const { present } = await import("./app.js");
    const base = { _id: "1", owner: "o", name: "app", repoUrl: "https://github.com/o/app", gh: { url: "https://github.com/o/app", homepage: "https://app.dev" } };
    expect(present(base)).toMatchObject({ repoUrl: "https://github.com/o/app", demoUrl: "https://app.dev", privateRepo: false, comingSoon: false });
    expect(present({ ...base, privateRepo: true, comingSoon: true })).toMatchObject({ repoUrl: "", demoUrl: null, privateRepo: true, comingSoon: true });
    expect(present({ ...base, demoOff: true })).toMatchObject({ repoUrl: "https://github.com/o/app", demoUrl: null, comingSoon: false });
  });
  it("admin GitHub helpers need the admin cookie", async () => {
    const app = createApp();
    expect((await request(app).get("/api/github/repos")).status).toBe(401);
    expect((await request(app).get("/api/github/preview?url=https://github.com/a/b")).status).toBe(401);
  });
  it("logout without a body is not rejected as non-JSON", async () => {
    const r = await request(createApp()).post("/api/auth/logout");
    expect(r.status).toBe(200);
  });
});

describe("admin panel url", () => {
  it("accepts https only and a short plain hint; present() shows them only with a url", async () => {
    const { ProjectPatch, present } = await import("./app.js");
    expect(ProjectPatch.safeParse({ adminUrl: "http://x.dev/admin" }).success).toBe(false);
    expect(ProjectPatch.safeParse({ adminUrl: "https://x.dev/admin", adminHint: "demo@x.dev / demo" }).success).toBe(true);
    expect(ProjectPatch.safeParse({ adminHint: "<b>x</b>" }).success).toBe(false);
    const base = { _id: "1", owner: "o", name: "n", repoUrl: "https://github.com/o/n" };
    expect(present({ ...base, adminHint: "x" })).toMatchObject({ adminUrl: null, adminHint: "" });
    expect(present({ ...base, adminUrl: "https://x.dev/admin", adminNoFrame: true })).toMatchObject({ adminUrl: "https://x.dev/admin", adminFrame: false });
    expect(present({ ...base, demoOverride: "https://x.dev", demoNoFrame: true })).toMatchObject({ demoUrl: "https://x.dev", demoFrame: false });
    expect(present(base)).not.toHaveProperty("demoFrame");
  });
  it("detects panels that refuse to be framed", async () => {
    const { frameBlocked } = await import("./app.js");
    const pub = async () => ["93.184.215.14"];
    const real = globalThis.fetch;
    const reply = (h: Record<string, string>) => (globalThis.fetch = (async () => new Response("", { headers: h })) as typeof fetch);
    try {
      reply({ "x-frame-options": "DENY" });
      expect(await frameBlocked("https://x.dev", pub)).toBe(true);
      reply({ "content-security-policy": "default-src 'self'; frame-ancestors 'none'" });
      expect(await frameBlocked("https://x.dev", pub)).toBe(true);
      reply({ "content-security-policy": "frame-ancestors *" });
      expect(await frameBlocked("https://x.dev", pub)).toBe(false);
      // an allow-list that names the portfolio (Pulsa, 2026-11-18) is framable
      reply({ "content-security-policy": "default-src 'self'; frame-ancestors 'self' https://antiqa-portfolio.vercel.app https://antiqacode.vercel.app" });
      expect(await frameBlocked("https://x.dev", pub)).toBe(false);
      reply({ "content-security-policy": "frame-ancestors 'self' https://*.vercel.app" });
      expect(await frameBlocked("https://x.dev", pub)).toBe(false);
      // an allow-list without the portfolio, or with only one of its domains, is not
      reply({ "content-security-policy": "frame-ancestors 'self' https://other.example" });
      expect(await frameBlocked("https://x.dev", pub)).toBe(true);
      reply({ "content-security-policy": "frame-ancestors https://antiqa-portfolio.vercel.app" });
      expect(await frameBlocked("https://x.dev", pub)).toBe(true);
      reply({ "content-security-policy": "frame-ancestors http://antiqa-portfolio.vercel.app http://antiqacode.vercel.app" });
      expect(await frameBlocked("https://x.dev", pub)).toBe(true);
      reply({});
      expect(await frameBlocked("https://x.dev", pub)).toBe(false);
    } finally {
      globalThis.fetch = real;
    }
  });
});
