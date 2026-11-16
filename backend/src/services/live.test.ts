import { describe, expect, it } from "vitest";
import { readmeExcerpt } from "./github.js";
import { resolveLive, vercelSlug } from "./live.js";

const base = { owner: "codelady-ship", name: "My_App.v2", homepage: null, hasPages: false };
const res = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });

describe("vercelSlug", () => {
  it("lowercases and keeps letters, digits and dashes", () => {
    expect(vercelSlug("My_App.v2")).toBe("my-app-v2");
    expect(vercelSlug("--Curtain--shop--")).toBe("curtain-shop");
    expect(vercelSlug("x".repeat(80))).toHaveLength(52);
  });
});

describe("resolveLive", () => {
  it("uses the repo homepage first, without any request", async () => {
    const f = () => Promise.reject(new Error("no request expected"));
    expect(await resolveLive({ ...base, homepage: "app.dev" }, { fetchImpl: f as typeof fetch, env: {} })).toEqual({
      url: "https://app.dev",
      source: "homepage",
      verified: true,
    });
  });

  it("asks the Vercel API when a token is set", async () => {
    const seen: string[] = [];
    const f = (async (u: string) => {
      seen.push(u);
      return u.includes("/v10/projects?repoUrl=")
        ? res(200, { projects: [{ name: "my-app", link: { repo: "My_App.v2" }, targets: { production: { alias: ["my-app-abc123xyz-codelady.vercel.app", "my-app.vercel.app"] } } }] })
        : res(404);
    }) as unknown as typeof fetch;
    const live = await resolveLive(base, { fetchImpl: f, env: { VERCEL_TOKEN: "t" } });
    expect(live).toEqual({ url: "https://my-app.vercel.app", source: "vercel", verified: true });
    expect(seen[0]).toContain(encodeURIComponent("https://github.com/codelady-ship/My_App.v2"));
  });

  it("falls back to an unverified <name>.vercel.app probe, then GitHub Pages", async () => {
    const up = (async (u: string) => (u === "https://my-app-v2.vercel.app/" ? res(200) : res(404))) as unknown as typeof fetch;
    expect(await resolveLive(base, { fetchImpl: up, env: {} })).toEqual({ url: "https://my-app-v2.vercel.app/", source: "vercel-probe", verified: false });

    const down = (async () => res(404)) as unknown as typeof fetch;
    expect(await resolveLive({ ...base, hasPages: true }, { fetchImpl: down, env: {} })).toEqual({
      url: "https://codelady-ship.github.io/My_App.v2/",
      source: "pages",
      verified: true,
    });
    expect(await resolveLive(base, { fetchImpl: down, env: {} })).toEqual({ url: null, source: null, verified: false });
  });

  it("never throws when the network fails", async () => {
    const boom = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect((await resolveLive(base, { fetchImpl: boom, env: { VERCEL_TOKEN: "t" } })).url).toBeNull();
  });
});

describe("readmeExcerpt", () => {
  it("returns the first prose paragraph without markdown", () => {
    const md = "# Title\n\n![badge](x.svg)\n\nA **multi-shop** catalogue, see [docs](./d.md).\n\n## More\n\ntext";
    expect(readmeExcerpt(md)).toBe("A multi-shop catalogue, see docs.");
    expect(readmeExcerpt("# Only a title")).toBe("");
    expect(readmeExcerpt("x".repeat(400))).toHaveLength(320);
  });
});
