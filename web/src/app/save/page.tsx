"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import type { SaveResponse } from "@sor7ed/types";

type Stage = "LOADING" | "PREVIEW_SIGNED_OUT" | "PREVIEW_NEEDS_WHATSAPP" | "SAVING" | "SAVED" | "ERROR";
type ErrorAction = "session" | "save";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const AUTO_CLOSE_MS = 1800;
const WHATSAPP_POLL_MS = 4000;
const ACTION_LIFETIME_MS = 30 * 60 * 1000;

interface MeResponse {
  id: string;
  email: string;
  whatsappVerified: boolean;
  requiresActiveSession?: boolean;
  whatsappSessionOpen?: boolean;
}

interface ConnectionResponse {
  url: string;
  expiresAt: string;
}

function btnStyle(bg: string, color = "#fff"): CSSProperties {
  return { width: "100%", minHeight: 48, padding: "14px 12px", background: bg, color, border: "none", borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: "pointer" };
}

function imageForContent(image: string, url: string): string | undefined {
  if (!image.trim()) return undefined;
  try {
    const parsed = new URL(image, url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function validFlowId(value: string | null): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{16,100}$/.test(value));
}

function actionIdForContent(contentScope: string, supplied: string | null): string {
  if (validFlowId(supplied)) return supplied;
  // Keep a direct /save link stable across OAuth and reloads in this tab.
  const storageKey = `sor7ed-save-action:v1:${contentScope}`;
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as { id?: string; expiresAt?: number } | null;
    if (stored && validFlowId(stored.id ?? null) && Number(stored.expiresAt) > Date.now()) return stored.id!;
  } catch {
    // Private/sandboxed storage may be unavailable. The ref still keeps
    // the action stable during this mounted flow.
  }
  const id = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ id, expiresAt: Date.now() + ACTION_LIFETIME_MS }));
  } catch {}
  return id;
}

function notifyOpener(result: SaveResponse, flowId: string, openerOrigin: string | null) {
  if (!openerOrigin) return;
  try {
    const parsed = new URL(openerOrigin);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.origin !== openerOrigin) return;
    window.opener?.postMessage({ source: "sor7ed-widget", type: result.deliveryStatus === "accepted" ? "saved" : "save-status", flowId, deliveryStatus: result.deliveryStatus }, parsed.origin);
  } catch {
    // A blocked opener suppresses host-page feedback only.
  }
}

function deliveryCopy(result: SaveResponse): { title: string; detail: string } {
  switch (result.deliveryStatus) {
    case "accepted":
      return { title: "Message sent", detail: "Saved in your library. WhatsApp has accepted the message; delivery is not yet confirmed." };
    case "pending":
      return { title: "Saved — sending to WhatsApp", detail: "The item is in your library. We’re still checking the send result." };
    case "failed":
      return { title: "Saved. WhatsApp sending failed.", detail: "Your item is safe in your library. No new message will be sent when you check its status." };
    case "skipped":
      if (result.deliveryReason === "session_closed") return {
        title: "Saved — WhatsApp conversation needs reopening",
        detail: "No message was sent. Message Sorted in WhatsApp, then reply LIBRARY to find this item. No paid template was requested.",
      };
      return { title: "Saved in your library", detail: result.deliveryReason === "opted_out" ? "WhatsApp messages are paused for your account." : "A WhatsApp message could not be sent for this save." };
    default:
      return { title: "Saved. WhatsApp status is unconfirmed.", detail: "The message may have been sent. Check its status without sending it again." };
  }
}

function SaveFlow() {
  const params = useSearchParams();
  const title = params.get("title") ?? "Untitled";
  const description = params.get("description") ?? "";
  const url = params.get("url") ?? "";
  const apiKey = params.get("apiKey") ?? "";
  const image = imageForContent(params.get("image") ?? "", url);
  const contentScope = JSON.stringify([apiKey, url, title, description, image ?? null]);
  const suppliedFlowId = params.get("flowId");
  const openerOrigin = params.get("openerOrigin");

  const [stage, setStage] = useState<Stage>("LOADING");
  const [errorMsg, setErrorMsg] = useState("");
  const [errorAction, setErrorAction] = useState<ErrorAction>("session");
  const [connection, setConnection] = useState<ConnectionResponse | null>(null);
  const [connectExpired, setConnectExpired] = useState(false);
  const [refreshingConnection, setRefreshingConnection] = useState(false);
  const [connectTapped, setConnectTapped] = useState(false);
  const [requiresActiveSession, setRequiresActiveSession] = useState(false);
  const [result, setResult] = useState<SaveResponse | null>(null);
  const [statusError, setStatusError] = useState("");
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [isPopup, setIsPopup] = useState(false);
  const actionIdRef = useRef<string | null>(null);
  const sessionFlight = useRef<Promise<void> | null>(null);
  const connectFlight = useRef<Promise<void> | null>(null);
  const saveFlight = useRef<Promise<void> | null>(null);
  const statusFlight = useRef<Promise<void> | null>(null);
  const connectionRef = useRef<ConnectionResponse | null>(null);
  const resultRef = useRef<SaveResponse | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsPopup(Boolean(window.opener));
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const recordResult = useCallback((saved: SaveResponse) => {
    resultRef.current = saved;
    setResult(saved);
    setStage("SAVED");
    setStatusError("");
    if (actionIdRef.current) notifyOpener(saved, actionIdRef.current, openerOrigin);
    // Pending, failed and unconfirmed outcomes stay visible.
    if (saved.deliveryStatus === "accepted" && window.opener && !closeTimer.current) {
      closeTimer.current = setTimeout(() => window.close(), AUTO_CLOSE_MS);
    }
  }, [openerOrigin]);

  const performSave = useCallback((): Promise<void> => {
    if (resultRef.current) return Promise.resolve();
    if (saveFlight.current) return saveFlight.current;
    const operation = (async () => {
      setStage("SAVING");
      setErrorMsg("");
      actionIdRef.current ??= actionIdForContent(contentScope, suppliedFlowId);
      try {
        const res = await fetch(`${API_BASE}/api/saves`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partnerApiKey: apiKey, url, title, description, ...(image ? { imageUrl: image } : {}), idempotencyKey: actionIdRef.current }),
        });
        if (res.status === 401) {
          setErrorMsg("Your session expired. Sign in again to continue this save.");
          setStage("PREVIEW_SIGNED_OUT");
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          const message = res.status === 429 ? "This site has reached its save limit. Please try later."
            : res.status === 403 ? "This save button isn’t configured correctly. Let the site owner know."
              : (body.error ?? "We couldn’t confirm this save. Please check again.");
          throw new Error(message);
        }
        const saved = (await res.json()) as SaveResponse;
        if (!saved.shortId || saved.saveStatus !== "saved" || !["pending", "accepted", "failed", "skipped", "unknown"].includes(saved.deliveryStatus)) {
          throw new Error("We couldn’t confirm the send status. Check this save again.");
        }
        recordResult(saved);
      } catch (err) {
        setErrorAction("save");
        setErrorMsg(err instanceof Error && !(err instanceof TypeError) ? err.message : "We couldn’t confirm this save. Check again without creating another save.");
        setStage("ERROR");
      }
    })();
    saveFlight.current = operation;
    void operation.finally(() => { saveFlight.current = null; });
    return operation;
  }, [apiKey, url, suppliedFlowId, title, description, image, contentScope, recordResult]);

  const prepareConnection = useCallback((refresh = false): Promise<void> => {
    if (connectFlight.current) return connectFlight.current;
    if (connectionRef.current && !refresh) return Promise.resolve();
    const operation = (async () => {
      setRefreshingConnection(true);
      try {
        const res = await fetch(`${API_BASE}/api/whatsapp/connect`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh }),
        });
        if (res.status === 401) { setStage("PREVIEW_SIGNED_OUT"); return; }
        if (!res.ok) throw new Error("We couldn’t prepare your WhatsApp connection. Please check your connection and try again.");
        const nextConnection = (await res.json()) as ConnectionResponse;
        if (!nextConnection.url || !Number.isFinite(Date.parse(nextConnection.expiresAt))) throw new Error("The WhatsApp connection link is unavailable. Please try again.");
        const parsed = new URL(nextConnection.url);
        if (parsed.protocol !== "https:" || parsed.hostname !== "wa.me") throw new Error("The WhatsApp connection link is invalid. Please try again.");
        connectionRef.current = nextConnection;
        setConnection(nextConnection);
        setConnectExpired(Date.parse(nextConnection.expiresAt) <= Date.now());
        setConnectTapped(false);
        setErrorMsg("");
        setStage("PREVIEW_NEEDS_WHATSAPP");
      } catch (err) {
        setErrorAction("session");
        setErrorMsg(err instanceof Error ? err.message : "We couldn’t prepare WhatsApp. Please try again.");
        setStage("ERROR");
      } finally {
        setRefreshingConnection(false);
      }
    })();
    connectFlight.current = operation;
    void operation.finally(() => { connectFlight.current = null; });
    return operation;
  }, []);

  const checkSession = useCallback((): Promise<void> => {
    if (resultRef.current || saveFlight.current) return Promise.resolve();
    if (sessionFlight.current) return sessionFlight.current;
    const operation = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
        if (res.status === 401) { setStage("PREVIEW_SIGNED_OUT"); return; }
        if (!res.ok) throw new Error("We couldn’t check your account. Please try again.");
        const user = (await res.json()) as MeResponse;
        if (!user || typeof user.whatsappVerified !== "boolean") throw new Error("We couldn’t check your account. Please try again.");
        setRequiresActiveSession(user.requiresActiveSession === true);
        if (user.whatsappVerified && (!user.requiresActiveSession || user.whatsappSessionOpen)) { await performSave(); return; }
        if (!connectionRef.current) await prepareConnection();
        else {
          setConnectExpired(Date.parse(connectionRef.current.expiresAt) <= Date.now());
          setStage("PREVIEW_NEEDS_WHATSAPP");
        }
      } catch (err) {
        setErrorAction("session");
        setErrorMsg(err instanceof Error ? err.message : "We couldn’t reach your account. Please check your connection and try again.");
        setStage("ERROR");
      }
    })();
    sessionFlight.current = operation;
    void operation.finally(() => { sessionFlight.current = null; });
    return operation;
  }, [performSave, prepareConnection]);

  useEffect(() => { void checkSession(); }, [checkSession]);

  useEffect(() => {
    if (stage !== "PREVIEW_NEEDS_WHATSAPP") return;
    const poll = () => {
      if (connectionRef.current) setConnectExpired(Date.parse(connectionRef.current.expiresAt) <= Date.now());
      if (document.visibilityState === "visible") void checkSession();
    };
    const interval = setInterval(poll, WHATSAPP_POLL_MS);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("focus", poll);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener("focus", poll);
    };
  }, [stage, checkSession]);

  const checkDeliveryStatus = useCallback((): Promise<void> => {
    if (statusFlight.current) return statusFlight.current;
    const current = resultRef.current;
    if (!current || current.deliveryStatus === "accepted") return Promise.resolve();
    const operation = (async () => {
      setCheckingStatus(true);
      try {
        const res = await fetch(`${API_BASE}/api/saves/status/${encodeURIComponent(current.shortId)}`, { credentials: "include" });
        if (res.status === 401) throw new Error("Sign in again to check this item in your library.");
        if (!res.ok) throw new Error("The send status is unavailable. Your saved item is still in your library.");
        const next = (await res.json()) as SaveResponse;
        if (next.shortId !== current.shortId || next.saveStatus !== "saved" || !["pending", "accepted", "failed", "skipped", "unknown"].includes(next.deliveryStatus)) throw new Error("The send status is unavailable. Please check again later.");
        recordResult(next);
      } catch (err) {
        setStatusError(err instanceof Error ? err.message : "We couldn’t check the send status.");
      } finally {
        setCheckingStatus(false);
      }
    })();
    statusFlight.current = operation;
    void operation.finally(() => { statusFlight.current = null; });
    return operation;
  }, [recordResult]);

  useEffect(() => {
    if (result?.deliveryStatus !== "pending") return;
    let checks = 0;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (++checks > 32) { clearInterval(interval); return; }
      void checkDeliveryStatus();
    }, WHATSAPP_POLL_MS);
    return () => clearInterval(interval);
  }, [result?.deliveryStatus, checkDeliveryStatus]);

  function handleGoogleLogin() {
    const returnUrl = new URL(window.location.href);
    actionIdRef.current ??= actionIdForContent(contentScope, suppliedFlowId);
    returnUrl.searchParams.set("flowId", actionIdRef.current);
    window.location.href = `${API_BASE}/api/auth/login?returnTo=${encodeURIComponent(returnUrl.href)}`;
  }

  const copy = result ? deliveryCopy(result) : null;

  return (
    <main style={{ fontFamily: "system-ui,sans-serif", maxWidth: 400, margin: "0 auto", padding: 24 }}>
      {image && <img src={image} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 16, objectFit: "cover", maxHeight: 200 }} />}
      <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>{title}</h1>
      {description && <p style={{ color: "#555", fontSize: 14, margin: "0 0 24px" }}>{description}</p>}

      <div role="status" aria-live="polite" aria-atomic="true">
        {stage === "LOADING" && <p style={{ textAlign: "center", color: "#555" }}>Checking your account…</p>}
        {stage === "SAVING" && <p style={{ textAlign: "center", color: "#555" }}>Saving and checking the WhatsApp send result…</p>}
        {stage === "SAVED" && copy && (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: result?.deliveryStatus === "accepted" ? "#137a39" : "#111", fontWeight: 700, fontSize: 17 }}>{copy.title}</p>
            <p style={{ color: "#555", fontSize: 14, lineHeight: 1.5 }}>{copy.detail}</p>
            {isPopup && result?.deliveryStatus === "accepted" && <p style={{ color: "#555", fontSize: 12, marginTop: 8 }}>Closing this window…</p>}
          </div>
        )}
      </div>

      {stage === "PREVIEW_SIGNED_OUT" && (
        <div>
          {errorMsg && <p role="alert" style={{ color: "#b42318" }}>{errorMsg}</p>}
          <button onClick={handleGoogleLogin} style={btnStyle("#2866c4")}>Continue with Google to Save</button>
          <p style={{ color: "#555", fontSize: 12, marginTop: 12, textAlign: "center", lineHeight: 1.5 }}>
            Connect WhatsApp to receive this item. We use your Google email to identify your account and never post on your behalf.
            Stop WhatsApp messages anytime by replying <strong>STOP</strong>.
          </p>
        </div>
      )}

      {stage === "PREVIEW_NEEDS_WHATSAPP" && (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#111", fontWeight: 600, marginBottom: 4 }}>Connect or reopen your WhatsApp conversation</p>
          {requiresActiveSession && <p style={{ color: "#555", fontSize: 14 }}>An inactive conversation needs reopening before we can send without requesting a paid template.</p>}
          <p style={{ color: "#555", marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
            Tap below, then hit <strong>send</strong> on the pre-filled WhatsApp message. We’ll check your connection when you return.
          </p>
          {connectExpired ? (
            <div>
              <p role="status" style={{ color: "#555" }}>Your connection link has expired. Get a fresh link to continue.</p>
              <button disabled={refreshingConnection} onClick={() => void prepareConnection(true)} style={btnStyle("#25D366", "#12331e")}>
                {refreshingConnection ? "Preparing link…" : "Get a new connection link"}
              </button>
            </div>
          ) : connection ? (
            <a href={connection.url} target="_blank" rel="noreferrer" onClick={() => setConnectTapped(true)} style={{ ...btnStyle("#25D366", "#12331e"), display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", boxSizing: "border-box" }}>
              <span aria-hidden="true">💬</span> Connect WhatsApp
            </a>
          ) : <p role="status">Preparing your connection link…</p>}
          {!connectExpired && <p role="status" style={{ color: "#555", fontSize: 13, marginTop: 16 }}>{connectTapped ? "Waiting for you to send the message…" : "Nothing to type — the message is already filled in for you."}</p>}
        </div>
      )}

      {stage === "SAVED" && result?.deliveryStatus !== "accepted" && (
        <div style={{ textAlign: "center" }}>
          <button disabled={checkingStatus} onClick={() => void checkDeliveryStatus()} style={btnStyle("#111")}>{checkingStatus ? "Checking status…" : "Check send status"}</button>
          {statusError && <p role="alert" style={{ color: "#b42318", fontSize: 14 }}>{statusError}</p>}
          <p style={{ marginTop: 16 }}><a href={result?.cardUrl}>Open saved item</a></p>
        </div>
      )}

      {stage === "ERROR" && (
        <div style={{ textAlign: "center" }}>
          <p role="alert" style={{ color: "#b42318" }}>{errorMsg}</p>
          <button onClick={() => void (errorAction === "save" ? performSave() : checkSession())} style={btnStyle("#111")}>{errorAction === "save" ? "Check this save again" : "Try account check again"}</button>
        </div>
      )}
    </main>
  );
}

export default function SavePage() {
  return <Suspense><SaveFlow /></Suspense>;
}
