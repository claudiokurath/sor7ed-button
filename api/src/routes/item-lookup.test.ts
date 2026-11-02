import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { createHmac } from "node:crypto";
import { it, expect, vi } from "vitest";
const { record } = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@sor7ed/core", () => {
  const q: any = {
    select: () => q,
    from: () => q,
    leftJoin: () => q,
    where: () => q,
    limit: async () => [
      {
        id: "fixture-item",
        partnerId: "partner",
        url: "https://example.com",
        title: "Resource",
        source: "extension",
        imageUrl: null,
        cachedImageUrl: null,
      },
    ],
  };
  return {
    db: q,
    savedItems: { partnerId: "partner", shortId: "short" },
    partners: { id: "partner" },
    recordSavedItemClick: record,
    isLeanMode: () => true,
  };
});
import { itemLookupRoutes } from "./item-lookup.js";
it("public lookups never count, unsigned clicks fail, and signed daily replay is limited", async () => {
  const old = process.env["CLICK_TRACKING_SECRET"];
  const secret = "fixture-click-secret";
  process.env["CLICK_TRACKING_SECRET"] = secret;
  const app = Fastify();
  await app.register(rateLimit, { global: false });
  await app.register(itemLookupRoutes);
  try {
    expect(
      (await app.inject({ url: "/api/saves/abc123def456" })).statusCode,
    ).toBe(200);
    expect(record).not.toHaveBeenCalled();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/saves/abc123def456/click",
        })
      ).statusCode,
    ).toBe(401);
    expect(record).not.toHaveBeenCalled();
    const time = String(Date.now()),
      visitor = "a".repeat(64),
      signature = createHmac("sha256", secret)
        .update(`abc123def456.${time}.${visitor}`)
        .digest("hex");
    const request = {
      method: "POST" as const,
      url: "/api/saves/abc123def456/click",
      headers: {
        "x-sor7ed-click-time": time,
        "x-sor7ed-click-visitor": visitor,
        "x-sor7ed-click-signature": signature,
      },
    };
    expect((await app.inject(request)).statusCode).toBe(204);
    expect((await app.inject(request)).statusCode).toBe(429);
    expect(record).toHaveBeenCalledOnce();
  } finally {
    await app.close();
    if (old === undefined) delete process.env["CLICK_TRACKING_SECRET"];
    else process.env["CLICK_TRACKING_SECRET"] = old;
  }
});
