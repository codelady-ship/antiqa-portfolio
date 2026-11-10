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
