// A partner's apiKey is public by design (it's printed in the embed
// snippet partners paste into their own site), so it carries no secrecy
// on its own — anyone who reads a partner's page source can read it too.
// Without this check, that visible key could be used to submit /api/saves
// requests for URLs that partner never served, burning their monthly
// quota, polluting their analytics with unrelated content, or laundering
// an SSRF target through a legitimate partner's account. This function is
// the actual gate: it confirms the URL being saved belongs to a domain
// the partner registered, independent of which request/Origin carried it.

/** Lowercases and strips a leading "www." label. "www." is common enough
 *  (partner site linked with/without it depending on the page) to
 *  special-case; any other subdomain is treated as a deliberate distinction. */
function normalizeHost(hostname: string): string {
  const lower = hostname.toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
}

// An empty allowedDomains list means "unrestricted" — this only applies to
// partner rows created before domain registration existed (or via manual
// DB edit). New partners always get one via the dashboard setup flow (see
// api/src/routes/partner.ts). Documented explicitly in the schema comment
// on partners.allowedDomains: tighten before go-live if any such rows exist.
export function isUrlAllowedForPartner(url: string, allowedDomains: readonly string[]): boolean {
  if (allowedDomains.length === 0) return true;

  let hostname: string;
  try {
    hostname = normalizeHost(new URL(url).hostname);
  } catch {
    return false;
  }

  return allowedDomains.some((raw) => {
    const allowed = normalizeHost(raw);
    if (!allowed) return false;
    return hostname === allowed || hostname.endsWith(`.${allowed}`);
  });
}
