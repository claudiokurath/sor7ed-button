"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useCallback, useRef, type CSSProperties } from "react";

type Stage = "LOADING" | "PREVIEW_SIGNED_OUT" | "PREVIEW_NEEDS_WHATSAPP" | "SAVING" | "SAVED" | "ERROR";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

// How long the "Saved ✓" confirmation stays on screen before this popup
// auto-closes and hands focus back to the host page. Long enough to read,
// short enough that closing the tab yourself never feels necessary.
const AUTO_CLOSE_MS = 1800;

// Once WhatsApp is connected, the wa.me tap only needs to happen once —
// after that, polling every 4s is fine. But immediately after the user
// taps "Connect WhatsApp", they've just alt-tabbed away; polling on a
// fixed interval regardless of visibility wastes requests while the tab
// is backgrounded, AND is slower to react the moment they switch back.
// Combining an interval with a visibilitychange listener covers both.
const WHATSAPP_POLL_MS = 4000;

interface MeResponse {
  id: string;
  email: string;
  whatsappVerified: boolean;
}

function btnStyle(bg: string): CSSProperties {
  return { width: "100%", padding: "14px 0", background: bg, color: "#fff", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: "pointer" };
}

// Tells the widget on the host page (window.opener) that this save
// actually completed, so it can play its confirmation animation. Scoped
// with a "source" tag so the widget can ignore any other postMessage
// traffic on the page. No targetOrigin restriction is applied here
// because the host page's origin is whatever site embedded the widget —
// unknown to this popup in advance — and the message itself carries no
// sensitive data (just a "saved" signal), so broadcasting is safe.
function notifyOpenerOfSave() {
  try {
    window.opener?.postMessage({ source: "sor7ed-widget", type: "saved" }, "*");
  } catch {
    // window.opener can throw in exotic cross-origin/sandboxed embeds —
    // the save itself already succeeded server-side by this point, so a
    // failure here just means the on-page animation doesn't play, which
    // degrades silently rather than blocking the confirmation UI below.
  }
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
  const [connectTapped, setConnectTapped] = useState(false);
  // Read once on mount rather than referenced directly in JSX — this is a
  // client component, but Next.js still executes it in a server-rendering
  // pass first; a bare `window` reference in the render body would throw
  // there. useSearchParams + Suspense happens to force this particular
  // subtree client-only today, which is why a direct reference wouldn't
  // currently crash the build, but that's an implementation detail of
  // Next's bailout behaviour, not a guarantee — state read in an effect
  // is the correct, version-proof way to do this.
  const [isPopup, setIsPopup] = useState(false);
  const stageRef = useRef<Stage>("LOADING");
  stageRef.current = stage;

  useEffect(() => {
    setIsPopup(Boolean(window.opener));
  }, []);

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
  // phone, there's no push signal this page will receive — poll on a
  // fixed interval AND re-check immediately the moment this tab regains
  // focus/visibility (the exact moment they've come back from WhatsApp),
  // so the popup reacts as fast as possible rather than waiting out
  // whatever's left of the 4s tick.
  useEffect(() => {
    if (stage !== "PREVIEW_NEEDS_WHATSAPP") return;

    const interval = setInterval(() => {
      void checkSession();
    }, WHATSAPP_POLL_MS);

    function onVisible() {
      if (document.visibilityState === "visible" && stageRef.current === "PREVIEW_NEEDS_WHATSAPP") {
        void checkSession();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
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
      notifyOpenerOfSave();
      // Auto-close and hand focus back to the host page — the whole point
      // of the widget's popup flow is that the visitor never really leaves
      // the page they were on; lingering here past the confirmation just
      // adds a step they now have to undo themselves (closing the tab).
      // window.opener existing is exactly the signal that this was opened
      // as a popup (vs. someone visiting /save directly) — only auto-close
      // in that case.
      if (window.opener) {
        setTimeout(() => window.close(), AUTO_CLOSE_MS);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStage("ERROR");
    }
  }

  function handleGoogleLogin() {
    const returnTo = encodeURIComponent(window.location.href);
    window.location.href = `${API_BASE}/api/auth/login?returnTo=${returnTo}`;
  }

  function handleConnectClick() {
    setConnectTapped(true);
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
          <p style={{ color: "#111", fontWeight: 600, marginBottom: 4 }}>One tap to finish</p>
          <p style={{ color: "#555", marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
            Tap below, then hit <strong>send</strong> on the pre-filled WhatsApp message — that&apos;s it,
            this comes right back here on its own.
          </p>
          <a
            href={connectUrl}
            target="_blank"
            rel="noreferrer"
            onClick={handleConnectClick}
            style={{ ...btnStyle("#25D366"), display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}
          >
            <span aria-hidden="true">💬</span> Connect WhatsApp
          </a>
          {connectTapped ? (
            <p style={{ color: "#25D366", fontSize: 13, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#25D366",
                  display: "inline-block",
                  animation: "s7-pulse 1.4s ease-in-out infinite",
                }}
              />
              Waiting for you to send the message…
            </p>
          ) : (
            <p style={{ color: "#999", fontSize: 12, marginTop: 16 }}>
              Nothing to type — the message is already filled in for you.
            </p>
          )}
          <style>{"@keyframes s7-pulse{0%,100%{opacity:.35}50%{opacity:1}}"}</style>
        </div>
      )}

      {stage === "SAVING" && <p style={{ textAlign: "center", color: "#555" }}>Saving…</p>}
      {stage === "SAVED" && (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#25D366", fontWeight: 700, fontSize: 17 }}>✓ Saved to your WhatsApp</p>
          {isPopup && <p style={{ color: "#999", fontSize: 12, marginTop: 8 }}>Closing this window…</p>}
        </div>
      )}

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
