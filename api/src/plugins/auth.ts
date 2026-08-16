// Centralizes session verification in one decorator, rather than repeating
// req.jwtVerify() inline in every route — the same reasoning that put the
// WhatsApp session-window check in a single function back in Phase 3.
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import { getPartnerForUser } from "@sor7ed/core";

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePartnerAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string | null;
    partnerId: string | null;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

async function verifySession(req: FastifyRequest): Promise<string> {
  await req.jwtVerify({ onlyCookie: true });
  return req.user.sub;
}

export default fp(async function authPlugin(app: FastifyInstance) {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET is not set");

  await app.register(cookie);
  await app.register(jwt, {
    secret,
    cookie: { cookieName: "sor7ed_session", signed: false },
  });

  app.decorateRequest("userId", null);
  app.decorateRequest("partnerId", null);

  app.decorate("requireAuth", async function (req: FastifyRequest, reply: FastifyReply) {
    try {
      req.userId = await verifySession(req);
    } catch {
      return reply.code(401).send({ error: "Unauthenticated" });
    }
  });

  app.decorate("requirePartnerAuth", async function (req: FastifyRequest, reply: FastifyReply) {
    try {
      req.userId = await verifySession(req);
    } catch {
      return reply.code(401).send({ error: "Unauthenticated" });
    }
    const partner = await getPartnerForUser(req.userId);
    if (!partner) return reply.code(403).send({ error: "No partner account associated with this user" });
    req.partnerId = partner.id;
  });
});
