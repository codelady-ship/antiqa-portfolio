/**
 * The Mongo-backed admin store and limiter against a real mongod. Skipped unless MONGO_TEST_URI points
 * to a LOCAL throw-away server (it writes the "admin" document, so it refuses anything but localhost):
 *   MONGO_TEST_URI=mongodb://127.0.0.1:27017/reset-test npx vitest run src/auth.mongo.test.ts
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { COOKIE, mongoAuth } from "./auth.js";
import type { Mail } from "./mailer.js";
import { AdminAuth, LoginAttempt } from "./models.js";
import { hashToken } from "./reset.js";

const uri = process.env.MONGO_TEST_URI ?? "";
const local = /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(uri);
const ADMIN = "owner@example.com";

describe.skipIf(!local)("admin store in MongoDB", () => {
  const sent: Mail[] = [];
  let app: ReturnType<typeof createApp>;
  const tokenOf = (m: Mail) => /#token=([\w-]+)/.exec(m.text)![1];

  beforeAll(async () => {
    process.env.MONGODB_URI = uri;
    process.env.JWT_SECRET = "x".repeat(40);
    process.env.ADMIN_EMAIL = ADMIN;
    process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash("the-old-password", 4);
    app = createApp({ resetAnswerMs: 0, mailer: { problem: () => null, send: async (m) => void sent.push(m) } });
    await mongoAuth.get();
    await Promise.all([AdminAuth.deleteMany({}), LoginAttempt.deleteMany({})]);
  });
  afterAll(async () => {
    if (!local) return;
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it("no document: version 0, the environment hash is the password", async () => {
    expect(await mongoAuth.get()).toEqual({ passwordHash: undefined, sessionVersion: 0, reset: undefined });
    expect((await request(app).post("/api/auth/login").send({ email: ADMIN, password: "the-old-password" })).status).toBe(200);
  });

  it("request, reset, login; old session and old link are dead; only hashes are stored", async () => {
    const before = (await request(app).post("/api/auth/login").send({ email: ADMIN, password: "the-old-password" })).get("Set-Cookie")!.find((c) => c.startsWith(COOKIE))!.split(";")[0];
    await request(app).post("/api/auth/reset/request").send({ email: ADMIN });
    await request(app).post("/api/auth/reset/request").send({ email: ADMIN });
    expect(sent).toHaveLength(2);
    const [first, second] = sent.map(tokenOf);
    const doc: any = await AdminAuth.findById("admin").lean();
    expect(doc.reset.hash).toBe(hashToken(second));
    expect(JSON.stringify(doc)).not.toContain(second);
    expect((await request(app).post("/api/auth/reset/verify").send({ token: first })).body).toEqual({ valid: false });
    expect((await request(app).post("/api/auth/reset/verify").send({ token: second })).body).toEqual({ valid: true });

    const body = { token: second, password: "a-brand-new-password", confirm: "a-brand-new-password" };
    const both = await Promise.all([request(app).post("/api/auth/reset/confirm").send(body), request(app).post("/api/auth/reset/confirm").send(body)]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 400]);

    const after: any = await AdminAuth.findById("admin").lean();
    expect(after.reset).toBeUndefined();
    expect(after.sessionVersion).toBe(1);
    expect(after.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(after.passwordChangedAt).toBeInstanceOf(Date);
    expect((await request(app).get("/api/auth/me").set("Cookie", before)).body).toEqual({ admin: false });
    expect((await request(app).post("/api/auth/login").send({ email: ADMIN, password: "the-old-password" })).status).toBe(401);
    const login = await request(app).post("/api/auth/login").send({ email: ADMIN, password: "a-brand-new-password" });
    expect(login.status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Cookie", login.get("Set-Cookie")!.find((c) => c.startsWith(COOKIE))!.split(";")[0])).body).toEqual({ admin: true });
  });

  it("an expired token is not consumed", async () => {
    await mongoAuth.setReset(hashToken("t".repeat(43)), new Date(Date.now() - 1000));
    expect(await mongoAuth.consumeReset(hashToken("t".repeat(43)), new Date(), "x")).toBe(false);
    expect((await mongoAuth.get()).sessionVersion).toBe(1);
  });

  it("request counters live one hour and block the 4th request of a client", async () => {
    await LoginAttempt.deleteMany({});
    const ask = () => request(app).post("/api/auth/reset/request").send({ email: "x@y.example" });
    for (let i = 0; i < 3; i++) expect((await ask()).status).toBe(200);
    expect((await ask()).status).toBe(429);
    const c: any = await LoginAttempt.findOne({ _id: /^reset-req:ip:/ }).lean();
    const ttl = new Date(c.expireAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(59 * 60_000);
    expect(ttl).toBeLessThanOrEqual(60 * 60_000);
  });
});
