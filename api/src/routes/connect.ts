import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { db, whatsappConnectionRequests, generateClickToChatUrl } from "@sor7ed/core";

export async function connectRoutes(app: FastifyInstance) {
  app.post(
    "/api/whatsapp/connect",
    {
      preHandler: app.requireAuth,
      config: {
        rateLimit: {
          // Each call mints a new pending connection-request token — an
          // unbounded caller could otherwise flood whatsapp_connection_requests
          // with rows. Same hook/keyGenerator pattern as /api/saves: fire on
          // preHandler (after requireAuth has set req.userId), not the
          // default onRequest hook, so the limit is keyed per-user rather
          // than per-IP.
          max: 10,
          timeWindow: "1 minute",
          hook: "preHandler",
          keyGenerator: (req) => req.userId ?? req.ip,
        },
      },
    },
    async (req, reply) => {
      const userId = req.userId!; // guaranteed non-null by requireAuth

      // 8 random bytes = 16 hex chars = 64 bits of entropy — plenty for a
      // token with a 15-minute expiry window (set by the schema default).
      const token = crypto.randomBytes(8).toString("hex").toUpperCase();
      await db.insert(whatsappConnectionRequests).values({ userId, token, status: "pending" });

      return reply.send({ url: generateClickToChatUrl(token) });
    }
  );
}
