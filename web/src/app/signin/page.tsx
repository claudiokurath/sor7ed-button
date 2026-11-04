"use client";
import { useEffect, useState } from "react";
import Shell from "../_consumer/Shell";
import styles from "../_consumer/consumer.module.css";
import { request } from "../_consumer/api";
import { WhatsAppWindowLink } from "../_consumer/WhatsAppWindowLink";
type Challenge = {
  id: string;
  token: string;
  proof: string;
  expiresAt: string;
  whatsappUrl: string;
};
export default function Signin() {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("sor7ed:signin") ?? "null",
      );
      if (saved && Date.parse(saved.expiresAt) > Date.now())
        setChallenge(saved);
    } catch {}
  }, []);
  async function begin() {
    setBusy(true);
    setError("");
    try {
      const c = await request<Challenge>("/api/signin/challenge", {
        method: "POST",
        body: "{}",
      });
      sessionStorage.setItem("sor7ed:signin", JSON.stringify(c));
      setChallenge(c);
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError("");
    try {
      await request("/api/signin/verify", {
        method: "POST",
        body: JSON.stringify({
          ...challenge,
          whatsappUrl: undefined,
          expiresAt: undefined,
          code,
        }),
      });
      sessionStorage.removeItem("sor7ed:signin");
      const next =
        new URLSearchParams(location.search).get("next") ?? "/account";
      const target = new URL(next, location.origin);
      location.assign(
        target.origin === location.origin &&
          (["/account", "/save", "/save/extension", "/dashboard", "/dashboard/setup"].includes(target.pathname) || /^\/dashboard\/invite\/[a-f0-9]{16}$/.test(target.pathname))
          ? target.pathname + target.search
          : "/account",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <p className={styles.accent}>Your Button. Your thread.</p>
      <h1>
        Keep useful things.
        <br />
        Come back when you’re ready.
      </h1>
      <section className={styles.panel}>
        <h2>Sign in with WhatsApp</h2>
        <p>
          Open WhatsApp and send the prepared sign-in message. SOR7ED replies
          with a six-digit code to enter here. No password or Google account
          needed.
        </p>
        {!challenge ? (
          <button disabled={busy} onClick={begin}>
            Start sign-in
          </button>
        ) : (
          <>
            <WhatsAppWindowLink url={challenge.whatsappUrl} className={styles.button} />
            <p className={styles.small}>
              Keep this window open. Send the message in WhatsApp, then return here to enter the code. Only enter a code for a
              sign-in you started. The code expires after 10 minutes and locks
              after five wrong attempts.
            </p>
            <form onSubmit={verify}>
              <label htmlFor="signin-code">Code from WhatsApp</label>
              <input
                id="signin-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={styles.code}
              />
              <button disabled={busy}>Sign in</button>
              <button
                type="button"
                className={styles.quiet}
                onClick={begin}
                disabled={busy}
              >
                Start again
              </button>
            </form>
          </>
        )}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </Shell>
  );
}
