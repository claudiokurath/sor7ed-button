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
  async headers() {
    const api = new URL(process.env["NEXT_PUBLIC_API_BASE_URL"] ?? 'https://api.sor7ed.com').origin;
    const csp = ["default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'", "frame-src 'none'",
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''),
      "style-src 'self' 'unsafe-inline'", "img-src 'self' data: https:", "font-src 'self'", `connect-src 'self' ${api}`, "form-action 'self'",
      ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : [])].join('; ');
    return [
      { source: '/:path*', headers: [
        { key: 'Content-Security-Policy', value: csp }, { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ] },
      { source: '/fonts/:path*', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] },
      { source: '/widget-font.css', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] },
      ...['/account/:path*','/dashboard/:path*','/signin','/save/:path*','/s/:path*'].map(source=>({source,headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]})),
    ];
  },
  // The widget remains a public script; its save flow opens a top-level popup.
};

export default nextConfig;
