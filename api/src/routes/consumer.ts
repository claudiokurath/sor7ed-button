import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import net from "node:net";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  users,
  whatsappSigninChallenges,
  savedItems,
  partnerMembers,
  createSigninChallenge,
  consumeSigninChallenge,
  claimPersonalSave,
  claimResend,
  sendSaveCard,
  updateSaveDelivery,
  SaveActionError,
  WhatsAppSendError,
} from "@sor7ed/core";
import { cookieBase } from "./auth.js";
import { parseBody } from "../schemas/validate.js";

const urlSchema = z
  .string()
  .url()
  .max(2000)
  .refine((value) => {
    const u = new URL(value);
    const host = u.hostname.replace(/^\[|\]$/g, "");
    // No server fetch is performed. Refuse private/literal/local destinations
    // before exposing a redirect or external preview to a browser/crawler.
    return (
      ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      !net.isIP(host) &&
      host.includes(".") &&
      !/(^|\.)(localhost|local|internal|test|invalid)$/.test(host)
    );
  }, "Use a public website address.");
const personalSchema = z
  .object({
    url: urlSchema,
    title: z.string().trim().min(1).max(500),
    description: z.string().max(2000).optional(),
    imageUrl: urlSchema.refine((v) => v.startsWith("https:")).optional(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/),
  })
  .strict();
const verifySchema = z
  .object({
    id: z.string().uuid(),
    token: z.string().regex(/^[A-F0-9]{48}$/),
    proof: z.string().regex(/^[a-f0-9]{64}$/),
    code: z.string().regex(/^\d{6}$/),
  })
  .strict();
const allowedOrigin = async (req: FastifyRequest, reply: FastifyReply) => {
  if (
    req.headers.origin !==
    (process.env["WEB_ORIGIN"] ?? "http://localhost:3000")
  )
    return reply.code(403).send({ error: "Open Sorted to continue." });
};
const rate = {
  max: 60,
  timeWindow: "1 minute",
  hook: "preHandler" as const,
  keyGenerator: (req: FastifyRequest) => req.userId ?? req.ip,
};
const noStore = (
  _req: FastifyRequest,
  reply: FastifyReply,
  done: () => void,
) => {
  reply.header("Cache-Control", "private, no-store");
  done();
};
export async function consumerRoutes(app: FastifyInstance) {
  app.addHook("onRequest", noStore);
  app.post(
    "/api/signin/challenge",
    {
      preHandler: allowedOrigin,
      config: { rateLimit: { max: 10, timeWindow: "10 minutes" } },
    },
    async (_req, reply) => {
      const challenge = await createSigninChallenge();
      const number = process.env["META_WHATSAPP_DISPLAY_NUMBER"];
      if (!number)
        return reply
          .code(503)
          .send({ error: "WhatsApp sign-in is not available yet." });
      return {
        ...challenge,
        whatsappUrl: `https://wa.me/${number}?text=${encodeURIComponent(`SIGNIN-${challenge.token}`)}`,
      };
    },
  );
  app.post(
    "/api/signin/verify",
    {
      preHandler: allowedOrigin,
      config: { rateLimit: { max: 30, timeWindow: "10 minutes" } },
    },
    async (req, reply) => {
      const body = parseBody(verifySchema, req.body, reply);
      if (!body) return;
      const user = await consumeSigninChallenge(
        body.id,
        body.token,
        body.proof,
        body.code,
      );
      if (!user)
        return reply.code(401).send({
          error:
            "That code is invalid, expired or locked. Start again if needed.",
        });
      const token = await reply.jwtSign({ sub: user.id }, { expiresIn: "30d" });
      reply.setCookie("sor7ed_session", token, cookieBase(86400 * 30));
      return { ok: true };
    },
  );
  app.get(
    "/api/account",
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const [user] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          number: users.whatsappNumber,
          pausedAt: users.whatsappOptedOutAt,
        })
        .from(users)
        .where(eq(users.id, req.userId!));
      if (!user) return reply.code(401).send({ error: "Sign in again." });
      const items = await db
        .select({
          shortId: savedItems.shortId,
          title: savedItems.title,
          url: savedItems.url,
          imageUrl: savedItems.imageUrl,
          deliveryStatus: savedItems.deliveryStatus,
          createdAt: savedItems.createdAt,
        })
        .from(savedItems)
        .where(eq(savedItems.userId, user.id))
        .orderBy(desc(savedItems.createdAt))
        .limit(100);
      return {
        profile: {
          ...user,
          number: user.number ? `•••• ${user.number.slice(-4)}` : null,
        },
        items,
      };
    },
  );
  app.post(
    "/api/account/profile",
    {
      preHandler: [app.requireAuth, allowedOrigin],
      config: { rateLimit: rate },
    },
    async (req, reply) => {
      const body = parseBody(
        z
          .object({
            displayName: z.string().trim().max(80),
            paused: z.boolean(),
          })
          .strict(),
        req.body,
        reply,
      );
      if (!body) return;
      await db
        .update(users)
        .set({
          displayName: body.displayName,
          whatsappOptedOutAt: body.paused ? new Date() : null,
        })
        .where(eq(users.id, req.userId!));
      return { ok: true };
    },
  );
  app.delete<{ Params: { shortId: string } }>(
    "/api/account/items/:shortId",
    {
      preHandler: [app.requireAuth, allowedOrigin],
      config: { rateLimit: rate },
    },
    async (req, reply) => {
      const rows = await db
        .delete(savedItems)
        .where(
          and(
            eq(savedItems.userId, req.userId!),
            eq(savedItems.shortId, req.params.shortId),
          ),
        )
        .returning({ id: savedItems.id });
      return rows.length
        ? reply.code(204).send()
        : reply.code(404).send({ error: "Saved page not found." });
    },
  );
  app.delete(
    "/api/account",
    {
      preHandler: [app.requireAuth, allowedOrigin],
      config: { rateLimit: rate },
    },
    async (req, reply) => {
      const memberships = await db
        .select({ id: partnerMembers.id })
        .from(partnerMembers)
        .where(eq(partnerMembers.userId, req.userId!))
        .limit(1);
      if (memberships.length)
        return reply.code(409).send({
          error:
            "Remove or transfer your website-team membership before deleting your account.",
        });
      // Cascades remove owned saves, collections, connection requests and clicks.
      await db.transaction(async (tx) => {
        const [user] = await tx
          .select({ phone: users.whatsappNumber })
          .from(users)
          .where(eq(users.id, req.userId!))
          .for("update");
        if (user?.phone)
          await tx
            .delete(whatsappSigninChallenges)
            .where(eq(whatsappSigninChallenges.phone, user.phone));
        await tx.delete(users).where(eq(users.id, req.userId!));
      });
      reply.clearCookie("sor7ed_session", cookieBase(0));
      return { ok: true };
    },
  );
  app.post<{ Params: { shortId: string } }>(
    "/api/account/items/:shortId/resend",
    {
      preHandler: [app.requireAuth, allowedOrigin],
      config: { rateLimit: { ...rate, max: 10 } },
    },
    async (req, reply) => {
      const body = parseBody(
        z
          .object({
            actionKey: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/),
            confirmed: z.literal(true),
          })
          .strict(),
        req.body,
        reply,
      );
      if (!body) return;
      try {
        const action = await claimResend(
          req.userId!,
          req.params.shortId,
          body.actionKey,
        );
        if (!action.created)
          return { deliveryStatus: action.item.deliveryStatus };
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, req.userId!));
        let status: "accepted" | "skipped" | "unknown" | "failed" = "skipped",
          reason: string | null = "not_connected",
          messageId: string | undefined;
        if (user?.whatsappVerified && user.whatsappNumber) {
          try {
            const outcome = await sendSaveCard(
              user.id,
              user.whatsappNumber,
              action.item,
              new URL(action.item.url).hostname,
            );
            status = outcome.status;
            reason = outcome.reason;
            if (outcome.status === "accepted") messageId = outcome.messageId;
          } catch (e) {
            status = e instanceof WhatsAppSendError ? e.outcome : "unknown";
            reason = status === "failed" ? "send_failed" : "unconfirmed";
          }
        }
        try {
          await updateSaveDelivery(action.item.id, status, reason, messageId);
        } catch {
          app.log.warn(
            { saveId: action.item.id },
            "Resend outcome not persisted",
          );
        }
        return { deliveryStatus: status, deliveryReason: reason };
      } catch (e) {
        if (e instanceof SaveActionError)
          return reply.code(e.statusCode).send({ error: e.message });
        return reply.code(503).send({
          error: "Could not check this send action. Retry the same action.",
        });
      }
    },
  );
  app.post(
    "/api/personal-saves",
    {
      preHandler: [app.requireAuth, allowedOrigin],
      config: { rateLimit: rate },
    },
    async (req, reply) => {
      const body = parseBody(personalSchema, req.body, reply);
      if (!body) return;
      try {
        const action = await claimPersonalSave({
          ...body,
          userId: req.userId!,
        });
        if (action.created) {
          let status: "accepted" | "skipped" | "unknown" | "failed" = "skipped";
          let reason: string | null = "not_connected";
          let messageId: string | undefined;
          if (action.user.whatsappVerified && action.user.whatsappNumber) {
            try {
              const outcome = await sendSaveCard(
                req.userId!,
                action.user.whatsappNumber,
                action.item,
                action.item.sourceHost ?? "your saved page",
              );
              status = outcome.status;
              reason = outcome.reason;
              if (outcome.status === "accepted") messageId = outcome.messageId;
            } catch (e) {
              status = e instanceof WhatsAppSendError ? e.outcome : "unknown";
              reason = status === "failed" ? "send_failed" : "unconfirmed";
            }
          }
          try {
            await updateSaveDelivery(action.item.id, status, reason, messageId);
          } catch {
            app.log.warn(
              { saveId: action.item.id },
              "Personal save outcome not persisted",
            );
          }
          return reply.code(201).send({
            shortId: action.item.shortId,
            deliveryStatus: status,
            deliveryReason: reason,
          });
        }
        return {
          shortId: action.item.shortId,
          deliveryStatus:
            action.item.deliveryStatus === "pending" &&
            action.item.deliveryUpdatedAt.getTime() < Date.now() - 120000
              ? "unknown"
              : action.item.deliveryStatus,
          deliveryReason: action.item.deliveryReason,
        };
      } catch (e) {
        if (e instanceof SaveActionError)
          return reply.code(e.statusCode).send({ error: e.message });
        app.log.error("Personal save failed");
        return reply.code(503).send({
          error: "Could not save this page. Retry to check the same action.",
        });
      }
    },
  );
}
