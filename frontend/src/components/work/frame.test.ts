import { describe, expect, it } from "vitest";
import { isSafeFrame } from "./frame";

describe("isSafeFrame", () => {
  it("frames https sites of other origins", () => {
    expect(isSafeFrame("https://share-rental.vercel.app/az")).toBe(true);
    expect(isSafeFrame("https://codelady-ship.github.io/masapay/")).toBe(true);
  });
  it("never frames the portfolio itself (production, second domain, Vercel previews) or non-https links", () => {
    for (const u of [
      "https://antiqa-portfolio.vercel.app/",
      "https://antiqacode.vercel.app/az",
      "https://antiqa-portfolio-git-fix-x-codelady-ship.vercel.app/",
      "https://antiqa-portfolio.vercel.app./",
      "http://share-rental.vercel.app/",
      "javascript:alert(1)",
      "not a url",
    ])
      expect(isSafeFrame(u), u).toBe(false);
  });
});
