import { ImageResponse } from "next/og";

export const alt = "Antiqa — Full Stack Developer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return [{ locale: "az" }, { locale: "en" }];
}

// Link preview for both languages (Latin letters only: the default OG font has no "ə").
export default async function OG({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const line = locale === "az" ? "Layiheler · Canli demolar · CV" : "Projects · Live demos · CV";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(circle at 78% 40%, #3b2366 0%, #0b0910 55%)",
          color: "#f4eef4",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: "#a99fae" }}>PORTFOLIO</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: -6, lineHeight: 0.9 }}>ANTIQA</div>
          <div
            style={{
              fontSize: 54,
              marginTop: 18,
              backgroundImage: "linear-gradient(90deg, #a78bfa, #f0a3c4, #f6c86b)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Full Stack Developer — MERN · Next.js
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#a99fae" }}>{line}</div>
      </div>
    ),
    size,
  );
}
