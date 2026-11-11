import { describe, expect, it } from "vitest";
import { absolutizeReadme, demoUrl, parseRepoUrl, toPercentages } from "./github.js";

describe("parseRepoUrl", () => {
  it("accepts common forms", () => {
    expect(parseRepoUrl("https://github.com/codelady-ship/My-Quiz-App")).toEqual({ owner: "codelady-ship", name: "My-Quiz-App" });
    expect(parseRepoUrl("github.com/a/b.git")).toEqual({ owner: "a", name: "b" });
    expect(parseRepoUrl("https://github.com/a/task6.mongodb/")).toEqual({ owner: "a", name: "task6.mongodb" });
    expect(parseRepoUrl("https://github.com/a/b?tab=readme")).toEqual({ owner: "a", name: "b" });
  });
  it("rejects other hosts and paths", () => {
    expect(parseRepoUrl("https://gitlab.com/a/b")).toBeNull();
    expect(parseRepoUrl("https://github.com/a")).toBeNull();
    expect(parseRepoUrl("https://github.com/a/b/tree/main")).toBeNull();
    expect(parseRepoUrl("https://evil.com/github.com/a/b")).toBeNull();
  });
});

describe("demoUrl", () => {
  const base = { owner: "codelady-ship", name: "app", homepage: null, hasPages: false };
  it("prefers override, then homepage, then pages", () => {
    expect(demoUrl(base, "https://x.dev")).toBe("https://x.dev");
    expect(demoUrl({ ...base, homepage: "app.vercel.app" })).toBe("https://app.vercel.app");
    expect(demoUrl({ ...base, hasPages: true })).toBe("https://codelady-ship.github.io/app/");
    expect(demoUrl({ ...base, name: "codelady-ship.github.io", hasPages: true })).toBe("https://codelady-ship.github.io/");
    expect(demoUrl(base)).toBeNull();
  });
});

it("toPercentages sorts and rounds", () => {
  expect(toPercentages({ CSS: 1, JavaScript: 3 })).toEqual([
    { name: "JavaScript", percent: 75 },
    { name: "CSS", percent: 25 },
  ]);
  expect(toPercentages({})).toEqual([]);
});

it("absolutizeReadme rewrites relative urls only", () => {
  const html = '<img src="./img/a.png"><img src="https://x/y.png"><a href="docs/x.md">x</a><a href="#top">t</a>';
  const out = absolutizeReadme(html, { owner: "o", name: "r" }, "main");
  expect(out).toContain('src="https://raw.githubusercontent.com/o/r/main/img/a.png"');
  expect(out).toContain('src="https://x/y.png"');
  expect(out).toContain('href="https://github.com/o/r/blob/main/docs/x.md"');
  expect(out).toContain('href="#top"');
});
