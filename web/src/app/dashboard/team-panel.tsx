"use client";
import { useState, type FormEvent } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

interface Member {
  id: string;
  userId: string;
  email: string | null;
  role: string;
  createdAt: string;
}
interface Invite {
  id: string;
  email: string;
  createdAt: string;
}

// Lets a partner admin see who can log into this dashboard, invite a
// teammate (returns a shareable link — there's no outbound email sending
// anywhere in this product, same trust model as the WhatsApp connect
// link), and remove a member or revoke a pending invite. currentUserId
// is used only to stop someone removing themselves via this panel, since
// that would strand them without dashboard access mid-session.
export function TeamPanel({
  initialMembers,
  initialInvites,
  currentUserId,
}: {
  initialMembers: Member[];
  initialInvites: Invite[];
  currentUserId: string;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    setInviteUrl("");
    try {
      const res = await fetch(`${API_BASE}/api/partner/invites`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { inviteUrl?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setInviteUrl(body.inviteUrl ?? "");
      setInvites((prev) => [{ id: crypto.randomUUID(), email: email.trim(), createdAt: new Date().toISOString() }, ...prev]);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function revokeInvite(id: string) {
    setInvites((prev) => prev.filter((i) => i.id !== id));
    await fetch(`${API_BASE}/api/partner/invites/${id}`, { method: "DELETE", credentials: "include" }).catch(() => {});
  }

  async function removeMember(id: string) {
    if (members.length <= 1) {
      setError("Can't remove the last admin on this account.");
      return;
    }
    if (!confirm("Remove this teammate's dashboard access?")) return;
    const prev = members;
    setMembers((m) => m.filter((x) => x.id !== id));
    const res = await fetch(`${API_BASE}/api/partner/members/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      setMembers(prev);
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Failed to remove member");
    }
  }

  return (
    <div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px" }}>
        {members.map((m) => (
          <li
            key={m.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background: "#f9f9f9",
              borderRadius: 6,
              marginBottom: 6,
              fontSize: 14,
            }}
          >
            <span>
              {m.email ?? "(no email)"}
              {m.userId === currentUserId && <span style={{ color: "#999", fontSize: 12 }}> — you</span>}
            </span>
            {m.userId !== currentUserId && (
              <button
                onClick={() => void removeMember(m.id)}
                style={{ background: "none", border: "none", color: "#c00", cursor: "pointer", fontSize: 13 }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {invites.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 6 }}>Pending invites</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {invites.map((i) => (
              <li
                key={i.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "#fffdf5",
                  border: "1px dashed #e5d8a8",
                  borderRadius: 6,
                  marginBottom: 6,
                  fontSize: 14,
                }}
              >
                <span>{i.email}</span>
                <button
                  onClick={() => void revokeInvite(i.id)}
                  style={{ background: "none", border: "none", color: "#c00", cursor: "pointer", fontSize: 13 }}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={(e) => void sendInvite(e)} style={{ display: "flex", gap: 8 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          style={{ flex: 1, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{ padding: "8px 16px", background: "#25D366", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
        >
          {busy ? "Sending…" : "Invite"}
        </button>
      </form>

      {inviteUrl && (
        <div style={{ marginTop: 12, padding: 12, background: "#eefcf3", border: "1px solid #b8ecc9", borderRadius: 6 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13 }}>
            Invite created — send this link to your teammate (there&apos;s no automatic email yet, so copy and share it
            yourself):
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.target.select()}
              style={{ flex: 1, padding: "6px 10px", border: "1px solid #ccc", borderRadius: 6, fontSize: 12, background: "#fff" }}
            />
            <button
              onClick={() => void copyInvite()}
              style={{ padding: "6px 12px", background: "#1a7a3d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: "#c00", fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
