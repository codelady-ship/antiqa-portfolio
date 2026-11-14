import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/data";

const LOCALES = ["az", "en"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  // home + the plain-facts /about page, each with az/en/x-default alternates
  return (["", "/about"] as const).flatMap((path) => {
    const languages = { az: `${SITE_URL}/az${path}`, en: `${SITE_URL}/en${path}`, "x-default": `${SITE_URL}/az${path}` };
    return LOCALES.map((l) => ({
      url: `${SITE_URL}/${l}${path}`,
      changeFrequency: "weekly" as const,
      priority: path ? (l === "az" ? 0.8 : 0.7) : l === "az" ? 1 : 0.9,
      alternates: { languages },
    }));
  });
}
