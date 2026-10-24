"use client";
import { useEffect, useRef, useState } from "react";
import Shell from "../../_consumer/Shell";
import s from "../../_consumer/consumer.module.css";
import { request, ApiError, outcomeText } from "../../_consumer/api";
import { captureDraft, type Draft } from "../../_consumer/draft";
type Receipt = {
  shortId: string;
  deliveryStatus: string;
  deliveryReason?: string | null;
};
export default function ExtensionSave() {
  const [draft, setDraft] = useState<Draft | null>(null),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reopen, setReopen] = useState("");
  const working = useRef(false);
  useEffect(() => {
    try {
      const d = captureDraft(sessionStorage, location.search, location.hash);
      const flow =
        d?.flowId ?? new URLSearchParams(location.search).get("flow");
      if (d) {
        history.replaceState(null, "", `/save/extension?flow=${d.flowId}`);
        setDraft(d);
      }
      if (flow) {
        const saved = sessionStorage.getItem(`sor7ed:receipt:${flow}`);
        if (saved) {
          setReceipt(JSON.parse(saved));
          return;
        }
      }
      if (!d)
        throw Error(
          "This capture has expired. Choose the page again in the extension.",
        );
      void request("/api/auth/me").catch((e) => {
        if (e instanceof ApiError && e.status === 401)
          location.replace(
            `/signin?next=${encodeURIComponent(`/save/extension?flow=${d.flowId}`)}`,
          );
        else setError(e.message);
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  async function save() {
    if (!draft || working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const me = await request<{
        whatsappVerified: boolean;
        whatsappSessionOpen: boolean;
        requiresActiveSession: boolean;
      }>("/api/auth/me");
      if (
        !me.whatsappVerified ||
        (me.requiresActiveSession && !me.whatsappSessionOpen)
      ) {
        const c = await request<{ url: string }>("/api/whatsapp/connect", {
          method: "POST",
          body: "{}",
        });
        setReopen(c.url);
        return;
      }
      const result = await request<Receipt>("/api/personal-saves", {
        method: "POST",
        body: JSON.stringify({
          url: draft.url,
          title: draft.title,
          idempotencyKey: draft.idempotencyKey,
          ...(draft.description ? { description: draft.description } : {}),
          ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
        }),
      });
      sessionStorage.setItem(
        `sor7ed:receipt:${draft.flowId}`,
        JSON.stringify(result),
      );
      sessionStorage.removeItem(`sor7ed:draft:${draft.flowId}`);
      setReceipt(result);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        location.assign(
          `/signin?next=${encodeURIComponent(`/save/extension?flow=${draft.flowId}`)}`,
        );
      else setError((e as Error).message);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function check() {
    if (!receipt) return;
    setBusy(true);
    try {
      const result = await request<Receipt>(
        `/api/saves/status/${receipt.shortId}`,
      );
      setReceipt(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <p className={s.accent}>Save with Sorted</p>
      <h1>
        A useful page.
        <br />
        Your next clear step.
      </h1>
      <section className={s.panel}>
        {draft ? (
          <>
            <h2>{draft.title}</h2>
            <p style={{ overflowWrap: "anywhere" }}>{draft.url}</p>
          </>
        ) : null}
        {receipt ? (
          <>
            <p role="status">
              {outcomeText[receipt.deliveryStatus] ?? outcomeText.unknown}
            </p>
            <button onClick={check} disabled={busy}>
              Check status
            </button>
            <a className={s.button} href="/account">
              Open your history
            </a>
          </>
        ) : draft ? (
          <>
            <p>
              Choose save to keep this page in your account and request a
              WhatsApp message.
            </p>
            {reopen ? (
              <>
                <a
                  className={s.button}
                  href={reopen}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Reopen WhatsApp
                </a>
                <p>
                  Send the prepared message, then return and press Save again.
                  No paid template is requested.
                </p>
              </>
            ) : null}
            <button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save to my WhatsApp"}
            </button>
          </>
        ) : null}
        {error ? (
          <p role="alert" className={s.error}>
            {error}
          </p>
        ) : null}
      </section>
    </Shell>
  );
}
