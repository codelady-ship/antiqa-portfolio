import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export function generateStaticParams() {
  return [{ locale: "az" }, { locale: "en" }];
}

// Home-screen icon (iOS): same "A" mark as app/icon.svg, full-bleed (iOS rounds the corners itself).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0910" }}>
        <svg width="132" height="132" viewBox="0 0 64 64">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#a78bfa" />
              <stop offset="0.5" stopColor="#f0a3c4" />
              <stop offset="1" stopColor="#f6c86b" />
            </linearGradient>
          </defs>
          <path d="M32 11 54 53H44.5L40.3 44.5H23.7L19.5 53H10L32 11Zm0 17.5L27.4 37.8h9.2L32 28.5Z" fill="url(#g)" />
        </svg>
      </div>
    ),
    size,
  );
}
