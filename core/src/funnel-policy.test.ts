import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  partnerKeyHash,
  funnelPageUrl,
  funnelFlowId,
  funnelMeta,
} from "./funnel-policy.js";
import { weeklyNudgeCopy } from "./nudge-copy.js";
describe("privacy-limited funnel policy", () => {
  it("hashes keys and strips every URL query/fragment", () => {
    expect(partnerKeyHash("public-key")).toBe(
      createHash("sha256").update("public-key").digest("hex"),
    );
    expect(
      funnelPageUrl(
        "https://publisher.example/article?token=secret&email=someone#private",
      ),
    ).toBe("https://publisher.example/article");
    for (const value of [
      "https://name:password@example.com/",
      "data:text/plain,private",
      "invalid",
    ])
      expect(funnelPageUrl(value)).toBeNull();
  });
  it("normalizes legacy/fallback flow IDs without storing their original value", () => {
    const id = funnelFlowId("f-legacy-12345678");
    expect(id).toMatch(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
    expect(funnelFlowId("f-legacy-12345678")).toBe(id);
    expect(funnelFlowId("12345678-1234-1234-1234-123456789012")).toBe(
      "12345678-1234-1234-1234-123456789012",
    );
    expect(funnelFlowId("secret body text")).toBeNull();
  });
  it("drops arbitrary content, message bodies and secret metadata", () => {
    expect(
      funnelMeta({
        source: "browser",
        http_status: 503,
        title: "private",
        body: "message",
        partnerApiKey: "raw",
        email: "private",
        reason: "actual customer message",
      }),
    ).toEqual({ source: "browser", http_status: 503 });
    expect(() =>
      funnelMeta({ source: { toString: null }, reason: { toString: null } }),
    ).not.toThrow();
  });
  it("keeps the requested nudge copy and quick replies without sending anything", () => {
    expect(weeklyNudgeCopy(6, 2)).toEqual({
      body: "You kept 6 links this week and opened 2. Still want these?",
      quickReplies: [
        { id: "resurface_all", title: "Resurface all" },
        { id: "archive", title: "Archive" },
        { id: "quiet", title: "Quiet" },
      ],
    });
    expect(() => weeklyNudgeCopy(-1, 2)).toThrow();
  });
});
