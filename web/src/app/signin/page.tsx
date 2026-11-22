"use client";
import { useEffect, useRef, useState } from "react";
import Shell from "../_consumer/Shell";
import styles from "../_consumer/consumer.module.css";
import { request } from "../_consumer/api";
import { WhatsAppWindowLink } from "../_consumer/WhatsAppWindowLink";
import { WhatsAppQr } from "../_consumer/WhatsAppQr";
import { parseWhatsAppUrl } from "../../lib/whatsapp-window";
type Challenge = {
  id: string;
  token: string;
  proof: string;
  expiresAt: string;
  whatsappUrl: string;
};
const STORE = "sor7ed:signin";

/** Phones and tablets get a tap-to-open button; everything else gets a QR. */
function useIsPhone(): boolean | null {
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const update = () => setPhone(mq.matches || mobileUa);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}

function useSecondsLeft(expiresAt: string | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (!expiresAt) return null;
  return Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000));
}

export default function Signin() {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);
  const phone = useIsPhone();
  const secondsLeft = useSecondsLeft(challenge?.expiresAt);
  const expired = secondsLeft === 0;

  // Resume a sign-in already in progress, otherwise start one straight away.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null");
      if (saved && Date.parse(saved.expiresAt) > Date.now()) {
        setChallenge(saved);
        return;
      }
    } catch {}
    void begin();
  }, []);

  async function begin() {
    setBusy(true);
    setError("");
    try {
      const c = await request<Challenge>("/api/signin/challenge", {
        method: "POST",
        body: "{}",
      });
      sessionStorage.setItem(STORE, JSON.stringify(c));
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
    if (!challenge || expired) return;
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
      sessionStorage.removeItem(STORE);
      const next =
        new URLSearchParams(location.search).get("next") ?? "/account";
      const target = new URL(next, location.origin);
      location.assign(
        target.origin === location.origin &&
          (["/resource", "/account", "/save", "/save/extension", "/dashboard", "/dashboard/setup"].includes(target.pathname) || /^\/dashboard\/invite\/[a-f0-9]{16}$/.test(target.pathname))
          ? target.pathname + target.search
          : "/account",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  let waHref = "";
  if (challenge) {
    try {
      waHref = parseWhatsAppUrl(challenge.whatsappUrl).href;
    } catch {}
  }
  const clock =
    secondsLeft === null
      ? ""
      : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <Shell>
      <p className={styles.accent}>Your Button. Your thread.</p>
      <h1>
        Keep useful things.
        <br />
        Come back when you’re ready.
      </h1>
      <section className={styles.panel}>
        <h2>Sign in or create your account</h2>
        <p>
          No password. SORTED sends a six-digit code to your WhatsApp. New
          here? Your account is created when you enter the code.
        </p>

        {!challenge ? (
          busy ? (
            <p className={styles.small} aria-live="polite">
              Getting your sign-in ready…
            </p>
          ) : (
            <button onClick={begin}>Try again</button>
          )
        ) : expired ? (
          <>
            <p>This sign-in has expired.</p>
            <button disabled={busy} onClick={begin}>
              Get a new one
            </button>
          </>
        ) : (
          <ol className={styles.steps}>
            <li>
              <h3>Send the message in WhatsApp</h3>
              {phone === null ? null : phone ? (
                <>
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.button} ${styles.big}`}
                  >
                    Open WhatsApp
                  </a>
                  <p className={styles.small}>
                    The message is already written. Just tap Send, then come
                    back here.
                  </p>
                </>
              ) : (
                <>
                  <div className={styles.qrRow}>
                    {waHref ? (
                      <div className={styles.qr}>
                        <WhatsAppQr url={waHref} />
                      </div>
                    ) : null}
                    <p>
                      Scan with your phone’s camera. WhatsApp opens with the
                      message already written. Just tap Send.
                    </p>
                  </div>
                  <WhatsAppWindowLink
                    url={challenge.whatsappUrl}
                    className={`${styles.button} ${styles.quiet}`}
                    label="Or use WhatsApp on this computer"
                  />
                </>
              )}
            </li>
            <li>
              <h3>Enter the 6-digit code</h3>
              <form onSubmit={verify}>
                <label htmlFor="signin-code" className={styles.srOnly}>
                  Code from WhatsApp
                </label>
                <input
                  id="signin-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className={styles.code}
                />
                <button disabled={busy || code.length !== 6}>Sign in</button>
              </form>
            </li>
          </ol>
        )}

        {challenge && !expired ? (
          <p className={styles.small}>
            <span className={styles.countdown} aria-live="off">
              Expires in {clock}
            </span>{" "}
            · Only enter a code for a sign-in you started. Five wrong tries
            locks it.{" "}
            <button
              type="button"
              className={styles.linkButton}
              onClick={begin}
              disabled={busy}
            >
              Start again
            </button>
          </p>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </Shell>
  );
}
