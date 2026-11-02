import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { validClickProof } from "./click-proof.js";
describe("server-only click proof", () => {
  it("binds the item, timestamp and visitor and rejects expired or forged inputs", () => {
    const secret = "fixture-click-key",
      now = Date.now(),
      time = String(now),
      visitor = "a".repeat(64);
    const sig = createHmac("sha256", secret)
      .update(`saved-item.${time}.${visitor}`)
      .digest("hex");
    expect(validClickProof("saved-item", time, visitor, sig, secret, now)).toBe(
      true,
    );
    expect(validClickProof("other-item", time, visitor, sig, secret, now)).toBe(
      false,
    );
    expect(
      validClickProof("saved-item", time, "b".repeat(64), sig, secret, now),
    ).toBe(false);
    expect(
      validClickProof("saved-item", time, visitor, sig, secret, now + 301000),
    ).toBe(false);
    expect(
      validClickProof("saved-item", time, visitor, sig, undefined, now),
    ).toBe(false);
  });
});
