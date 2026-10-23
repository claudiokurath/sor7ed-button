import Script from "next/script";

// The actual sales tool: a fake "partner article" page with the real
// embeddable widget dropped on it in demo mode (data-demo="true" instead
// of a data-api-key), so a prospect can click the exact button their own
// visitors would see and watch the full save->WhatsApp-card motion play
// out — see widget.js's isDemo handling and /save/demo's simulated flow
// for how this stays 100% client-side (no account, no real WhatsApp
// number, nothing written to the database). This page itself is the
// "partner site" being demonstrated; there is no separate mock site to host.
const DEMO_ARTICLE = {
  title: "The Case for Reading Things Twice",
  description:
    "Most of what you save online, you never open again. Here's why that's the wrong problem to be solving.",
  image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&q=80",
};

export const metadata = {
  title: "Live demo — SOR7ED BUTTON",
  description: "Try the Save to WhatsApp button with no signup required.",
};

export default function DemoPage() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px 96px" }}>
      <div
        style={{
          display: "inline-block",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#8a5a00",
          background: "#fff7e6",
          border: "1px solid #f5c56b",
          borderRadius: 999,
          padding: "4px 12px",
          marginBottom: 24,
        }}
      >
        Live interactive demo
      </div>

      <p style={{ color: "#666", fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
        This page is standing in for a partner&apos;s site. The button below is the real, unmodified
        embeddable widget — click it to see exactly what a visitor experiences, right down to a
        mockup of the WhatsApp message that lands in their chat. No account, no real phone number,
        nothing saved anywhere.
      </p>

      {/* --- fake article, exactly what a partner's page looks like --- */}
      <article style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden", marginBottom: 32 }}>
        <img src={DEMO_ARTICLE.image} alt="" style={{ width: "100%", height: 260, objectFit: "cover", display: "block" }} />
        <div style={{ padding: 24 }}>
          <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>{DEMO_ARTICLE.title}</h1>
          <p style={{ color: "#555", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>{DEMO_ARTICLE.description}</p>
          <div id="sor7ed-demo-slot" data-sor7ed />
        </div>
      </article>

      <div style={{ textAlign: "center" }}>
        <a
          href="/dashboard"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "#25D366",
            color: "#fff",
            borderRadius: 8,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Get this on my own site →
        </a>
      </div>

      {/* The exact snippet a real partner pastes — data-demo="true" is the
          only thing that differs from a live embed, and it's what routes
          the click to the simulated flow above instead of the real one. */}
      <Script src="/widget.js" data-demo="true" data-label="Save this article" strategy="afterInteractive" />
    </main>
  );
}
