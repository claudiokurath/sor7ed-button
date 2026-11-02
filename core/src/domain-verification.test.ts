import { describe, it, expect } from "vitest";
import {
  canonicalPartnerDomain,
  partnerDomainChallenge,
  verifyPartnerDomain,
} from "./domain-verification.js";

describe("partner-bound domain ownership", () => {
  it("normalizes real hostnames and rejects URL, IP and record-name injection", () => {
    expect(canonicalPartnerDomain("WWW.Example.COM")).toBe("example.com");
    for (const domain of [
      "example.com/path",
      "https://example.com",
      "example.com:443",
      "127.0.0.1",
      "localhost",
      "example.com\nTXT",
    ])
      expect(() => canonicalPartnerDomain(domain)).toThrow();
  });
  it("proof for one partner cannot authorize another partner on the same domain", async () => {
    const secret = process.env["JWT_SECRET"];
    process.env["JWT_SECRET"] = "fixture-domain-secret";
    try {
      const a = partnerDomainChallenge("partner-a", "example.com");
      const b = partnerDomainChallenge("partner-b", "example.com");
      expect(a.value).not.toBe(b.value);
      expect(a.name).toBe("_sor7ed-verify.example.com");
      expect(
        await verifyPartnerDomain("partner-a", "example.com", async () => [
          [a.value],
        ]),
      ).toBe(true);
      expect(
        await verifyPartnerDomain("partner-b", "example.com", async () => [
          [a.value],
        ]),
      ).toBe(false);
      expect(
        await verifyPartnerDomain("partner-a", "example.com", async () => {
          throw new Error("DNS unavailable");
        }),
      ).toBe(false);
    } finally {
      if (secret === undefined) delete process.env["JWT_SECRET"];
      else process.env["JWT_SECRET"] = secret;
    }
  });
});
