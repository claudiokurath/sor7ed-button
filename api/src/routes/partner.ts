import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import {
  db,
  partners,
  partnerMembers,
  getPartnerForUser,
  getPartnerAnalytics,
  listPartnerMembers,
  listPendingInvites,
  createPartnerInvite,
  revokePartnerInvite,
  acceptPartnerInvite,
  removePartnerMember,
} from "@sor7ed/core";
import { createPartnerBodySchema, updateAllowedDomainsBodySchema, createInviteBodySchema } from "../schemas/partner.js";
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

  // --- Team management -----------------------------------------------
  // Everything below lets a partner bring teammates onto their dashboard
  // account. There's no outbound email sending anywhere in this product
  // (auth is Google OAuth only) — inviting works the same way the
  // WhatsApp CONNECT flow does: mint a token, return a shareable link,
  // and the admin sends it themselves. Whoever opens the link while
  // signed in with a Google account can accept it, mirroring the
  // WhatsApp connect-link trust model.

  app.get("/api/partner/members", { preHandler: app.requirePartnerAuth }, async (req, reply) => {
    const [members, invites] = await Promise.all([
      listPartnerMembers(req.partnerId!),
      listPendingInvites(req.partnerId!),
    ]);
    return reply.send({ members, invites });
  });

  app.post(
    "/api/partner/invites",
    {
      preHandler: app.requirePartnerAuth,
      config: {
        rateLimit: {
          // Keyed per-partner (not per-IP) via partnerId, same reasoning
          // as /api/whatsapp/connect: an unbounded caller could otherwise
          // flood partner_invites with rows for one partner account.
          max: 20,
          timeWindow: "1 hour",
          hook: "preHandler",
          keyGenerator: (req) => req.partnerId ?? req.ip,
        },
      },
    },
    async (req, reply) => {
      const body = parseBody(createInviteBodySchema, req.body, reply);
      if (!body) return;

      // 8 random bytes = 16 hex chars = 64 bits of entropy — same sizing
      // as the WhatsApp CONNECT token, appropriate for a link with a
      // 7-day expiry (set by the schema default) rather than 15 minutes.
      const token = crypto.randomBytes(8).toString("hex");
      await createPartnerInvite(req.partnerId!, body.email, req.userId!, token);

      const webOrigin = process.env["WEB_ORIGIN"] ?? "http://localhost:3000";
      return reply.code(201).send({ inviteUrl: `${webOrigin}/dashboard/invite/${token}` });
    }
  );

  app.delete<{ Params: { inviteId: string } }>(
    "/api/partner/invites/:inviteId",
    { preHandler: app.requirePartnerAuth },
    async (req, reply) => {
      await revokePartnerInvite(req.partnerId!, req.params.inviteId);
      return reply.code(204).send();
    }
  );

  app.delete<{ Params: { memberId: string } }>(
    "/api/partner/members/:memberId",
    { preHandler: app.requirePartnerAuth },
    async (req, reply) => {
      // Prevents a partner account from ever being left with zero
      // dashboard admins — a locked-out partner with no way back in
      // would need manual DB intervention to recover.
      const members = await listPartnerMembers(req.partnerId!);
      if (members.length <= 1) {
        return reply.code(400).send({ error: "Can't remove the last admin on a partner account" });
      }
      await removePartnerMember(req.partnerId!, req.params.memberId);
      return reply.code(204).send();
    }
  );

  // Deliberately just requireAuth, not requirePartnerAuth — accepting an
  // invite is exactly how a signed-in user WITHOUT a partner yet gains
  // one, so requiring req.partnerId to already be set would make this
  // route uncallable for the person it's designed for.
  app.post<{ Params: { token: string } }>(
    "/api/partner/invites/:token/accept",
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const result = await acceptPartnerInvite(req.params.token, req.userId!);
      if ("error" in result) {
        return reply
          .code(result.error === "not_found" ? 404 : 410)
          .send({ error: result.error === "not_found" ? "Invite not found" : "This invite has expired or was already used" });
      }
      return reply.send(result);
    }
  );
}
