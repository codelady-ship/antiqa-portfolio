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
  it("logout without a body is not rejected as non-JSON", async () => {
    const r = await request(createApp()).post("/api/auth/logout");
    expect(r.status).toBe(200);
  });
});
