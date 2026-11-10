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
