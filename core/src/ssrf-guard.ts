// Guards every server-side fetch the enrichment worker makes against a
// saved item's own url/imageUrl (core/src/enrichment.ts). Those values
// come from whatever a partner's page — or a directly-forged /api/saves
// call — supplies, so without this check the worker is an open SSRF
// proxy: a malicious save pointing at http://169.254.169.254/... (cloud
// metadata) or an internal-only host would have the worker fetch it
// obediently, server-side, with no browser sandbox in the way.
//
// Checks both the literal hostname AND its resolved IP(s) — the latter
// specifically defeats DNS rebinding, where a public-looking hostname
// resolves to a private-range IP at fetch time.
import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

// IPv4 ranges: loopback, link-local (incl. cloud metadata 169.254.169.254),
// RFC1918 private space, and the shared address space used by some cloud
// NAT/metadata setups (100.64.0.0/10).
const BLOCKED_IPV4_RANGES: Array<[string, number]> = [
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["10.0.0.0", 8],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["100.64.0.0", 10],
  ["0.0.0.0", 8],
];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isBlockedIpv4(ip: string): boolean {
  const target = ipv4ToInt(ip);
  return BLOCKED_IPV4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (target & mask) === (ipv4ToInt(base) & mask);
  });
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // ::1 (loopback), fe80::/10 (link-local), fc00::/7 (unique local / ULA).
  return lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd");
}

function isBlockedIp(ip: string): boolean {
  return net.isIP(ip) === 4 ? isBlockedIpv4(ip) : isBlockedIpv6(ip);
}

/** Throws if the URL is unsafe for the worker to fetch server-side.
 *  Callers (scrapeOg, fetchAndResizeImage) already wrap their fetches in
 *  try/catch and degrade gracefully, so a thrown error here becomes the
 *  same "skip this enrichment step" behaviour as any other fetch failure
 *  — no separate handling needed at the call site. */
export async function assertSafeToFetch(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Blocked scheme: ${url.protocol}`);
  }

  // WHATWG URL keeps the [...] brackets in .hostname for IPv6 literals
  // (e.g. "[::1]") — net.isIP() rejects the bracketed form outright (returns
  // 0, "not an IP"), which would let a bracketed IPv6 literal fall through
  // to the DNS-lookup branch below instead of being range-checked directly,
  // and then fail there with ENOTFOUND rather than the intended block.
  // Stripping brackets before every check closes that gap.
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`Blocked hostname: ${hostname}`);
  }

  // A literal IP in the URL still needs range-checking directly — dns.lookup
  // on a literal IP just returns that same IP, so this isn't a special case,
  // but resolving it explicitly avoids relying on that implementation detail.
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error(`Blocked IP literal: ${hostname}`);
    return;
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new Error(`DNS resolution returned no records: ${hostname}`);
  for (const record of records) {
    if (isBlockedIp(record.address)) {
      throw new Error(`Blocked resolved IP for ${hostname}: ${record.address}`);
    }
  }
}

const MAX_REDIRECTS = 3;

// Plain fetch() with redirect:"follow" (the default) validates only the
// URL you hand it — a 302 to an internal host is followed silently, with
// this module's check never seeing the hop it actually landed on. This
// wrapper re-runs assertSafeToFetch on every redirect target before
// following it, closing exactly that gap for the two enrichment.ts
// callers (scrapeOg's html fetch, fetchAndResizeImage's image fetch).
export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let currentUrl = rawUrl;

  for (let redirectCount = 0; ; redirectCount++) {
    await assertSafeToFetch(currentUrl);

    const res = await fetch(currentUrl, { ...init, redirect: "manual" });

    const isRedirect = res.status >= 300 && res.status < 400;
    if (!isRedirect) return res;

    if (redirectCount >= MAX_REDIRECTS) throw new Error(`Too many redirects fetching ${rawUrl}`);
    const location = res.headers.get("location");
    if (!location) return res; // redirect status with no Location — nothing to follow, hand back as-is
    currentUrl = new URL(location, currentUrl).toString();
  }
}
