import type { NextConfig } from "next";

// Website links issued before the domain split must still reach their original
// content (including signed WhatsApp links). Button routes remain on sor7ed.com.
const websitePaths = [
  "/go/:slug", "/r/:path*", "/tools/:path*", "/intelligence/:path*",
  "/protocols/:path*", "/category/:path*",
  "/about", "/brain-type", "/start", "/membership", "/signup", "/login",
  "/connect", "/privacy", "/terms", "/cookies", "/contact", "/faq", "/sounds",
  "/auth/whatsapp-confirm", "/auth/callback", "/auth/confirm",
  "/brain-dump-sorter", "/financial-autopilot", "/decision-paralysis-solver",
  "/biometric-state-tracker", "/adhd-tax-calculator", "/weekly-wins-generator",
  "/task-breakdown-wizard",
  "/embed/brain-dump-sorter", "/embed/financial-autopilot",
  "/embed/decision-paralysis-solver", "/embed/biometric-state-tracker",
  "/embed/adhd-tax-calculator", "/embed/weekly-wins-generator",
  "/embed/task-breakdown-wizard",
];

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return ["sor7ed.com", "www.sor7ed.com"].flatMap((host) =>
      websitePaths.map((source) => ({
        source,
        has: [{ type: "host" as const, value: host.replace(/\./g, "\\.") }],
        destination: `https://www.planetsorted.com${source}`,
        permanent: false,
      })),
    );
  },
  // widget.js is a static public asset — no special rewrite needed.
};

export default nextConfig;
