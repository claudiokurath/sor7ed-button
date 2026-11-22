import { ImageResponse } from "next/og";

export const alt = "SORTED — your links, tools and member hub.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#080808", color: "white", padding: "64px 72px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", fontSize: 32, letterSpacing: 8 }}>SORTED</div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
        <span>Keep what helps.</span>
        <span style={{ color: "#ffba2e", marginTop: 12 }}>Come back to it.</span>
      </div>
      <div style={{ display: "flex", fontSize: 25, color: "#bdbdbd" }}>Links · Tools and guidebooks · Your account · sor7ed.com</div>
    </div>,
    size,
  );
}
