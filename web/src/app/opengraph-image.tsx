import { ImageResponse } from "next/og";

export const alt = "SOR7ED — Found something useful? Send it to yourself.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#080808", color: "white", padding: "64px 72px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", fontSize: 32, letterSpacing: 8 }}>SOR7ED</div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
        <span>Found something useful?</span>
        <span style={{ color: "#ffba2e", marginTop: 12 }}>Send it to yourself.</span>
      </div>
      <div style={{ display: "flex", fontSize: 25, color: "#bdbdbd" }}>Keep useful things in WhatsApp. · sor7ed.com</div>
    </div>,
    size,
  );
}
