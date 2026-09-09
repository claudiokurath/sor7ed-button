import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db, partners, partnerMembers, getPartnerForUser, getPartnerAnalytics } from "@sor7ed/core";
import { createPartnerBodySchema, updateAllowedDomainsBodySchema } from "../schemas/partner.js";
import { parseBody } from "../schemas/validate.js";

interface RotatedKeyRow extends Record<string, unknown> {
  apiKey: string;
}

export async function partnerRoutes(app: FastifyInstance) {
  // Used by the dashboard on load to decide between the analytics view
  // and the setup wizard.
  app.get("/api/partner", { preHandler: app.requireAuth }, async (req, reply) => {
    const partner = await getPartnerForUser(req.userId!);
    if (!partner) return reply.code(404).send({ error: "No partner account found" });
    return reply.send(partner);
  });

  // One partner per user for now — the unique index on partner_members
  // enforces this at the database level too, so a genuine race between two
  // duplicate requests fails with a clean constraint violation, not a
  // silent double-insert.
  app.post("/api/partner", { preHandler: app.requireAuth }, async (req, reply) => {
    const existing = await getPartnerForUser(req.userId!);
    if (existing) return reply.code(409).send({ error: "You already have a partner account" });

    const body = parseBody(createPartnerBodySchema, req.body, reply);
    if (!body) return;
    const { name, brandName, allowedDomains } = body;

    const [partner] = await db
      .insert(partners)
      .values({ name, brandName: brandName ?? null, allowedDomains: allowedDomains ?? [] })
      .returning();
    if (!partner) return reply.code(500).send({ error: "Failed to create partner" });

    await db.insert(partnerMembers).values({ userId: req.userId!, partnerId: partner.id, role: "admin" });
    return reply.code(201).send(partner);
  });

  app.get("/api/partner/analytics", { preHandler: app.requirePartnerAuth }, async (req, reply) => {
    return reply.send(await getPartnerAnalytics(req.partnerId!));
  });

  // Replaces the full list rather than appending — the dashboard sends
  // its complete current list on every save, same pattern as apiKey
  // rotation below (single source of truth, no partial-update ambiguity).
  app.put("/api/partner/allowed-domains", { preHandler: app.requirePartnerAuth }, async (req, reply) => {
    const body = parseBody(updateAllowedDomainsBodySchema, req.body, reply);
    if (!body) return;

    await db.update(partners).set({ allowedDomains: body.allowedDomains }).where(eq(partners.id, req.partnerId!));
    return reply.send({ allowedDomains: body.allowedDomains });
  });

  // Single atomic statement — avoids a window where neither the old nor
  // the new key is reliably the source of truth.
  app.post("/api/partner/rotate-key", { preHandler: app.requirePartnerAuth }, async (req, reply) => {
    const result = await db.execute<RotatedKeyRow>(sql`
      UPDATE partners
      SET api_key = encode(gen_random_bytes(24), 'hex')
      WHERE id = ${req.partnerId}
      RETURNING api_key AS "apiKey"
    `);
    const newKey = result.rows[0]?.apiKey;
    if (!newKey) return reply.code(500).send({ error: "Failed to rotate key" });
    return reply.send({ apiKey: newKey });
  });
}
