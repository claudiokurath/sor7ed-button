export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 32, letterSpacing: "0.04em", marginBottom: 8 }}>SOR7ED BUTTON</h1>
      <p style={{ color: "#555", fontSize: 18, marginBottom: 32 }}>
        Save it. Get it on WhatsApp.
      </p>
      <p style={{ color: "#666", lineHeight: 1.6, marginBottom: 24 }}>
        The partner Save-to-WhatsApp product. Site owners embed one script tag;
        visitors save any page straight into their WhatsApp library.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a
          href="/demo"
          style={{
            display: "inline-block",
            padding: "12px 20px",
            background: "#25D366",
            color: "#fff",
            borderRadius: 8,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Try the live demo →
        </a>
        <a
          href="/dashboard"
          style={{
            display: "inline-block",
            padding: "12px 20px",
            background: "#fff",
            color: "#111",
            border: "1px solid #ddd",
            borderRadius: 8,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Partner dashboard →
        </a>
      </div>
      <p style={{ color: "#999", fontSize: 13, marginTop: 48 }}>
        Part of the SOR7ED family · separate from{" "}
        <a href="https://planetsorted.com" style={{ color: "#666" }}>
          planetsorted.com
        </a>
      </p>
    </main>
  );
}
