/**
 * Admin data endpoints against a real mongod (bulk order, CV delete, profile conflicts, error codes).
 * Skipped unless MONGO_TEST_URI points to a LOCAL throw-away server (it drops its database):
 *   MONGO_TEST_URI=mongodb://127.0.0.1:27017/admin-test npx vitest run src/admin.mongo.test.ts
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { memoryAuth } from "./auth.js";
import { memoryStore } from "./limiter.js";
import { connectDb, Cv, Profile, Project } from "./models.js";

const uri = process.env.MONGO_TEST_URI ?? "";
const local = /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(uri);
const ADMIN = "owner@example.com";
const PASSWORD = "a-test-only-password";

const profile = {
  name: "A",
  initials: "A",
  roles: { az: [], en: [] },
  tagline: { az: "", en: "" },
  about: { az: "", en: "" },
  location: { az: "", en: "" },
  openToWork: true,
  skills: [],
  contacts: { email: "", phone: "", whatsapp: "", telegram: "", linkedin: "", github: "", instagram: "" },
};

// a real mongod can be slow to answer on a busy machine
describe.skipIf(!local)("admin data endpoints in MongoDB", { timeout: 60_000 }, () => {
  let app: ReturnType<typeof createApp>;
  let cookie: string[] = [];

  beforeAll(async () => {
    // its own database: auth.mongo.test.ts runs in parallel on the same URI and drops its database too
    process.env.MONGODB_URI = uri.replace(/\/([^/?]*)(\?|$)/, (_, db, q) => `/${db || "test"}-admin-data${q}`);
    process.env.JWT_SECRET = "x".repeat(40);
    process.env.ADMIN_EMAIL = ADMIN;
    process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash(PASSWORD, 4);
    await connectDb();
    app = createApp({ auth: memoryAuth(), limits: memoryStore(), resetAnswerMs: 0, mailer: { problem: () => "off", send: async () => {} } });
    const r = await request(app).post("/api/auth/login").send({ email: ADMIN, password: PASSWORD });
    expect(r.status).toBe(200);
    cookie = ([] as string[]).concat(r.headers["set-cookie"] ?? []);
  }, 60_000);
  beforeEach(async () => {
    await Promise.all([Project.deleteMany({}), Profile.deleteMany({}), Cv.deleteMany({})]);
  }, 60_000);
  afterAll(async () => {
    if (!local) return;
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }, 60_000);

  const seed = (n: number) =>
    Project.insertMany(Array.from({ length: n }, (_, i) => ({ repoUrl: `https://github.com/o/r${i}`, owner: "o", name: `r${i}`, order: i })));

  it("PUT /api/projects/order saves the whole order in one request", async () => {
    const docs = await seed(4);
    // stored order puts r3 first; the new order puts r0 first
    const ids = docs.map((d) => String(d._id));
    const r = await request(app).put("/api/projects/order").set("Cookie", cookie).send({ ids });
    expect(r.status).toBe(200);
    expect(r.body.map((p: { name: string }) => p.name)).toEqual(["r0", "r1", "r2", "r3"]);
    const orders = r.body.map((p: { order: number }) => p.order);
    expect(orders).toEqual([...orders].sort((a, b) => b - a));
  });

  it("refuses a partial or stale list (409) and bad input (400), and needs a session (401)", async () => {
    const docs = await seed(3);
    const ids = docs.map((d) => String(d._id));
    const partial = await request(app).put("/api/projects/order").set("Cookie", cookie).send({ ids: ids.slice(1) });
    expect(partial.status).toBe(409);
    expect(partial.body.code).toBe("stale_list");
    const dup = await request(app).put("/api/projects/order").set("Cookie", cookie).send({ ids: [ids[0], ids[0], ids[1]] });
    expect(dup.status).toBe(400);
    expect(dup.body.code).toBe("invalid_input");
    expect((await request(app).put("/api/projects/order").send({ ids })).status).toBe(401);
    // nothing changed
    expect((await Project.find().sort({ order: 1 }).lean()).map((p: any) => p.order)).toEqual([0, 1, 2]);
  });

  it("GET /api/cv/en does not serve the AZ file; DELETE removes one language", async () => {
    await Cv.create({ _id: "az", fileName: "az.pdf", data: Buffer.from("%PDF-1.4 az"), size: 11 });
    expect((await request(app).get("/api/cv/az")).status).toBe(200);
    const en = await request(app).get("/api/cv/en");
    expect(en.status).toBe(404);
    expect(en.body.code).toBe("no_cv");
    expect((await request(app).get("/api/cv/xx")).status).toBe(404);
    expect((await request(app).delete("/api/cv/az")).status).toBe(401);
    expect((await request(app).delete("/api/cv/az").set("Cookie", cookie)).status).toBe(204);
    expect((await request(app).get("/api/cv/az")).status).toBe(404);
    expect((await request(app).delete("/api/cv/az").set("Cookie", cookie)).status).toBe(404);
  });

  it("profile: a save based on an older version is refused with 409", async () => {
    const first = await request(app).put("/api/profile").set("Cookie", cookie).send({ ...profile, expectedUpdatedAt: null });
    expect(first.status).toBe(200);
    const v1 = first.body.updatedAt as string;
    // a second "first save" (another tab that loaded the empty profile) loses
    const late = await request(app).put("/api/profile").set("Cookie", cookie).send({ ...profile, name: "Late", expectedUpdatedAt: null });
    expect(late.status).toBe(409);
    expect(late.body.code).toBe("stale_profile");
    await new Promise((r) => setTimeout(r, 5));
    const second = await request(app).put("/api/profile").set("Cookie", cookie).send({ ...profile, name: "B", expectedUpdatedAt: v1 });
    expect(second.status).toBe(200);
    expect(second.body.updatedAt).not.toBe(v1);
    const stale = await request(app).put("/api/profile").set("Cookie", cookie).send({ ...profile, name: "C", expectedUpdatedAt: v1 });
    expect(stale.status).toBe(409);
    expect((await request(app).get("/api/profile")).body.name).toBe("B");
    // scripts without the field keep the old behaviour
    expect((await request(app).put("/api/profile").set("Cookie", cookie).send({ ...profile, name: "D" })).status).toBe(200);
  });

  it("errors carry a code the panel translates", async () => {
    const bad = await request(app).put("/api/profile").set("Cookie", cookie).send({ ...profile, skills: ["x".repeat(41)] });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe("invalid_input");
    expect(bad.body.issues[0].path).toEqual(["skills", 0]);
    const notGh = await request(app).post("/api/projects").set("Cookie", cookie).send({ repoUrl: "https://example.com/x" });
    expect(notGh.body.code).toBe("not_github_url");
    await seed(1);
    const dup = await request(app).post("/api/projects").set("Cookie", cookie).send({ repoUrl: "https://github.com/o/r0" });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe("already_added");
    const missing = await request(app).patch(`/api/projects/${new mongoose.Types.ObjectId()}`).set("Cookie", cookie).send({ hidden: true });
    expect(missing.body.code).toBe("not_found");
  });
});
