"use client";
import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

// Lets a partner add/remove domains after initial setup — setup/page.tsx
// only collects one domain up front, but a partner with multiple
// storefronts/subdomains needs to register each one for their embed key
// to work there (see core/src/domain-check.ts for how these are enforced).
export function AllowedDomainsPanel({ initialDomains }: { initialDomains: string[] }) {
  const [domains, setDomains] = useState(initialDomains);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function persist(next: string[]) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/partner/allowed-domains`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedDomains: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setDomains(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function addDomain() {
    const cleaned = newDomain.trim().replace(/^https?:\/\//i, "").split("/")[0]?.toLowerCase();
    if (!cleaned || domains.includes(cleaned)) return;
    void persist([...domains, cleaned]);
    setNewDomain("");
  }

  function removeDomain(domain: string) {
    void persist(domains.filter((d) => d !== domain));
  }

  return (
    <div>
      {domains.length === 0 && (
        <p style={{ color: "#c00", fontSize: 13, marginBottom: 12 }}>
          No domains registered yet — your embed key currently works from any site. Add your domain below to restrict it.
        </p>
      )}
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
        {domains.map((d) => (
          <li key={d} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f9f9f9", borderRadius: 6, marginBottom: 6, fontSize: 14 }}>
            <span>{d}</span>
            <button
              onClick={() => removeDomain(d)}
              disabled={saving}
              style={{ background: "none", border: "none", color: "#c00", cursor: "pointer", fontSize: 13 }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="example.com"
          onKeyDown={(e) => e.key === "Enter" && addDomain()}
          style={{ flex: 1, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
        />
        <button
          onClick={addDomain}
          disabled={saving}
          style={{ padding: "8px 16px", background: "#25D366", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
        >
          Add
        </button>
      </div>
      {error && <p style={{ color: "#c00", fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
