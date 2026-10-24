import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PartnerKeyPanel } from "./partner-key-panel";
import { AllowedDomainsPanel } from "./allowed-domains-panel";
import { TeamPanel } from "./team-panel";

const API = process.env["API_INTERNAL_URL"] ?? "http://localhost:3001";
const API_PUBLIC = process.env["NEXT_PUBLIC_API_BASE_URL"] ?? API;
const WEB_ORIGIN = process.env["NEXT_PUBLIC_WEB_ORIGIN"] ?? "http://localhost:3000";

interface Partner {
  id: string;
  name: string;
  brandName: string | null;
  apiKey: string;
  buttonLabel: string;
  plan: string;
  monthlySaveLimit: number;
  savesThisMonth: number;
  allowedDomains: string[];
}
interface Analytics {
  totalSaves: number;
  uniqueSavers: number;
  savesToday: number;
  topPages: Array<{ url: string; title: string; saves: number }>;
  returnVisits: { itemsClicked: number; totalClicks: number; conversionRate: number };
}
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

async function serverFetch<T>(path: string): Promise<{ ok: true; data: T } | { ok: false }> {
  const jar = await cookies();
  const session = jar.get("sor7ed_session")?.value;
  if (!session) return { ok: false };
  const res = await fetch(`${API}${path}`, { headers: { Cookie: `sor7ed_session=${session}` }, cache: "no-store" });
  if (!res.ok) return { ok: false };
  return { ok: true, data: (await res.json()) as T };
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: "#f9f9f9", border: "1px solid #eee", borderRadius: 10, padding: "20px 24px", minWidth: 140 }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default async function DashboardPage() {
  // Check 1: is there a valid session at all? If not, go through Google.
  const me = await serverFetch<{ id: string }>("/api/auth/me");
  if (!me.ok) {
    const returnTo = encodeURIComponent(`${WEB_ORIGIN}/dashboard`);
    redirect(`${API_PUBLIC}/api/auth/login?returnTo=${returnTo}`);
  }

  // Check 2: session is valid — but does a partner account exist yet?
  // If not, this is NOT an auth problem, so it goes to the setup form,
  // not back through OAuth (which would loop, as explained above).
  const partnerResult = await serverFetch<Partner>("/api/partner");
  if (!partnerResult.ok) redirect("/dashboard/setup");
  const partner = partnerResult.data;

  const analyticsResult = await serverFetch<Analytics>("/api/partner/analytics");
  const analytics = analyticsResult.ok ? analyticsResult.data : null;

  const membersResult = await serverFetch<{ members: Member[]; invites: Invite[] }>("/api/partner/members");
  const members = membersResult.ok ? membersResult.data.members : [];
  const invites = membersResult.ok ? membersResult.data.invites : [];

  const usagePercent = partner.monthlySaveLimit > 0 ? Math.min(100, Math.round((partner.savesThisMonth / partner.monthlySaveLimit) * 100)) : 0;

  return (
    <main style={{ fontFamily: "system-ui,sans-serif", maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ margin: "0 0 24px" }}>{partner.brandName ?? partner.name}</h1>

      {partner.allowedDomains.length === 0 && (
        // Surfaced at the very top, not just inside the panel further down the
        // page, because an unrestricted embed key is a real exposure: anyone
        // who copies the <script> tag's data-api-key can embed the button on
        // an unrelated site and consume this partner's monthly save quota.
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "#fff7e6",
            border: "1px solid #f5c56b",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          <span style={{ fontSize: 18 }} aria-hidden="true">
            ⚠️
          </span>
          <span style={{ flex: 1 }}>
            <strong>Your embed key isn&apos;t locked to a domain yet</strong> — anyone with your snippet could embed it
            anywhere and use up your monthly saves.
          </span>
          <a href="#allowed-domains" style={{ color: "#8a5a00", fontWeight: 600, whiteSpace: "nowrap" }}>
            Lock it down →
          </a>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
        <StatCard label="Total saves" value={analytics?.totalSaves ?? 0} />
        <StatCard label="Saves today" value={analytics?.savesToday ?? 0} />
        <StatCard label="Unique savers" value={analytics?.uniqueSavers ?? 0} />
        <StatCard label="Monthly usage" value={`${partner.savesThisMonth} / ${partner.monthlySaveLimit}`} />
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>Monthly save usage — {usagePercent}%</div>
        <div style={{ height: 8, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${usagePercent}%`, background: usagePercent >= 90 ? "#e55" : "#25D366" }} />
        </div>
      </div>

      {analytics && analytics.totalSaves > 0 && (
        // The actual ROI signal, surfaced prominently rather than buried in
        // a table: of everything saved, how many came back? A save that's
        // never reopened is just a bookmark; the conversion rate below is
        // proof the WhatsApp nudge is working, not just that the button
        // gets clicked.
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            background: "#eefcf3",
            border: "1px solid #b8ecc9",
            borderRadius: 10,
            padding: "18px 24px",
            marginBottom: 32,
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 700, color: "#1a7a3d" }}>{analytics.returnVisits.conversionRate}%</div>
          <div style={{ fontSize: 13, color: "#356b48", lineHeight: 1.5 }}>
            <strong>return-visit rate</strong> — {analytics.returnVisits.itemsClicked} of {analytics.totalSaves} saved
            items were reopened via WhatsApp{" "}
            {analytics.returnVisits.totalClicks > analytics.returnVisits.itemsClicked
              ? `(${analytics.returnVisits.totalClicks} total reopens)`
              : ""}
          </div>
        </div>
      )}

      {analytics && analytics.topPages.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Top saved pages</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #eee" }}>
                <th style={{ textAlign: "left", padding: "8px 0", color: "#666" }}>Page</th>
                <th style={{ textAlign: "right", padding: "8px 0", color: "#666" }}>Saves</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topPages.map((p) => (
                <tr key={p.url} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "10px 0" }}>
                    <div style={{ fontWeight: 500 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: "#999" }}>{p.url}</div>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600, padding: "10px 0" }}>{p.saves}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Your embed snippet</div>
        <PartnerKeyPanel initialApiKey={partner.apiKey} buttonLabel={partner.buttonLabel} />
      </div>

      <div id="allowed-domains" style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Allowed domains</div>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 12 }}>
          Your embed key only works for saves from these domains (and their subdomains).
        </p>
        <AllowedDomainsPanel initialDomains={partner.allowedDomains} />
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Team</div>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 12 }}>
          Anyone listed here can sign in and manage this dashboard.
        </p>
        <TeamPanel initialMembers={members} initialInvites={invites} currentUserId={me.data.id} />
      </div>
    </main>
  );
}
