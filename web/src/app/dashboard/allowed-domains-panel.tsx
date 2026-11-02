"use client";
import { useState } from "react";
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
type Challenge = { domain: string; name: string; type: string; value: string };

export function AllowedDomainsPanel({
  initialDomains,
}: {
  initialDomains: string[];
}) {
  const [domains, setDomains] = useState(initialDomains);
  const [newDomain, setNewDomain] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function api(path: string, method: string, body: object) {
    const response = await fetch(`${API_BASE}/api/partner/${path}`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        data.error || "We could not update your domains. Please retry.",
      );
    return data;
  }
  async function requestChallenge() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      setChallenge(
        await api("domain-challenge", "POST", { domain: newDomain.trim() }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not prepare verification.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function persist(next: string[]) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api("allowed-domains", "PUT", { allowedDomains: next });
      setDomains(next);
      setMessage(
        next.length
          ? "Domain list verified and saved. Keep the TXT records published."
          : "Saving is disabled until you verify a domain.",
      );
      setChallenge(null);
      setNewDomain("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not verify your domains.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        Your key works only for domains whose DNS ownership you prove. Keep each
        verification TXT record published; removing it disables saves after the
        verification cache expires.
      </p>
      {!domains.length ? (
        <p role="status" style={{ color: "#8a5a00" }}>
          No verified domains yet. Your key is disabled.
        </p>
      ) : null}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {domains.map((domain) => (
          <li
            key={domain}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: "8px 0",
            }}
          >
            <span>{domain}</span>
            <button
              type="button"
              disabled={saving}
              onClick={() => void persist(domains.filter((d) => d !== domain))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <label htmlFor="partner-domain">Website domain</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <input
          id="partner-domain"
          value={newDomain}
          onChange={(e) => {
            setNewDomain(e.target.value);
            setChallenge(null);
          }}
          placeholder="example.com"
          style={{
            minHeight: 44,
            padding: "8px 12px",
            minWidth: 0,
            flex: "1 1 180px",
          }}
        />
        <button
          type="button"
          disabled={saving || !newDomain.trim()}
          onClick={() => void requestChallenge()}
          style={{ minHeight: 44 }}
        >
          Get verification record
        </button>
      </div>
      {challenge ? (
        <div
          style={{
            border: "1px solid #ccc",
            padding: 16,
            marginTop: 16,
            overflowWrap: "anywhere",
          }}
        >
          <p>
            Add this TXT record in your domain provider&apos;s DNS settings:
          </p>
          <dl>
            <dt>Name</dt>
            <dd style={{ margin: "4px 0 12px" }}>
              <code>{challenge.name}</code>
            </dd>
            <dt>Type</dt>
            <dd style={{ margin: "4px 0 12px" }}>TXT</dd>
            <dt>Value</dt>
            <dd style={{ margin: "4px 0 12px" }}>
              <code>{challenge.value}</code>
            </dd>
          </dl>
          <p>
            DNS updates may take a while. Leave the record in place, then verify
            below.
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void persist([...new Set([...domains, challenge.domain])])
            }
            style={{ minHeight: 44 }}
          >
            Verify and enable domain
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" style={{ color: "#a00" }}>
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
