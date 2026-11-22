"use client";
import { useMemo } from "react";
import qrcode from "qrcode-generator";
import { parseWhatsAppUrl } from "../../lib/whatsapp-window";

/**
 * QR code of the prepared wa.me link. Scanning it on a phone opens WhatsApp
 * with the sign-in message already filled in. Drawn as one SVG path (no
 * innerHTML), black on white with a 4-module quiet zone so phone cameras
 * read it reliably on the dark page.
 */
export function WhatsAppQr({ url, size = 220 }: { url: string; size?: number }) {
  const path = useMemo(() => {
    const href = parseWhatsAppUrl(url).href;
    const qr = qrcode(0, "M");
    qr.addData(href);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { d, view: n + 8 };
  }, [url]);
  return (
    <svg
      role="img"
      aria-label="QR code that opens WhatsApp with your sign-in message"
      width={size}
      height={size}
      viewBox={`0 0 ${path.view} ${path.view}`}
      shapeRendering="crispEdges"
      style={{ display: "block", background: "#fff" }}
    >
      <path d={path.d} fill="#000" />
    </svg>
  );
}
