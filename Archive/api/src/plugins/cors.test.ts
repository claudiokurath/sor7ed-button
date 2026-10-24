import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerCors } from "./cors.js";

describe("dashboard CORS", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.stubEnv("WEB_ORIGIN", "https://sor7ed.com");
    app = Fastify();
    await registerCors(app);
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it.each([
    ["PUT", "/api/partner/allowed-domains"],
    ["DELETE", "/api/partner/members/member-id"],
    ["DELETE", "/api/partner/invites/invite-id"],
  ])("allows the dashboard %s request to %s", async (method, url) => {
    const response = await app.inject({
      method: "OPTIONS",
      url,
      headers: {
        origin: "https://sor7ed.com",
        "access-control-request-method": method,
        "access-control-request-headers": "content-type",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("https://sor7ed.com");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(String(response.headers["access-control-allow-methods"]).split(/,\s*/)).toContain(method);
  });

  it("does not grant credentialed access to an unlisted origin", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/partner/allowed-domains",
      headers: {
        origin: "https://unlisted.example",
        "access-control-request-method": "PUT",
      },
    });

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
