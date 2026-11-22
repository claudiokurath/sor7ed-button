import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  const [mark, wordmark, anton] = await Promise.all([
    readFile(join(process.cwd(), "public/static/tangle-white.png")),
    readFile(join(process.cwd(), "public/static/sor7ed-logo-white.png")),
    readFile(join(process.cwd(), "public/fonts/Anton-Regular.ttf")),
  ]);
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        color: "#fff",
        padding: 70,
      }}
    >
      <img
        src={`data:image/png;base64,${mark.toString("base64")}`}
        alt=""
        width={280}
        height={289}
      />
      <div style={{ display: "flex", flexDirection: "column", marginLeft: 38 }}>
        <div
          style={{
            display: "flex",
            fontFamily: "Anton",
            fontSize: 220,
            lineHeight: 1,
            color: "#FFBA2E",
          }}
        >
          LINKS
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 32,
            marginTop: 28,
          }}
        >
          <span>See it. Send it.</span>
          <img
            src={`data:image/png;base64,${wordmark.toString("base64")}`}
            alt="SOR7ED"
            width={215}
            height={50}
            style={{ marginLeft: 18 }}
          />
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: "#b5b5b5",
            marginTop: 30,
          }}
        >
          Save to WhatsApp · sor7ed.com/links
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Anton", data: anton, weight: 400, style: "normal" }],
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}
