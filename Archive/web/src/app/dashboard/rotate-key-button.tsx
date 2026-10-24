"use client";
import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export function RotateKeyButton({ onRotated }: { onRotated: (newKey: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRotate() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/partner/rotate-key`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to rotate key");
      const { apiKey } = (await res.json()) as { apiKey: string };
      onRotated(apiKey);
      setConfirming(false);
    } catch {
      alert("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        style={{ padding: "8px 16px", background: "#fff", border: "1px solid #ccc", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
      >
        Rotate API key
      </button>
    );
  }

  return (
    <div style={{ padding: 16, background: "#fff8e1", border: "1px solid #f0c040", borderRadius: 8, marginTop: 12 }}>
      <p style={{ margin: "0 0 12px", fontSize: 13 }}>
        Any sites using your current key will stop working immediately. Update your embed snippet everywhere after rotating.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => void handleRotate()}
          disabled={loading}
          style={{ padding: "8px 16px", background: "#c00", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
        >
          {loading ? "Rotating…" : "Yes, rotate key"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          style={{ padding: "8px 16px", background: "#fff", border: "1px solid #ccc", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
