import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, savedItems, partners, recordSavedItemClick } from "@sor7ed/core";

export async function itemLookupRoutes(app: FastifyInstance) {
  app.get<{ Params: { shortId: string } }>("/api/saves/:shortId", async (req, reply) => {
    const [item] = await db
      .select({
        id: savedItems.id,
        partnerId: savedItems.partnerId,
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

  // Fired by web/src/app/s/[shortId]/page.tsx exactly once per real (non-
  // crawler) visit, right before it redirects the person back to the
  // partner's page — this is the "return visit" signal shown in the
  // partner dashboard. Deliberately separate from the GET above, which is
  // also hit by link-preview crawlers (WhatsApp, Slack, etc.) fetching OG
  // tags and by Next's revalidate:60 cache — neither of those should ever
  // count as a click. Fire-and-forget from the caller's perspective: a
  // failure here must never block the redirect itself.
  app.post<{ Params: { shortId: string } }>("/api/saves/:shortId/click", async (req, reply) => {
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
