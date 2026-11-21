import Fastify, { type FastifyInstance } from "fastify";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  record: vi.fn(),
  safe: vi.fn(),
  prune: vi.fn(),
  select: vi.fn(),
}));
vi.mock("@sor7ed/core", () => ({
  db: { select: mock.select },
  partners: { apiKey: "key", allowedDomains: "domains" },
  savedItems: {},
  BROWSER_FUNNEL_EVENTS: [
    "widget_impression",
    "button_press",
    "popup_opened",
    "popup_blocked_fallback",
    "save_timeout",
  ],
  recordFunnelEvent: mock.record,
  recordFunnelSafely: mock.safe,
  pruneFunnelEvents: mock.prune,
  isUrlAllowedForPartner: (url: string) =>
    url.startsWith("https://publisher.example/"),
}));
import funnel from "./funnel.js";
describe("funnel observers and browser boundary", () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    vi.clearAllMocks();
    mock.record.mockResolvedValue(true);
    mock.safe.mockResolvedValue(undefined);
    mock.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [{ allowedDomains: ["publisher.example"] }],
        }),
      }),
    });
    process.env["WEB_ORIGIN"] = "https://www.sor7ed.com";
    process.env["CRON_SECRET"] = "fixture-cron";
    app = Fastify();
    await app.register(funnel);
    app.post("/api/saves", async (req, reply) => {
      const b = req.body as { fail?: boolean; deliveryStatus?: string };
      return b.fail
        ? reply.code(503).send({ error: "private failure" })
        : reply.code(201).send({
            shortId: "one",
            deliveryStatus: b.deliveryStatus ?? "accepted",
          });
    });
    app.get("/api/auth/google/callback", async (_req, reply) => {
      if (_req.headers["x-fixture-fail"])
        return reply.code(502).send({ error: "private provider error" });
      reply.header("set-cookie", "sor7ed_session=private; HttpOnly");
      return reply.redirect("/account");
    });
  });
  afterEach(async () => {
    await app.close();
  });
  const browser = (payload: unknown) =>
    app.inject({
      method: "POST",
      url: "/api/funnel-events",
      headers: {
        origin: "https://publisher.example",
        "content-type": "text/plain",
      },
      payload: JSON.stringify(payload),
    });
  it("accepts browser interactions but rejects forged save/auth/nudge outcomes", async () => {
    const b = {
      event: "button_press",
      eventId: "event-123",
      partnerApiKey: "public-key",
      pageUrl: "https://publisher.example/article?secret=x",
      meta: { page_load_id: "page-123" },
    };
    expect((await browser(b)).statusCode).toBe(204);
    expect(mock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "button_press",
        meta: { page_load_id: "page-123", source: "browser" },
      }),
    );
    for (const event of ["save_accepted", "google_completed", "nudge_sent"])
      expect((await browser({ ...b, event })).statusCode).toBe(400);
  });
  it("requires a page-load identity for impressions and refuses unknown origins", async () => {
    expect(
      (
        await browser({
          event: "widget_impression",
          eventId: "event-123",
          partnerApiKey: "public-key",
          pageUrl: "https://publisher.example/",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await browser({
          event: "button_press",
          eventId: "event-123",
          pageUrl: "https://publisher.example/",
        })
      ).statusCode,
    ).toBe(403);
  });
  it("observes accepted and failed saves without changing their response", async () => {
    const payload = {
      partnerApiKey: "public-key",
      idempotencyKey: "flow-123",
      url: "https://publisher.example/guide?secret=x",
      title: "private title",
      body: "private message",
    };
    const ok = await app.inject({ method: "POST", url: "/api/saves", payload });
    expect(ok.statusCode).toBe(201);
    expect(mock.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "save_accepted",
        dedupeKey: "save:one:save_accepted",
      }),
    );
    expect(JSON.stringify(mock.safe.mock.calls)).not.toContain("private title");
    expect(JSON.stringify(mock.safe.mock.calls)).not.toContain(
      "private message",
    );
    const failed = await app.inject({
      method: "POST",
      url: "/api/saves",
      payload: { ...payload, fail: true },
    });
    expect(failed.statusCode).toBe(503);
    expect(mock.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "save_failed",
        meta: expect.objectContaining({ http_status: 503 }),
      }),
    );
  });
  it("confirms Google completion from the successful server session response", async () => {
    expect(
      (await app.inject({ method: "GET", url: "/api/auth/google/callback" }))
        .statusCode,
    ).toBe(302);
    expect(mock.safe).toHaveBeenCalledWith(
      expect.objectContaining({ event: "google_completed" }),
    );
    expect(JSON.stringify(mock.safe.mock.calls)).not.toContain(
      "sor7ed_session",
    );
  });
  it("preserves pending, uncertain and skipped saves without declaring success", async () => {
    for (const [deliveryStatus, event] of [
      ["pending", "save_pending"],
      ["unknown", "save_timeout"],
      ["skipped", "save_failed"],
    ]) {
      mock.safe.mockClear();
      const response = await app.inject({
        method: "POST",
        url: "/api/saves",
        payload: { deliveryStatus },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json().deliveryStatus).toBe(deliveryStatus);
      expect(mock.safe).toHaveBeenCalledWith(
        expect.objectContaining({ event }),
      );
      expect(mock.safe).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: "save_accepted" }),
      );
    }
  });
  it("records failed Google callbacks and preserves responses if observation fails", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/auth/google/callback",
      headers: { "x-fixture-fail": "1" },
    });
    expect(response.statusCode).toBe(502);
    expect(mock.safe).toHaveBeenCalledWith(
      expect.objectContaining({ event: "google_failed" }),
    );
    mock.safe.mockRejectedValueOnce(new Error("analytics unavailable"));
    const saved = await app.inject({
      method: "POST",
      url: "/api/saves",
      payload: {},
    });
    expect(saved.statusCode).toBe(201);
    expect(saved.json()).toEqual({
      shortId: "one",
      deliveryStatus: "accepted",
    });
  });
  it("protects retention and does not prune aggregates through the API", async () => {
    expect(
      (await app.inject({ method: "GET", url: "/api/cron/funnel-retention" }))
        .statusCode,
    ).toBe(401);
    expect(mock.prune).not.toHaveBeenCalled();
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/cron/funnel-retention",
          headers: { authorization: "Bearer fixture-cron" },
        })
      ).statusCode,
    ).toBe(200);
    expect(mock.prune).toHaveBeenCalledTimes(1);
  });
});
