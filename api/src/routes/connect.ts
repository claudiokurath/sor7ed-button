import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { db, whatsappConnectionRequests, generateClickToChatUrl } from "@sor7ed/core";

export async function connectRoutes(app: FastifyInstance) {
  app.post("/api/whatsapp/connect", { preHandler: app.requireAuth }, async (req, reply) => {
    const userId = req.userId!; // guaranteed non-null by requireAuth

    // 8 random bytes = 16 hex chars = 64 bits of entropy — plenty for a
    // token with a 15-minute expiry window (set by the schema default).
    const token = crypto.randomBytes(8).toString("hex").toUpperCase();
    await db.insert(whatsappConnectionRequests).values({ userId, token, status: "pending" });

    return reply.send({ url: generateClickToChatUrl(token) });
  });
}
