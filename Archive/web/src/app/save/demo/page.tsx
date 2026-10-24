"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";

type Stage = "INTRO" | "SAVING" | "SAVED";

// No-signup demo entry point: a prospect (or anyone evaluating the
// product) can drop <script src=".../widget.js" data-demo="true"> on ANY
// page and click through the exact save motion a real partner's visitor
// would see — right down to a mockup of the WhatsApp message that would
// actually land in their chat — without creating an account, connecting
// a real phone number, or touching the database at all. This is
// deliberately 100% client-side: no fetch to /api/saves, no Google
// OAuth, no WhatsApp send. See widget.js's data-demo handling for how a
// script tag routes here instead of the real /save popup.
const AUTO_CLOSE_MS = 2400;

function fmtHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "this site";
  }
}

function DemoFlow() {
  const params = useSearchParams();
  const title = params.get("title") ?? "Untitled";
  const description = params.get("description") ?? "";
  const image = params.get("image") ?? "";
  const url = params.get("url") ?? "";
  const host = fmtHost(url);
  const flowId = params.get("flowId");
  const openerOrigin = params.get("openerOrigin");

  const [stage, setStage] = useState<Stage>("INTRO");
  const [isPopup, setIsPopup] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIsPopup(Boolean(window.opener));
    setReady(true);
  }, []);

  function runDemoSave() {
    if (stage !== "INTRO") return;
    setStage("SAVING");
    // A brief simulated delay reads as "something happened" — instant
    // would look broken, a real network round-trip would be dishonest
    // for a flow that makes none.
    setTimeout(() => {
      setStage("SAVED");
      try {
        const origin = new URL(openerOrigin ?? "");
        if (origin.origin === openerOrigin && (origin.protocol === "http:" || origin.protocol === "https:") && flowId && /^[A-Za-z0-9_-]{16,100}$/.test(flowId)) {
          window.opener?.postMessage({ source: "sor7ed-widget", type: "saved", flowId, demo: true, deliveryStatus: "accepted" }, origin.origin);
        }
      } catch {
        // A blocked or absent opener does not affect the simulation.
      }
      if (window.opener) setTimeout(() => window.close(), AUTO_CLOSE_MS);
    }, 900);
  }

  return (
    <main style={{ fontFamily: "system-ui,sans-serif", maxWidth: 400, margin: "0 auto", padding: 24 }}>
      <div
        style={{
          display: "inline-block",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#8a5a00",
          background: "#fff7e6",
          border: "1px solid #f5c56b",
          borderRadius: 999,
          padding: "3px 10px",
          marginBottom: 16,
        }}
      >
        Demo — nothing is saved
      </div>

      {stage === "INTRO" && (
        <div>
          {image && (
            <img src={image} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 16, objectFit: "cover", maxHeight: 200 }} />
          )}
          <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>{title}</h2>
          {description && <p style={{ color: "#555", fontSize: 14, margin: "0 0 24px" }}>{description}</p>}
          <button
            disabled={!ready}
            onClick={runDemoSave}
            style={{ width: "100%", padding: "14px 0", background: "#25D366", color: "#12331e", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: ready ? "pointer" : "wait" }}
          >
            Simulate: Save to WhatsApp
          </button>
          <p style={{ color: "#999", fontSize: 12, marginTop: 16, textAlign: "center", lineHeight: 1.5 }}>
            In the real product this step is Google sign-in + a one-tap WhatsApp connect. Skipped
            here so you can see the end result immediately.
          </p>
        </div>
      )}

      {stage === "SAVING" && <p style={{ textAlign: "center", color: "#555", padding: "60px 0" }}>Saving…</p>}

      {stage === "SAVED" && (
        <div>
          <p style={{ color: "#25D366", fontWeight: 700, fontSize: 15, textAlign: "center", marginBottom: 16 }}>
            ✓ This is what lands in your WhatsApp
          </p>

          {/* WhatsApp message mockup — the actual value-prop moment for a
              prospect evaluating this product: not "a button was clicked"
              but "here's the exact card a real visitor's phone would
              receive," styled to match Meta's own chat bubble look. */}
          <div style={{ background: "#e5ddd5", borderRadius: 12, padding: 16 }}>
            <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.15)", maxWidth: 280, marginLeft: "auto" }}>
              {image && <img src={image} alt="" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />}
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 6, lineHeight: 1.4 }}>
                  Saved from {host} — I&apos;ll remind you if you ask, and you can search everything
                  you&apos;ve saved anytime.
                </div>
                <div style={{ fontSize: 11, color: "#25D366", wordBreak: "break-all" }}>sor7ed.com/s/abc123def456</div>
                <div style={{ fontSize: 10, color: "#999", textAlign: "right", marginTop: 6 }}>12:34 PM ✓✓</div>
              </div>
            </div>
          </div>

          <p style={{ color: "#666", fontSize: 13, marginTop: 16, textAlign: "center", lineHeight: 1.6 }}>
            Visitors can then text <strong>LIBRARY</strong> to see everything they&apos;ve saved,{" "}
            <strong>REMIND tomorrow</strong> to get nudged about this specific item, or search by
            keyword — all inside the same WhatsApp chat.
          </p>

          <a
            href="/dashboard"
            style={{
              display: "block",
              textAlign: "center",
              marginTop: 20,
              padding: "12px 0",
              background: "#111",
              color: "#fff",
              borderRadius: 8,
              fontWeight: 700,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Set this up on my own site →
          </a>

          {isPopup && <p style={{ color: "#999", fontSize: 12, marginTop: 12, textAlign: "center" }}>Closing this window…</p>}
        </div>
      )}
    </main>
  );
}

export default function SaveDemoPage() {
  return (
    <Suspense>
      <DemoFlow />
    </Suspense>
  );
}
