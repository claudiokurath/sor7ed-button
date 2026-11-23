"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Shell from "../../_consumer/Shell";
import s from "../../_consumer/consumer.module.css";
import { request, ApiError, outcomeText } from "../../_consumer/api";
import { captureDraft, type Draft } from "../../_consumer/draft";
import { hasExtensionApproval } from "../../_consumer/extension-approval";
import { WhatsAppWindowLink } from "../../_consumer/WhatsAppWindowLink";
type Receipt = { shortId: string; deliveryStatus: string; deliveryReason?: string | null };
type Connection = { whatsappVerified: boolean; whatsappSessionOpen: boolean };
export default function ExtensionSave() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reopen, setReopen] = useState("");
  const [waiting, setWaiting] = useState(false);
  const working = useRef(false);
  const automatic = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (d: Draft, fromExtension = false) => {
    if (working.current || (fromExtension && !hasExtensionApproval(sessionStorage, d))) return;
    working.current = true;
    automatic.current = fromExtension;
    setBusy(true);
    setError("");
    try {
      const me = await request<Connection>("/api/auth/me", { signal: AbortSignal.timeout(15_000) });
      if (!me.whatsappVerified || !me.whatsappSessionOpen) {
        const c = await request<{ url: string }>("/api/whatsapp/connect", { method: "POST", body: "{}" });
        setReopen(c.url);
        setWaiting(true);
        return;
      }
      const result = await request<Receipt>("/api/personal-saves", {
        method: "POST", signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({ url: d.url, title: d.title, idempotencyKey: d.idempotencyKey,
          ...(d.description ? { description: d.description } : {}), ...(d.imageUrl ? { imageUrl: d.imageUrl } : {}),
        }),
      });
      sessionStorage.setItem(`sor7ed:receipt:${d.flowId}`, JSON.stringify(result));
      sessionStorage.removeItem(`sor7ed:draft:${d.flowId}`);
      sessionStorage.removeItem(`sor7ed:approved:${d.flowId}`);
      setReceipt(result);
      setWaiting(false);
      if (fromExtension && result.deliveryStatus === 'accepted') closeTimer.current = setTimeout(() => {
        // The extension closes only its own matching progress tab. The fallback
        // also works where the browser allows the page to close itself.
        history.replaceState(null, '', `/save/extension?flow=${d.flowId}&delivery=accepted`);
        window.close();
      }, 900);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // Approval/draft stay in this tab's session storage through sign-in.
        location.replace(`/signin?next=${encodeURIComponent(`/save/extension?flow=${d.flowId}`)}`);
      } else setError((e as Error).message || 'Could not confirm this save. Check status before retrying.');
    } finally { working.current = false; setBusy(false); }
  }, []);

  useEffect(() => {
    try {
      const d = captureDraft(sessionStorage, location.search, location.hash);
      const flow = d?.flowId ?? new URLSearchParams(location.search).get("flow");
      if (d) {
        history.replaceState(null, "", `/save/extension?flow=${d.flowId}`);
        setDraft(d);
      }
      if (flow) {
        const saved = sessionStorage.getItem(`sor7ed:receipt:${flow}`);
        if (saved) { setReceipt(JSON.parse(saved)); return; }
      }
      if (!d) throw Error("This capture has expired. Choose the page again in the extension.");
    } catch (e) { setError((e as Error).message); }
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, []);

  useEffect(() => {
    if (!draft || receipt) return;
    const begin = () => {
      if (hasExtensionApproval(sessionStorage, draft)) void save(draft, true);
    };
    // A crafted capture URL never passes this check. Only the extension's
    // isolated script can approve a selected page in this first-party tab.
    window.addEventListener('sor7ed:extension-save', begin);
    begin();
    return () => window.removeEventListener('sor7ed:extension-save', begin);
  }, [draft, receipt, save]);

  useEffect(() => {
    if (!waiting || !draft || receipt) return;
    let cancelled = false, checking = false;
    const refresh = async () => {
      if (checking || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        const me = await request<Connection>('/api/auth/me', { signal: AbortSignal.timeout(15_000) });
        if (!cancelled && me.whatsappVerified && me.whatsappSessionOpen) {
          setWaiting(false);
          void save(draft, automatic.current);
        }
      } catch { /* Reconnection remains explicit; no extra send is attempted. */ }
      finally { checking = false; }
    };
    const resume = () => void refresh();
    const interval = setInterval(resume, 2000);
    const timeout = setTimeout(() => { clearInterval(interval); setWaiting(false); }, 5 * 60_000);
    window.addEventListener('focus', resume);
    return () => { cancelled = true; clearInterval(interval); clearTimeout(timeout); window.removeEventListener('focus', resume); };
  }, [waiting, draft, receipt, save]);

  async function check() {
    if (!receipt) return;
    setBusy(true);
    try { setReceipt(await request<Receipt>(`/api/saves/status/${receipt.shortId}`)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <Shell>
      <p className={s.accent}>SOR7ED</p>
      <h1>{busy ? 'Saving your page…' : receipt ? 'Your saved page.' : 'Save to WhatsApp'}</h1>
      <section className={s.panel}>
        {draft ? <><h2>{draft.title}</h2><p style={{ overflowWrap: 'anywhere' }}>{draft.url}</p></> : null}
        {receipt ? <>
          <p role="status">{outcomeText[receipt.deliveryStatus] ?? outcomeText.unknown}</p>
          <button onClick={check} disabled={busy}>Check status</button>
          <a className={s.button} href="/account">Open your history</a>
        </> : draft ? <>
          {reopen ? <>
            <WhatsAppWindowLink url={reopen} className={s.button} />
            <p>Keep this window open. Send the prepared message in WhatsApp, then return here. Your selected page saves automatically once your conversation is active.</p>
          </> : null}
          {busy ? <p role="status">Sending your selected page…</p> : !waiting ? <button onClick={() => void save(draft)} disabled={busy}>Save to WhatsApp</button> : <p role="status">Waiting for your WhatsApp connection…</p>}
        </> : null}
        {error ? <p role="alert" className={s.error}>{error}</p> : null}
      </section>
    </Shell>
  );
}
