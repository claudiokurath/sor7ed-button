"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
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
      const res = await fetch(`${API_BASE}/api/partner`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.status === 401) { router.push("/signin?next=%2Fdashboard"); return; }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "We could not create your website account. Please try again.");
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
      <p style={{ color: "#666", marginBottom: 32 }}>Create your website account, verify your domain, then copy your embed snippet.</p>
      <form onSubmit={(e) => void handleCreate(e)}>
        <input
          aria-label="Website name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Course Platform"
          required
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 15, marginBottom: 16, boxSizing: "border-box" }}
        />
        <p style={{color:'#555',lineHeight:1.6}}>Next, verify ownership of your website with a DNS TXT record. Your key cannot save anything until verification succeeds.</p>
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
