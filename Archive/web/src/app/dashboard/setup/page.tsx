"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Website name is required");
      return;
    }
    setLoading(true);
    try {
      // Bare hostname only (no scheme/path) — matches what the API's
      // allowedDomains check expects (see core/src/domain-check.ts).
      // Stripping any pasted scheme/path here is a convenience for the
      // partner, not a security boundary — the API re-validates the
      // shape itself regardless of what this sends.
      const cleanedDomain = domain.trim().replace(/^https?:\/\//i, "").split("/")[0]?.toLowerCase();
      const res = await fetch(`${API_BASE}/api/partner`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), allowedDomains: cleanedDomain ? [cleanedDomain] : [] }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui,sans-serif", maxWidth: 480, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Set up your partner account</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>You&apos;ll get an embed snippet to add the Save to WhatsApp button to your site.</p>
      <form onSubmit={(e) => void handleCreate(e)}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Course Platform"
          required
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 15, marginBottom: 16, boxSizing: "border-box" }}
        />
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com (your site's domain)"
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 15, marginBottom: 4, boxSizing: "border-box" }}
        />
        <p style={{ color: "#999", fontSize: 12, marginBottom: 16 }}>
          Your embed key only works for saves from this domain (and its subdomains). Leave blank to skip for now — you can add it later from the dashboard, but saves won&apos;t be restricted until you do.
        </p>
        {error && <p style={{ color: "#c00", marginBottom: 16 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: "14px 0", background: "#25D366", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          {loading ? "Creating…" : "Create partner account"}
        </button>
      </form>
    </main>
  );
}
