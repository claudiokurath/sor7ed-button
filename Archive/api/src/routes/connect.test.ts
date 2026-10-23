import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createRequest, clickToChat } = vi.hoisted(() => ({
  createRequest: vi.fn(),
  clickToChat: vi.fn((token: string) => `https://wa.me/440000000000?text=CONNECT-${token}`),
}));
vi.mock("@sor7ed/core", () => ({
  createOrReuseConnectionRequest: createRequest,
  generateClickToChatUrl: clickToChat,
}));
import { connectRoutes } from "./connect.js";

describe("WhatsApp connection endpoint", () => {
  let app: FastifyInstance;
  const expiresAt = new Date("2030-01-02T03:19:05.000Z");

  beforeEach(async () => {
    vi.clearAllMocks();
    createRequest.mockResolvedValue({ token: "ABCDEF0123456789", expiresAt });
    app = Fastify();
    app.decorateRequest("userId", null);
    app.decorate("requireAuth", async (req, reply) => {
      const userId = req.headers["x-test-user"];
      if (typeof userId !== "string") {
        reply.code(401).send({ error: "Unauthenticated" });
        return;
      }
      req.userId = userId;
    });
    await app.register(rateLimit, { global: false });
    await app.register(connectRoutes);
  });

  afterEach(async () => { await app.close(); });

  it("requires an authenticated account before creating a link", async () => {
    const res = await app.inject({ method: "POST", url: "/api/whatsapp/connect" });
    expect(res.statusCode).toBe(401);
    expect(createRequest).not.toHaveBeenCalled();
  });

  it("asks core to reuse a live token and returns its expiry", async () => {
    const res = await app.inject({ method: "POST", url: "/api/whatsapp/connect", headers: { "x-test-user": "user-a" } });
    expect(res.statusCode).toBe(200);
    expect(createRequest).toHaveBeenCalledWith("user-a", false);
    expect(res.json()).toEqual({
      url: "https://wa.me/440000000000?text=CONNECT-ABCDEF0123456789",
      expiresAt: expiresAt.toISOString(),
    });
    expect(clickToChat).toHaveBeenCalledWith("ABCDEF0123456789");
  });

  it("refreshes only when the authenticated caller explicitly requests it", async () => {
    const res = await app.inject({ method: "POST", url: "/api/whatsapp/connect", headers: { "x-test-user": "user-a" }, payload: { refresh: true } });
    expect(res.statusCode).toBe(200);
    expect(createRequest).toHaveBeenCalledWith("user-a", true);
  });

  it.each([{ refresh: "true" }, { userId: "other-user" }, []])("rejects malformed or identity-overriding bodies: %j", async (payload) => {
    const res = await app.inject({ method: "POST", url: "/api/whatsapp/connect", headers: { "x-test-user": "user-a" }, payload });
    expect(res.statusCode).toBe(400);
    expect(createRequest).not.toHaveBeenCalled();
  });

  it("retains the ten-per-minute limit per authenticated user", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({ method: "POST", url: "/api/whatsapp/connect", headers: { "x-test-user": "user-a" } });
      expect(res.statusCode).toBe(200);
    }
    const limited = await app.inject({ method: "POST", url: "/api/whatsapp/connect", headers: { "x-test-user": "user-a" }, payload: { refresh: true } });
    expect(limited.statusCode).toBe(429);
    expect(createRequest).toHaveBeenCalledTimes(10);

    const otherUser = await app.inject({ method: "POST", url: "/api/whatsapp/connect", headers: { "x-test-user": "user-b" } });
    expect(otherUser.statusCode).toBe(200);
    expect(createRequest).toHaveBeenLastCalledWith("user-b", false);
  });
});
