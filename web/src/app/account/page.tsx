"use client";
import { useEffect, useState } from "react";
import Shell from "../_consumer/Shell";
import s from "../_consumer/consumer.module.css";
import { request, ApiError, outcomeText } from "../_consumer/api";
type Item = {
  shortId: string;
  title: string;
  url: string;
  imageUrl: string | null;
  deliveryStatus: string;
  createdAt: string;
};
type Account = {
  profile: {
    displayName: string | null;
    email: string | null;
    number: string | null;
    pausedAt: string | null;
  };
  items: Item[];
};
function publicPage(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}
export default function AccountPage() {
  const [data, setData] = useState<Account | null>(null),
    [name, setName] = useState(""),
    [paused, setPaused] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const d = await request<Account>("/api/account");
      setData(d);
      setName(d.profile.displayName ?? "");
      setPaused(!!d.profile.pausedAt);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        location.replace("/signin");
      else setError(e instanceof Error ? e.message : "Could not load account.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function change(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/account/profile", {
        method: "POST",
        body: JSON.stringify({ displayName: name, paused }),
      });
      setNotice("Profile updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: Item) {
    if (
      !confirm(
        "Remove this page from your SOR7ED history? Messages already in WhatsApp stay there.",
      )
    )
      return;
    try {
      await request(`/api/account/items/${item.shortId}`, { method: "DELETE" });
      setData((d) =>
        d
          ? { ...d, items: d.items.filter((i) => i.shortId !== item.shortId) }
          : d,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function resend(item: Item) {
    if (
      !confirm(
        item.deliveryStatus === "unknown"
          ? "The previous send may already be in WhatsApp. Check your thread first. Request another send anyway?"
          : "Request another WhatsApp send for this saved page?",
      )
    )
      return;
    setBusy(true);
    try {
      const keyName = `sor7ed:resend:${item.shortId}`;
      const actionKey = sessionStorage.getItem(keyName) ?? crypto.randomUUID();
      sessionStorage.setItem(keyName, actionKey);
      const result = await request<{ deliveryStatus: string }>(
        `/api/account/items/${item.shortId}/resend`,
        {
          method: "POST",
          body: JSON.stringify({ actionKey, confirmed: true }),
        },
      );
      sessionStorage.removeItem(keyName);
      setData((d) =>
        d
          ? {
              ...d,
              items: d.items.map((i) =>
                i.shortId === item.shortId
                  ? { ...i, deliveryStatus: result.deliveryStatus }
                  : i,
              ),
            }
          : d,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function signout() {
    try {
      await request("/api/auth/signout", { method: "POST", body: "{}" });
      location.replace("/signin");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function deleteAccount() {
    if (
      !confirm(
        "Permanently delete your SOR7ED account and saved history? This does not delete messages already in WhatsApp.",
      )
    )
      return;
    setBusy(true);
    try {
      await request("/api/account", { method: "DELETE" });
      location.replace("/signin");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const sites = data
    ? [
        ...new Set(
          data.items.map((i) => publicPage(i.url)?.hostname).filter(Boolean),
        ),
      ]
    : [];
  return (
    <Shell>
      <p className={s.accent}>Your SOR7ED account</p>
      <h1>{name ? `Welcome back, ${name}.` : "All your useful things."}</h1>
      <p>
        Your WhatsApp thread is the main home for your saves. This history is
        your backup.
      </p>
      {error ? (
        <p role="alert" className={s.error}>
          {error}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {!data ? (
        <p>Loading your account…</p>
      ) : (
        <>
          <section className={s.panel}>
            <h2>Your websites</h2>
            {sites.length ? (
              <div className={s.row}>
                {sites.map((host) => (
                  <span key={host}>{host}</span>
                ))}
              </div>
            ) : (
              <p>
                No websites yet. Save your first page with the Button or
                extension.
              </p>
            )}
            <p className={s.small}>Based on your latest 100 saves.</p>
            <a href="https://www.planetsorted.com">
              Explore PLANET SOR7ED’s tools and guidebooks ↗
            </a>
          </section>
          <h2>Recent history</h2>
          {data.items.length ? (
            <div className={s.cards}>
              {data.items.map((item) => (
                <article className={s.card} key={item.shortId}>
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <h3>
                    <a
                      href={publicPage(item.url)?.href ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.title}
                    </a>
                  </h3>
                  <p className={s.small}>
                    {publicPage(item.url)?.hostname ??
                      "Unavailable page address"}
                  </p>
                  <p className={s.small}>
                    {outcomeText[item.deliveryStatus] ?? outcomeText.unknown}
                  </p>
                  {["failed", "skipped", "unknown"].includes(
                    item.deliveryStatus,
                  ) ? (
                    <button disabled={busy} onClick={() => resend(item)}>
                      Request another send
                    </button>
                  ) : null}
                  <button className={s.quiet} onClick={() => remove(item)}>
                    Remove
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p>
              No saved pages yet. Nothing is added until you choose to save it.
            </p>
          )}
          <section className={s.panel}>
            <h2>Edit profile</h2>
            <p>WhatsApp {data.profile.number ?? "not connected"}</p>
            <p className={s.small}>
              To use a different number, sign out and verify that number.
              Existing history stays with this account.
            </p>
            <form onSubmit={change}>
              <label htmlFor="display-name">Your name</label>
              <input
                id="display-name"
                maxLength={80}
                autoComplete="nickname"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <label>
                <input
                  type="checkbox"
                  checked={paused}
                  onChange={(e) => setPaused(e.target.checked)}
                />{" "}
                Pause WhatsApp messages
              </label>
              <button disabled={busy}>Save changes</button>
            </form>
            <button className={s.quiet} onClick={signout}>
              Sign out
            </button>
            <button className={s.quiet} onClick={deleteAccount} disabled={busy}>
              Delete account
            </button>
          </section>
        </>
      )}
    </Shell>
  );
}
