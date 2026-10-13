import type { FastifyInstance } from "fastify";
import { createOrReuseConnectionRequest, generateClickToChatUrl } from "@sor7ed/core";
import { z } from "zod";
import { parseBody } from "../schemas/validate.js";

const connectBodySchema = z.object({ refresh: z.boolean().optional() }).strict();

export async function connectRoutes(app: FastifyInstance) {
  app.post(
    "/api/whatsapp/connect",
    {
      preHandler: app.requireAuth,
      config: {
        rateLimit: {
          // Reuse live links, but still bound explicit refresh/token creation.
          // Same hook/keyGenerator pattern as /api/saves: fire on
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
      const body = parseBody(connectBodySchema, req.body ?? {}, reply);
      if (!body) return;
      const request = await createOrReuseConnectionRequest(userId, body.refresh === true);

      return reply.send({ url: generateClickToChatUrl(request.token), expiresAt: request.expiresAt.toISOString() });
    }
  );
}
