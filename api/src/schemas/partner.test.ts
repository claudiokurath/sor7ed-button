import { describe, it, expect } from "vitest";
import { createPartnerBodySchema, updateAllowedDomainsBodySchema, createInviteBodySchema } from "./partner.js";

describe("createPartnerBodySchema", () => {
  it("accepts a minimal valid body (name only)", () => {
    const result = createPartnerBodySchema.safeParse({ name: "Acme Co" });
    expect(result.success).toBe(true);
  });

  it("accepts allowedDomains and lowercases them", () => {
    const result = createPartnerBodySchema.safeParse({
      name: "Acme Co",
      allowedDomains: ["Example.COM", "shop.example.com"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allowedDomains).toEqual(["example.com", "shop.example.com"]);
    }
  });

  it("rejects a domain containing a slash (path, not a bare hostname)", () => {
    const result = createPartnerBodySchema.safeParse({
      name: "Acme Co",
      allowedDomains: ["example.com/path"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a domain containing a space", () => {
    const result = createPartnerBodySchema.safeParse({
      name: "Acme Co",
      allowedDomains: ["example .com"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 20 allowedDomains", () => {
    const result = createPartnerBodySchema.safeParse({
      name: "Acme Co",
      allowedDomains: Array.from({ length: 21 }, (_, i) => `d${i}.com`),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = createPartnerBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects an empty name after trim", () => {
    const result = createPartnerBodySchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });
});

describe("updateAllowedDomainsBodySchema", () => {
  it("requires allowedDomains (not optional, unlike create)", () => {
    const result = updateAllowedDomainsBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts an empty array (explicitly disabling saves)", () => {
    const result = updateAllowedDomainsBodySchema.safeParse({ allowedDomains: [] });
    expect(result.success).toBe(true);
  });

  it("accepts a valid list of domains", () => {
    const result = updateAllowedDomainsBodySchema.safeParse({
      allowedDomains: ["example.com", "sub.example.com"],
    });
    expect(result.success).toBe(true);
  });
});

describe("createInviteBodySchema", () => {
  it("accepts a valid email and lowercases it", () => {
    const result = createInviteBodySchema.safeParse({ email: "Alice@Example.COM" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("alice@example.com");
  });

  it("rejects a malformed email", () => {
    const result = createInviteBodySchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing email", () => {
    const result = createInviteBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
