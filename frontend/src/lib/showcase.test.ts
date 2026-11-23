import { describe, expect, it } from "vitest";
import { blurb, BLURB_MAX } from "./blurb";
import { localizeProject, projectLanguages, visibleProjects } from "./showcase";
import type { Project } from "./types";

const project = (over: Partial<Project>): Project => ({
  id: `codelady-ship/${over.name ?? "x"}`,
  owner: "codelady-ship",
  name: "x",
  title: "X",
  summary: { az: "", en: "" },
  description: "",
  repoUrl: "https://github.com/codelady-ship/x",
  backendUrl: null,
  demoUrl: null,
  createdAt: null,
  pushedAt: null,
  stars: 0,
  forks: 0,
  topics: [],
  license: null,
  languages: [],
  featured: false,
  ...over,
});

/** main's blurb (before #67), to prove the captions stay byte-identical */
function oldBlurb(p: Project, locale: "az" | "en") {
  const text = (p.summary?.[locale] || p.description || "").trim();
  if (!text) return "";
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-ZƏÖÜÇŞİĞ“"(])/u);
  let out = sentences[0].trim();
  if (sentences[1] && out.length + sentences[1].length <= 180) out += ` ${sentences[1].trim()}`;
  return out.length > 180 ? `${out.slice(0, 177).trimEnd()}…` : out;
}

// stored summaries on 2026-11-23 (production API)
const PLANERA = {
  az: "Onlayn randevu platforması: xidmət göstərəni tap, boş saatı seç və randevunu bir neçə kliklə götür. Frontend Next.js və TypeScript, backend Java Spring Boot və PostgreSQL üzərində qurulub.",
  en: "An online booking platform: find a service provider, pick a free slot and book an appointment in a few clicks. Built with a Next.js + TypeScript frontend and a Java Spring Boot + PostgreSQL backend.",
};
const SHARE = {
  az: "Bakı, Gəncə və Sumqayıt üçün əşya kirayəsi platforması: fotoaparat, drel, çadır və ya velosipedini günlük kirayəyə ver; kirayəçi tarix seçir, sahibi qəbul və ya rədd edir. Filtrli axtarış, boş günlər təqvimi, rəylər, mesajlaşma, elan sahibi və admin panelləri. Next.js + TypeScript frontend, Java 21 + Spring Boot və PostgreSQL API.",
  en: "A peer-to-peer rental marketplace for Baku, Ganja and Sumgait: list a camera, a drill, a tent or a bike by the day; renters pick dates and the owner accepts or declines. Search with filters, an availability calendar, reviews, messaging, and host and admin dashboards. A Next.js + TypeScript frontend with a Java 21 + Spring Boot + PostgreSQL API.",
};
const MASAPAY = {
  az: "Komanda layihəsi. Restoranlar üçün QR əsaslı hesab bölmə və ödəniş platforması: müştəri masadakı QR kodu skan edib canlı hesabı görür, hesabı bölür, bəxşiş əlavə edir və Payriff ilə ödəyir. React + TypeScript, Java Spring Boot, PostgreSQL və WebSocket üzərində qurulub.",
  en: "Team project. A QR-based bill-splitting and payment platform for restaurants: guests scan the table's QR code, see the live bill, split it, add a tip and pay via Payriff. Built with React + TypeScript, Java Spring Boot, PostgreSQL and WebSocket.",
};

describe("blurb", () => {
  it("keeps Planera and Share captions byte-identical to main", () => {
    for (const summary of [PLANERA, SHARE])
      for (const locale of ["az", "en"] as const) {
        const p = project({ summary });
        expect(blurb(p, locale)).toBe(oldBlurb(p, locale));
      }
    expect(blurb(project({ summary: SHARE }), "az").endsWith(".")).toBe(true);
  });

  it("adds the cut next sentence with an ellipsis after a stub (masapay AZ)", () => {
    const p = project({ summary: MASAPAY });
    expect(oldBlurb(p, "az")).toBe("Komanda layihəsi.");
    const out = blurb(p, "az");
    expect(out.length).toBeLessThanOrEqual(BLURB_MAX);
    expect(out.startsWith("Komanda layihəsi. Restoranlar üçün QR")).toBe(true);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/[\s,.:;]…$/);
    expect(MASAPAY.az.startsWith(out.slice(0, -1))).toBe(true);
    // EN already fit two whole sentences: unchanged
    expect(blurb(p, "en")).toBe(oldBlurb(p, "en"));
  });

  it("keeps a short summary whole and falls back to the GitHub description", () => {
    expect(blurb(project({ summary: { az: "Qısa mətn. İkinci cümlə.", en: "" } }), "az")).toBe("Qısa mətn. İkinci cümlə.");
    expect(blurb(project({ description: "A repo" }), "en")).toBe("A repo");
  });
});

describe("visibleProjects", () => {
  it("drops hidden records and the private duplicate of a public project", () => {
    const skills = project({ name: "codelady-skills", title: "Codelady Skills" });
    const old = project({ name: "scholarship-visa-scam-checker", title: "Codelady Skills", privateRepo: true, repoUrl: "" });
    const hidden = project({ name: "exam-task-react", title: "React Exam", hidden: true });
    const other = project({ name: "masapay", title: "masapay" });
    expect(visibleProjects([old, skills, hidden, other]).map((p) => p.name)).toEqual(["codelady-skills", "masapay"]);
  });
});

describe("projectLanguages", () => {
  it("leaves out languages under 5 % and build files", () => {
    const p = project({
      languages: [
        { name: "TypeScript", percent: 47.7 },
        { name: "Java", percent: 47.5 },
        { name: "Dockerfile", percent: 6 },
        { name: "JavaScript", percent: 2.2 },
        { name: "PLpgSQL", percent: 0.7 },
        { name: "Swift", percent: 0.5 },
        { name: "Shell", percent: 0.2 },
      ],
    });
    expect(projectLanguages(p)).toEqual(["TypeScript", "Java"]);
  });
});

describe("localizeProject", () => {
  it("gives EN visitors the English demo and admin panel", () => {
    const p = project({
      name: "codelady-skills",
      demoUrl: "https://codelady-ship.github.io/codelady-skills/az/",
      adminUrl: "https://codelady-ship.github.io/codelady-skills/az/admin/?demo=1",
    });
    const en = localizeProject(p, "en");
    expect(en.demoUrl).toBe("https://codelady-ship.github.io/codelady-skills/en/");
    expect(en.adminUrl).toBe("https://codelady-ship.github.io/codelady-skills/en/admin/?demo=1");
    expect(localizeProject(p, "az")).toBe(p);
  });

  it("replaces Planera's old domain in both locales", () => {
    const p = project({ name: "planera", demoUrl: "https://randevum-seven.vercel.app", adminUrl: "https://planera-az.vercel.app/panel" });
    expect(localizeProject(p, "az").demoUrl).toBe("https://planera-az.vercel.app");
    expect(localizeProject(p, "en").demoUrl).toBe("https://planera-az.vercel.app/en");
    expect(localizeProject(p, "en").adminUrl).toBe("https://planera-az.vercel.app/en/panel");
  });

  it("fills a missing AZ summary only; EN keeps the GitHub description", () => {
    const p = project({ name: "rock-paper-scissors", description: "Rock Paper Scissors against the computer" });
    const az = localizeProject(p, "az");
    expect(az.summary.az).toMatch(/Daş-qayçı-kağız/);
    expect(az.summary.en).toBe("");
    expect(localizeProject(p, "en")).toBe(p);
    const stored = project({ name: "rock-paper-scissors", summary: { az: "Saxlanmış", en: "" } });
    expect(localizeProject(stored, "az")).toBe(stored);
  });
});
