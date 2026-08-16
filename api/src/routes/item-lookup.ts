import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, savedItems, partners } from "@sor7ed/core";

export async function itemLookupRoutes(app: FastifyInstance) {
  app.get<{ Params: { shortId: string } }>("/api/saves/:shortId", async (req, reply) => {
    const [item] = await db
      .select({
        title: savedItems.title,
        description: savedItems.description,
        cachedImageUrl: savedItems.cachedImageUrl,
        url: savedItems.url,
        partnerName: partners.name,
      })
      .from(savedItems)
      .leftJoin(partners, eq(savedItems.partnerId, partners.id))
      .where(eq(savedItems.shortId, req.params.shortId))
      .limit(1);

    if (!item) return reply.code(404).send({ error: "Not found" });
    return reply.send(item);
  });
}
