"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useCallback, type CSSProperties } from "react";

type Stage = "LOADING" | "PREVIEW_SIGNED_OUT" | "PREVIEW_NEEDS_WHATSAPP" | "SAVING" | "SAVED" | "ERROR";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

interface MeResponse {
  id: string;
  email: string;
  whatsappVerified: boolean;
}

function btnStyle(bg: string): CSSProperties {
  return { width: "100%", padding: "14px 0", background: bg, color: "#fff", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: "pointer" };
}

function SaveFlow() {
  const params = useSearchParams();
  const title = params.get("title") ?? "Untitled";
  const description = params.get("description") ?? "";
  const image = params.get("image") ?? "";
  const url = params.get("url") ?? "";
  const apiKey = params.get("apiKey") ?? "";

  const [stage, setStage] = useState<Stage>("LOADING");
  const [errorMsg, setErrorMsg] = useState("");
  const [connectUrl, setConnectUrl] = useState("");

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
      if (!res.ok) {
        setStage("PREVIEW_SIGNED_OUT");
        return;
      }
      const user = (await res.json()) as MeResponse;

      if (user.whatsappVerified) {
        void performSave();
        return;
      }

      const connectRes = await fetch(`${API_BASE}/api/whatsapp/connect`, {
        method: "POST",
        credentials: "include",
      });
      if (connectRes.ok) {
        const { url: waUrl } = (await connectRes.json()) as { url: string };
        setConnectUrl(waUrl);
      }
      setStage("PREVIEW_NEEDS_WHATSAPP");
    } catch {
      setStage("PREVIEW_SIGNED_OUT");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  // While waiting for the user to complete the wa.me connection on their
  // phone, there's no other signal this page will receive — poll until
  // whatsappVerified flips true, at which point checkSession auto-saves.
  useEffect(() => {
    if (stage !== "PREVIEW_NEEDS_WHATSAPP") return;
    const interval = setInterval(() => {
      void checkSession();
    }, 4000);
    return () => clearInterval(interval);
  }, [stage, checkSession]);

  async function performSave() {
    setStage("SAVING");
    try {
      const res = await fetch(`${API_BASE}/api/saves`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerApiKey: apiKey, url, title, description, imageUrl: image }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        // Keyed on status code, not the exact error string — matching on
        // literal text is fragile since there's no formal contract with
        // the backend's error copy. The API already returns a stable,
        // meaningful status per case (429/403/401), so branch on that.
        const message =
          res.status === 429
            ? "This site has reached its save limit for the month. Try again next month."
            : res.status === 403
              ? "This save button isn't configured correctly. Let the site owner know."
              : res.status === 401
                ? "Your session expired. Refresh the page to sign in again."
                : (body.error ?? `Something went wrong (HTTP ${res.status}).`);
        throw new Error(message);
      }
      setStage("SAVED");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStage("ERROR");
    }
  }

  function handleGoogleLogin() {
    const returnTo = encodeURIComponent(window.location.href);
    window.location.href = `${API_BASE}/api/auth/login?returnTo=${returnTo}`;
  }

  return (
    <main style={{ fontFamily: "system-ui,sans-serif", maxWidth: 400, margin: "0 auto", padding: 24 }}>
      {/* Renders unconditionally, before any auth check resolves. */}
      {image && <img src={image} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 16, objectFit: "cover", maxHeight: 200 }} />}
      <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>{title}</h2>
      {description && <p style={{ color: "#555", fontSize: 14, margin: "0 0 24px" }}>{description}</p>}

      {stage === "LOADING" && <p style={{ textAlign: "center", color: "#999" }}>Checking your account…</p>}

      {stage === "PREVIEW_SIGNED_OUT" && (
        <div>
          <button onClick={handleGoogleLogin} style={btnStyle("#4285F4")}>
            Continue with Google to Save
          </button>
          <p style={{ color: "#999", fontSize: 12, marginTop: 12, textAlign: "center", lineHeight: 1.5 }}>
            By continuing, you agree to receive this item and future reminders via WhatsApp at the
            number you connect. We only use your Google email to identify your account and never
            post on your behalf. You can stop WhatsApp messages anytime by replying{" "}
            <strong>STOP</strong>.
          </p>
        </div>
      )}

      {stage === "PREVIEW_NEEDS_WHATSAPP" && (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#555", marginBottom: 16 }}>One more step — connect WhatsApp to receive your saves.</p>
          <a href={connectUrl} target="_blank" rel="noreferrer" style={{ ...btnStyle("#25D366"), display: "block", textDecoration: "none" }}>
            Connect WhatsApp
          </a>
          <p style={{ color: "#999", fontSize: 12, marginTop: 12 }}>This page will continue automatically once you&apos;ve connected.</p>
        </div>
      )}

      {stage === "SAVING" && <p style={{ textAlign: "center", color: "#555" }}>Saving…</p>}
      {stage === "SAVED" && <p style={{ textAlign: "center", color: "#25D366", fontWeight: 700 }}>✓ Saved to your WhatsApp</p>}

      {stage === "ERROR" && (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#c00" }}>{errorMsg}</p>
          <button onClick={() => void performSave()} style={btnStyle("#25D366")}>
            Try again
          </button>
        </div>
      )}
    </main>
  );
}

export default function SavePage() {
  return (
    <Suspense>
      <SaveFlow />
    </Suspense>
  );
}
