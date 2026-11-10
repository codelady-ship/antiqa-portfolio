import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/data";

export default function robots(): MetadataRoute.Robots {
  return {
    // AI crawlers are welcome too (GEO): the site is public information about the owner
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/az/admin", "/en/admin"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
