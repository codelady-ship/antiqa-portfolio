import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const API_URL = process.env.API_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // app/global-not-found.tsx: 404 for an unknown locale (the root layout lives under [locale])
  experimental: { globalNotFound: true },
  // the OG image reads its font from ./assets at runtime too (revalidation on Vercel)
  outputFileTracingIncludes: { "/[locale]/opengraph-image": ["./assets/**/*"] },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "s.wordpress.com" }],
  },
  // The browser talks to /api on the same origin (admin cookie stays first-party).
  async rewrites() {
    return API_URL ? [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }] : [];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // no other site may frame the portfolio (clickjacking of the admin panel). This only limits who
          // embeds US: the demo modal framing the projects' own sites is governed by THEIR headers.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      // the admin pages are never stored by the browser or a shared cache
      { source: "/:locale/admin", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/:locale/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      // the password reset page (opened from the mailed link) never sends a Referer anywhere
      { source: "/:locale/admin/reset", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default withNextIntl(nextConfig);
