import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db, partners, partnerMembers, getPartnerForUser, getPartnerAnalytics } from "@sor7ed/core";

interface CreatePartnerBody {
  name: string;
  brandName?: string;
}

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
  app.post<{ Body: CreatePartnerBody }>("/api/partner", { preHandler: app.requireAuth }, async (req, reply) => {
    const existing = await getPartnerForUser(req.userId!);
    if (existing) return reply.code(409).send({ error: "You already have a partner account" });

    const { name, brandName } = req.body ?? {};
    if (!name?.trim()) return reply.code(400).send({ error: "name is required" });

    const [partner] = await db
      .insert(partners)
      .values({ name: name.trim(), brandName: brandName?.trim() ?? null })
      .returning();
    if (!partner) return reply.code(500).send({ error: "Failed to create partner" });

    await db.insert(partnerMembers).values({ userId: req.userId!, partnerId: partner.id, role: "admin" });
    return reply.code(201).send(partner);
  });

  app.get("/api/partner/analytics", { preHandler: app.requirePartnerAuth }, async (req, reply) => {
    return reply.send(await getPartnerAnalytics(req.partnerId!));
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
