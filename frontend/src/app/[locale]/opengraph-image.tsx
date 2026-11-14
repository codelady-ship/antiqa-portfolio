import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Antiqa Cəlilova — Frontend / Full Stack Developer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return [{ locale: "az" }, { locale: "en" }];
}

// Inter Tight subset (ASCII + Azerbaijani letters ə ğ ı ö ş ç ü), OFL — the default OG font has no "ə".
// Cached so the image stays prerendered at build time (Cache Components). The cache holds base64
// strings: binary values did not survive the cache round-trip on Vercel ("Unsupported OpenType signature").
async function readFontsBase64() {
  "use cache";
  return Promise.all(
    ([500, 800] as const).map(async (weight) => ({
      weight,
      b64: (await readFile(join(process.cwd(), "assets", `InterTight-${weight}.woff`))).toString("base64"),
    })),
  );
}

async function loadFonts() {
  return (await readFontsBase64()).map(({ weight, b64 }) => {
    const buf = Buffer.from(b64, "base64");
    return {
      name: "Inter Tight",
      data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      weight,
      style: "normal" as const,
    };
  });
}

const COPY = {
  az: { kicker: "PORTFOLİO", line: "Layihələr · Canlı demolar · CV", place: "Bakı, Azərbaycan" },
  en: { kicker: "PORTFOLIO", line: "Projects · Live demos · CV", place: "Baku, Azerbaijan" },
} as const;

export default async function OG({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = COPY[locale === "en" ? "en" : "az"];
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
          fontFamily: "Inter Tight",
          fontWeight: 500,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, letterSpacing: 6, color: "#a99fae" }}>
          <span>{c.kicker}</span>
          <span style={{ letterSpacing: 1 }}>{c.place}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: -5, lineHeight: 0.95 }}>Antiqa Cəlilova</div>
          <div
            style={{
              fontSize: 54,
              marginTop: 22,
              backgroundImage: "linear-gradient(90deg, #a78bfa, #f0a3c4, #f6c86b)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Frontend / Full Stack Developer
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#a99fae" }}>{c.line}</div>
      </div>
    ),
    { ...size, fonts: await loadFonts() },
  );
}
