"use client";
import { useState } from "react";

const WEB_BASE = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "https://sor7ed.com";

export function EmbedSnippet({ apiKey, buttonLabel }: { apiKey: string; buttonLabel: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${WEB_BASE}/widget.js" data-api-key="${apiKey}" data-label="${buttonLabel}" async></script>`;

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ position: "relative" }}>
      <pre style={{ background: "#1e1e1e", color: "#d4d4d4", padding: 20, borderRadius: 8, fontSize: 13, overflowX: "auto", margin: 0 }}>
        <code>{snippet}</code>
      </pre>
      <button
        onClick={() => void copy()}
        style={{ position: "absolute", top: 12, right: 12, padding: "6px 12px", background: copied ? "#25D366" : "#333", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
