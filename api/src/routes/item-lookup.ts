import { validClickProof } from "../lib/click-proof.js";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, savedItems, partners, recordSavedItemClick, isLeanMode } from "@sor7ed/core";

export async function itemLookupRoutes(app: FastifyInstance) {
  app.get<{ Params: { shortId: string } }>("/api/saves/:shortId", async (req, reply) => {
    const [item] = await db
      .select({
        id: savedItems.id,
        partnerId: savedItems.partnerId,
        title: savedItems.title,
        source: savedItems.source,
        description: savedItems.description,
        cachedImageUrl: savedItems.cachedImageUrl,
        imageUrl: savedItems.imageUrl,
        url: savedItems.url,
        partnerName: partners.name,
      })
      .from(savedItems)
      .leftJoin(partners, eq(savedItems.partnerId, partners.id))
      .where(eq(savedItems.shortId, req.params.shortId))
      .limit(1);

    if (!item) return reply.code(404).send({ error: "Not found" });
    const originalImage = item.imageUrl && URL.canParse(item.imageUrl) && new URL(item.imageUrl).protocol === "https:"
      ? item.imageUrl : null;
    const { imageUrl: _image, ...card } = item;
    return reply.send({ ...card, cachedImageUrl: item.cachedImageUrl ?? (isLeanMode() ? originalImage : null) });
  });

  // Only the website's explicit Continue action signs this proof. Browser
  // callers cannot mint it. Count at most one continuation per hashed network
  // address and saved item per day; these remain estimates, not unique people.
  app.post<{ Params: { shortId: string } }>("/api/saves/:shortId/click", {
    onRequest: async (req, reply) => {
      if(!validClickProof(req.params.shortId,req.headers['x-sor7ed-click-time'],req.headers['x-sor7ed-click-visitor'],req.headers['x-sor7ed-click-signature'],process.env['CLICK_TRACKING_SECRET']))return reply.code(401).send({error:'Not authorised.'});
    },
    config: { rateLimit: { max: 1, timeWindow: '24 hours', hook: 'preHandler', keyGenerator: req=>`${(req.params as {shortId:string}).shortId}:${req.headers['x-sor7ed-click-visitor']}` } },
  }, async (req, reply) => {
    const [item] = await db
      .select({ id: savedItems.id, partnerId: savedItems.partnerId })
      .from(savedItems)
      .where(eq(savedItems.shortId, req.params.shortId))
      .limit(1);

    if (!item) return reply.code(404).send({ error: "Not found" });
    await recordSavedItemClick(item.id, item.partnerId);
    return reply.code(204).send();
  });
}
