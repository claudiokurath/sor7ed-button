import { describe, it, expect } from "vitest";
import { safeAuthReturn } from "./auth-return.js";
describe("post-login return destination", () => {
  const origin = "https://www.sor7ed.com";
  it("preserves valid same-origin flows and query parameters", () => {
    expect(safeAuthReturn("/save?flowId=one", origin)).toBe("/save?flowId=one");
    expect(safeAuthReturn(origin + "/dashboard/setup", origin)).toBe(
      "/dashboard/setup",
    );
  });
  it("rejects foreign, credentialed, scheme-relative and unrecognized paths", () => {
    for (const raw of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "https://user:pass@www.sor7ed.com/dashboard",
      "/api/auth/google",
    ])
      expect(safeAuthReturn(raw, origin)).toBe("/account");
  });
});
