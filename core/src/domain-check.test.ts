import { describe, it, expect } from "vitest";
import { isUrlAllowedForPartner } from "./domain-check.js";

describe("isUrlAllowedForPartner", () => {
  it("rejects all URLs when no domains are verified", () => {
    expect(isUrlAllowedForPartner("https://anything.example/page", [])).toBe(false);
  });

  it("allows an exact hostname match", () => {
    expect(isUrlAllowedForPartner("https://example.com/page", ["example.com"])).toBe(true);
  });

  it("allows a subdomain of a registered domain", () => {
    expect(isUrlAllowedForPartner("https://shop.example.com/page", ["example.com"])).toBe(true);
  });

  it("treats www. as equivalent to the bare domain, on both sides", () => {
    expect(isUrlAllowedForPartner("https://www.example.com/page", ["example.com"])).toBe(true);
    expect(isUrlAllowedForPartner("https://example.com/page", ["www.example.com"])).toBe(true);
  });

  it("is case-insensitive on hostnames", () => {
    expect(isUrlAllowedForPartner("https://EXAMPLE.com/page", ["example.COM"])).toBe(true);
  });

  it("rejects a completely unrelated domain", () => {
    expect(isUrlAllowedForPartner("https://evil.com/page", ["example.com"])).toBe(false);
  });

  it("rejects a suffix-only lookalike domain (attack vector)", () => {
    // "notexample.com" must NOT match an allowlist of "example.com" — a naive
    // .endsWith("example.com") check (without the "." separator) would wrongly
    // allow this.
    expect(isUrlAllowedForPartner("https://notexample.com/page", ["example.com"])).toBe(false);
  });

  it("rejects a domain that merely contains the allowed domain as a substring", () => {
    expect(isUrlAllowedForPartner("https://example.com.evil.com/page", ["example.com"])).toBe(false);
  });

  it("returns false for a malformed URL instead of throwing", () => {
    expect(isUrlAllowedForPartner("not a url", ["example.com"])).toBe(false);
  });

  it("matches against any one of multiple allowed domains", () => {
    expect(isUrlAllowedForPartner("https://second.org/page", ["first.com", "second.org"])).toBe(true);
  });

  it("ignores an empty-string entry in allowedDomains without matching everything", () => {
    expect(isUrlAllowedForPartner("https://evil.com/page", [""])).toBe(false);
  });
});
