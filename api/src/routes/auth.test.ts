import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@sor7ed/core", () => ({
  db: { insert },
  users: { email: "email" },
  isLeanMode: () => true,
  isWhatsAppSessionOpen: async () => false,
}));
vi.mock("@fastify/oauth2", () => ({ default: async () => {} }));
import { authRoutes } from "./auth.js";
const before = {
  id: process.env["GOOGLE_CLIENT_ID"],
  secret: process.env["GOOGLE_CLIENT_SECRET"],
  origin: process.env["WEB_ORIGIN"],
};
beforeEach(() => {
  vi.clearAllMocks();
  process.env["GOOGLE_CLIENT_ID"] = "fixture";
  process.env["GOOGLE_CLIENT_SECRET"] = "fixture";
  process.env["WEB_ORIGIN"] = "https://www.sor7ed.com";
  const chain: any = {
    values: () => chain,
    onConflictDoUpdate: () => chain,
    returning: async () => [{ id: "fixture-user" }],
  };
  insert.mockReturnValue(chain);
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const [key, value] of [
    ["GOOGLE_CLIENT_ID", before.id],
    ["GOOGLE_CLIENT_SECRET", before.secret],
    ["WEB_ORIGIN", before.origin],
  ]) {
    if (value === undefined) delete process.env[key!];
    else process.env[key!] = value;
  }
});
async function app() {
  const a = Fastify();
  await a.register(cookie);
  a.decorate("requireAuth", async () => {});
  a.decorate("googleOAuth2", {
    getAccessTokenFromAuthorizationCodeFlow: async () => ({
      token: { access_token: "fixture-google-token" },
    }),
  } as any);
  a.decorateReply("jwtSign", async () => "fixture-session");
  await authRoutes(a);
  return a;
}
it("unverified Google email never creates or links an account", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          id: "google-user",
          email: "member@example.invalid",
          verified_email: false,
        }),
      ),
  );
  const a = await app();
  try {
    const r = await a.inject({ url: "/api/auth/google/callback" });
    expect(r.statusCode).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  } finally {
    await a.close();
  }
});
it("verified Google login revalidates a tampered return cookie", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          id: "google-user",
          email: "member@example.invalid",
          verified_email: true,
        }),
      ),
  );
  const a = await app();
  try {
    const r = await a.inject({
      url: "/api/auth/google/callback",
      headers: { cookie: "returnTo=https%3A%2F%2Fevil.example" },
    });
    expect(r.statusCode).toBe(302);
    expect(r.headers.location).toBe("https://www.sor7ed.com/account");
    expect(insert).toHaveBeenCalledOnce();
  } finally {
    await a.close();
  }
});
