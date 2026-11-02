import { createHmac, timingSafeEqual } from "node:crypto";
import { Resolver } from "node:dns/promises";

const resolver = new Resolver({ timeout: 2000, tries: 1 });
const verified = new Map<string, number>();
const defaultResolve = resolver.resolveTxt.bind(resolver);

export function canonicalPartnerDomain(value: string): string {
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  if (
    host.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(
      host,
    )
  )
    throw new Error("Enter a public hostname such as example.com.");
  return host;
}

/** Partner-bound proof cannot be reused by another account on the same host. */
export function partnerDomainChallenge(
  partnerId: string,
  rawDomain: string,
  secret = process.env["JWT_SECRET"],
) {
  if (!secret) throw new Error("Domain verification is unavailable.");
  const domain = canonicalPartnerDomain(rawDomain);
  const digest = createHmac("sha256", secret)
    .update(`sor7ed-domain-v1:${partnerId}:${domain}`)
    .digest("hex");
  return {
    domain,
    name: `_sor7ed-verify.${domain}`,
    type: "TXT" as const,
    value: `sor7ed-verification=${digest}`,
  };
}

export async function verifyPartnerDomain(
  partnerId: string,
  domain: string,
  resolveTxt = defaultResolve,
): Promise<boolean> {
  try {
    const challenge = partnerDomainChallenge(partnerId, domain);
    const key = challenge.value;
    if (resolveTxt === defaultResolve && (verified.get(key) ?? 0) > Date.now())
      return true;
    const records = await resolveTxt(challenge.name);
    const valid = records.some((parts) => {
      const value = parts.join("");
      return (
        value.length === challenge.value.length &&
        timingSafeEqual(Buffer.from(value), Buffer.from(challenge.value))
      );
    });
    if (valid && resolveTxt === defaultResolve) {
      if (verified.size > 1000) verified.clear();
      verified.set(key, Date.now() + 5 * 60_000);
    }
    return valid;
  } catch {
    return false;
  }
}

export async function verifyPartnerUrl(
  partnerId: string,
  rawUrl: string,
  domains: readonly string[],
): Promise<boolean> {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  for (const raw of domains) {
    let domain: string;
    try {
      domain = canonicalPartnerDomain(raw);
    } catch {
      continue;
    }
    if (
      (host === domain || host.endsWith(`.${domain}`)) &&
      (await verifyPartnerDomain(partnerId, domain, defaultResolve))
    )
      return true;
  }
  return false;
}
