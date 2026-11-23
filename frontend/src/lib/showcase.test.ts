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

describe("blurb", () => {
  it("keeps a short summary whole", () => {
    const p = project({ summary: { az: "Qısa mətn. İkinci cümlə.", en: "" } });
    expect(blurb(p, "az")).toBe("Qısa mətn. İkinci cümlə.");
  });

  it("cuts a long summary at a word with an ellipsis instead of dropping sentences", () => {
    const az = "Komanda layihəsi. Restoranlar üçün QR əsaslı hesab bölmə və ödəniş platforması: müştəri masadakı QR kodu skan edib canlı hesabı görür, hesabı bölür, bəxşiş əlavə edir və Payriff ilə ödəyir.";
    const out = blurb(project({ summary: { az, en: "" } }), "az");
    expect(out.length).toBeLessThanOrEqual(BLURB_MAX);
    expect(out.startsWith("Komanda layihəsi. Restoranlar üçün")).toBe(true);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/[\s,.:;]…$/);
    expect(az.startsWith(out.slice(0, -1))).toBe(true);
  });

  it("falls back to the GitHub description", () => {
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

  it("fills a missing AZ summary and keeps a stored one", () => {
    const p = project({ name: "rock-paper-scissors", summary: { az: "", en: "Stored English" } });
    const az = localizeProject(p, "az");
    expect(az.summary.az).toMatch(/Daş-qayçı-kağız/);
    expect(az.summary.en).toBe("Stored English");
    expect(localizeProject(p, "en")).toBe(p);
  });
});
