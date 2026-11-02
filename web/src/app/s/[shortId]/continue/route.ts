import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSaveCard } from "../../../../lib/save-card";
export const dynamic = "force-dynamic";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shortId: string }> },
) {
  const host = request.headers.get("host");
  const protocol =
    process.env["VERCEL"] === "1"
      ? (request.headers.get("x-forwarded-proto") || "https") + ":"
      : request.nextUrl.protocol;
  let sameOrigin = false;
  try {
    const origin = new URL(request.headers.get("origin") || "");
    sameOrigin =
      origin.host === host &&
      origin.protocol === protocol &&
      ["http:", "https:"].includes(origin.protocol) &&
      !origin.username &&
      !origin.password;
  } catch {
    /* Missing or malformed browser origin. */
  }
  if (!sameOrigin)
    return NextResponse.json(
      { error: "Please open the saved link before continuing." },
      { status: 403 },
    );
  const { shortId } = await params;
  const item = await getSaveCard(shortId);
  if (!item)
    return NextResponse.json(
      { error: "This saved link could not be found." },
      { status: 404 },
    );
  const secret = process.env["CLICK_TRACKING_SECRET"];
  if (secret) {
    const ip =
      process.env["VERCEL"] === "1"
        ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
        : "local";
    const visitor = createHmac("sha256", secret)
      .update(ip || "unknown")
      .digest("hex");
    const time = String(Date.now());
    const signature = createHmac("sha256", secret)
      .update(`${shortId}.${time}.${visitor}`)
      .digest("hex");
    try {
      await fetch(
        `${process.env["API_INTERNAL_URL"] ?? "http://localhost:3001"}/api/saves/${encodeURIComponent(shortId)}/click`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "x-sor7ed-click-time": time,
            "x-sor7ed-click-visitor": visitor,
            "x-sor7ed-click-signature": signature,
          },
          signal: AbortSignal.timeout(3000),
        },
      );
    } catch {
      /* Opening a saved resource must not depend on analytics. */
    }
  }
  return NextResponse.redirect(item.url, 303);
}
