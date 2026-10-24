"use client";
import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000";

type Stage = "CHECKING" | "ACCEPTING" | "SUCCESS" | "ERROR";

// Mirrors the WhatsApp CONNECT-link pattern used elsewhere in this
// product: an admin gets a shareable URL (no outbound email exists
// anywhere in the stack), and whoever opens it while signed in with
// Google accepts the invite for themselves. Client component because it
// needs to check auth state and call the accept endpoint on mount, then
// route to /dashboard on success.
export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params);
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("CHECKING");
  const [errorMsg, setErrorMsg] = useState("");
  const [partnerName, setPartnerName] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const me = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
      if (cancelled) return;

      if (!me.ok) {
        // Not signed in — send through Google, then land right back on
        // this exact invite URL to finish accepting it.
        const returnTo = encodeURIComponent(`${WEB_ORIGIN}/dashboard/invite/${token}`);
        window.location.href = `${API_BASE}/api/auth/login?returnTo=${returnTo}`;
        return;
      }

      setStage("ACCEPTING");
      const res = await fetch(`${API_BASE}/api/partner/invites/${token}/accept`, {
        method: "POST",
        credentials: "include",
      });
      if (cancelled) return;

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(body.error ?? "This invite couldn't be accepted.");
        setStage("ERROR");
        return;
      }

      const body = (await res.json()) as { partnerName: string };
      setPartnerName(body.partnerName);
      setStage("SUCCESS");
      setTimeout(() => router.push("/dashboard"), 1500);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <main style={{ fontFamily: "system-ui,sans-serif", maxWidth: 420, margin: "120px auto", padding: "0 24px", textAlign: "center" }}>
      {(stage === "CHECKING" || stage === "ACCEPTING") && <p style={{ color: "#666" }}>Joining the team…</p>}
      {stage === "SUCCESS" && (
        <>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>✓ You&apos;re in</p>
          <p style={{ color: "#666" }}>
            You now have dashboard access to {partnerName}. Taking you there…
          </p>
        </>
      )}
      {stage === "ERROR" && (
        <>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#c00" }}>Couldn&apos;t accept invite</p>
          <p style={{ color: "#666", marginBottom: 16 }}>{errorMsg}</p>
          <a href="/dashboard" style={{ color: "#25D366", fontWeight: 600 }}>
            Go to dashboard
          </a>
        </>
      )}
    </main>
  );
}
