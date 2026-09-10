import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { db, savedItems, partners, users, enqueueEnrichment, sendSaveCard, isUrlAllowedForPartner } from "@sor7ed/core";
import { saveBodySchema } from "../schemas/saves.js";
import { parseBody } from "../schemas/validate.js";

interface PartnerRow extends Record<string, unknown> {
  id: string;
  name: string;
  brand_name: string | null;
}

export async function saveRoutes(app: FastifyInstance) {
  app.post(
    "/api/saves",
    {
      preHandler: app.requireAuth,
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute",
          // hook: "preHandler" (rather than the plugin's default of
          // onRequest) matters here — onRequest fires before this route's
          // own preHandler (requireAuth) has run, so req.userId would
          // still be null when keyGenerator reads it. Registering on the
          // preHandler hook appends this check to the end of the
          // preHandler chain (Fastify's rate-limit plugin pushes onto the
          // existing array rather than replacing it), so requireAuth has
          // already set req.userId by the time this runs. Confirmed by
          // reading @fastify/rate-limit's source directly rather than
          // assuming the default hook's timing.
          hook: "preHandler",
          keyGenerator: (req) => req.userId ?? req.ip,
        },
      },
    },
    async (req, reply) => {
      const userId = req.userId!; // guaranteed non-null by requireAuth

      const body = parseBody(saveBodySchema, req.body, reply);
      if (!body) return;
      const { partnerApiKey, url, title, description, imageUrl } = body;

      // Domain ownership check runs BEFORE the atomic quota increment
      // below, and as a separate, non-mutating lookup — a request that
      // fails this check must not cost the partner any quota. apiKey
      // itself is public (printed in the embed snippet every partner
      // pastes into their own site), so it carries no secrecy on its
      // own; this is what actually stops someone who's read a partner's
      // page source from submitting saves under that partner's account
      // for URLs that partner never served. See domain-check.ts.
      const [partnerForDomainCheck] = await db
        .select({ allowedDomains: partners.allowedDomains })
        .from(partners)
        .where(eq(partners.apiKey, partnerApiKey))
        .limit(1);
      if (!partnerForDomainCheck) {
        return reply.code(403).send({ error: "Invalid partner API key" });
      }
      if (!isUrlAllowedForPartner(url, partnerForDomainCheck.allowedDomains)) {
        return reply.code(403).send({ error: "This URL's domain is not registered to this partner account" });
      }

      // Atomic check-and-increment — avoids the read/update race of checking
      // savesThisMonth in one query and updating it in a later, separate one.
      const result = await db.execute<PartnerRow>(sql`
        UPDATE partners
        SET saves_this_month = saves_this_month + 1
        WHERE api_key = ${partnerApiKey} AND saves_this_month < monthly_save_limit
        RETURNING id, name, brand_name
      `);
      const partner = result.rows[0];

      if (!partner) {
        const [exists] = await db.select({ id: partners.id }).from(partners).where(eq(partners.apiKey, partnerApiKey)).limit(1);
        return reply.code(exists ? 429 : 403).send({
          error: exists ? "Monthly save limit reached for this partner" : "Invalid partner API key",
        });
      }

      const [user] = await db
        .select({ whatsappNumber: users.whatsappNumber, whatsappVerified: users.whatsappVerified })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user) return reply.code(404).send({ error: "User not found" });

      const [item] = await db
        .insert(savedItems)
        .values({ userId, partnerId: partner.id, url, title, description: description ?? null, imageUrl: imageUrl ?? null })
        .returning();
      if (!item) return reply.code(500).send({ error: "Failed to create saved item" });

      // Both of the following are non-fatal — the save is already committed
      // regardless of whether enrichment enqueues or WhatsApp delivery succeeds.
      await enqueueEnrichment(item.id).catch((err) => app.log.error({ err }, "Failed to enqueue enrichment job"));

      if (user.whatsappVerified && user.whatsappNumber) {
        await sendSaveCard(userId, user.whatsappNumber, item, partner.brand_name ?? partner.name).catch((err) =>
          app.log.error({ err }, "Failed to send WhatsApp save card")
        );
      }

      return reply.code(201).send({ shortId: item.shortId, cardUrl: `${process.env["BASE_URL"]}/s/${item.shortId}` });
    }
  );
}
