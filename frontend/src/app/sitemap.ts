import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = { az: `${SITE_URL}/az`, en: `${SITE_URL}/en` };
  return (["az", "en"] as const).map((l) => ({
    url: `${SITE_URL}/${l}`,
    changeFrequency: "weekly",
    priority: l === "az" ? 1 : 0.9,
    alternates: { languages },
  }));
}
