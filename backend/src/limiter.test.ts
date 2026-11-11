import { describe, expect, it } from "vitest";
import { memoryStore, reserveAll } from "./limiter.js";

describe("login limiter", () => {
  it("10 parallel attempts from one client get at most 5 slots", async () => {
    const s = memoryStore();
    const r = await Promise.all(Array.from({ length: 10 }, () => reserveAll(s, [["ip:1", 5], ["global", 100]])));
    expect(r.filter(Boolean)).toHaveLength(5);
    expect(s.n.get("global")).toBe(5); // blocked requests did not keep a global slot
  });

  it("the 6th failure is blocked, a reset (successful login) frees the client", async () => {
    const s = memoryStore();
    for (let i = 0; i < 5; i++) expect(await reserveAll(s, [["ip:1", 5]])).toBe(true);
    expect(await reserveAll(s, [["ip:1", 5]])).toBe(false);
    await s.reset("ip:1");
    expect(await reserveAll(s, [["ip:1", 5]])).toBe(true);
  });

  it("a success releases its global slot, so successes are not counted", async () => {
    const s = memoryStore();
    for (let i = 0; i < 20; i++) {
      expect(await reserveAll(s, [["ip:1", 5], ["global", 3]])).toBe(true);
      await s.reset("ip:1");
      await s.release("global");
    }
    expect(s.n.get("global")).toBe(0);
  });

  it("a known device is not affected by the global cap or the shared IP", async () => {
    const s = memoryStore();
    for (let i = 0; i < 3; i++) await reserveAll(s, [[`ip:${i}`, 5], ["global", 3]]);
    expect(await reserveAll(s, [["ip:9", 5], ["global", 3]])).toBe(false);
    expect(await reserveAll(s, [["dev:abc", 5]])).toBe(true);
  });
});
