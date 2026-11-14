import { describe, expect, it } from "vitest";
import { mergeProfile, sortProjects } from "./merge";
import { SEED_PROFILE } from "./seed";
import type { Project } from "./types";

describe("mergeProfile", () => {
  it("uses the API CV even when the profile document is empty", () => {
    const out = mergeProfile(SEED_PROFILE, { cv: { az: "/api/cv/az?v=1" } });
    expect(out.name).toBe(SEED_PROFILE.name);
    expect(out.about).toEqual(SEED_PROFILE.about);
    expect(out.cv.az).toBe("/api/cv/az?v=1");
    expect(out.cv.en).toBe(SEED_PROFILE.cv.en);
  });

  it("returns the seed when the API is down", () => {
    expect(mergeProfile(SEED_PROFILE, null)).toEqual(SEED_PROFILE);
  });

  it("uses the saved profile and keeps seed CV entries the API lacks", () => {
    const out = mergeProfile(SEED_PROFILE, { name: "X", cv: { en: "/api/cv/en?v=2" } });
    expect(out.name).toBe("X");
    expect(out.cv).toEqual({ ...SEED_PROFILE.cv, en: "/api/cv/en?v=2" });
  });
});

const proj = (id: string, extra: Partial<Project> = {}): Project => ({
  id, owner: "o", name: id, title: id, summary: { az: "", en: "" }, description: "", repoUrl: "", backendUrl: null,
  demoUrl: null, createdAt: null, pushedAt: null, stars: 0, forks: 0, topics: [], license: null, languages: [],
  featured: false, ...extra,
});

describe("sortProjects", () => {
  const list = [
    proj("new", { createdAt: "2026-10-01T00:00:00Z", stars: 1 }),
    proj("old-ordered", { createdAt: "2024-01-01T00:00:00Z", order: 10, stars: 5 }),
    proj("star", { featured: true, createdAt: "2023-01-01T00:00:00Z" }),
  ];

  it("recommended: featured, then admin order, then newest", () => {
    expect(sortProjects(list, "recommended").map((p) => p.id)).toEqual(["star", "old-ordered", "new"]);
  });

  it("visitor sorts override the admin order", () => {
    expect(sortProjects(list, "created").map((p) => p.id)).toEqual(["star", "new", "old-ordered"]);
    expect(sortProjects(list, "stars").map((p) => p.id)).toEqual(["star", "old-ordered", "new"]);
  });
});
