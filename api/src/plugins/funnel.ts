import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  partners,
  savedItems,
  BROWSER_FUNNEL_EVENTS,
  recordFunnelEvent,
  recordFunnelSafely,
  pruneFunnelEvents,
  isUrlAllowedForPartner,
  type FunnelInput,
  type FunnelEvent,
} from "@sor7ed/core";

const browserBody = z
  .object({
    event: z.enum(BROWSER_FUNNEL_EVENTS),
    eventId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    flowId: z.string().max(128).optional(),
    partnerApiKey: z.string().max(500).optional(),
    pageUrl: z.string().max(8000),
    meta: z
      .object({
        page_load_id: z
          .string()
          .regex(/^[A-Za-z0-9_-]{1,128}$/)
          .optional(),
        navigation: z.enum(["popup", "same_tab", "blocked"]).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
const SAVES = new Set([
  "/api/saves",
  "/api/personal-saves",
  "/api/planet-sorted/saves",
]);
function context(req: FastifyRequest): Omit<FunnelInput, "event"> {
  const b =
    req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)
      : {};
  let flow = b["idempotencyKey"],
    page = b["url"],
    key = b["partnerApiKey"];
  if (
    !page &&
    typeof b["slug"] === "string" &&
    /^[a-z0-9-]{1,100}$/.test(b["slug"]) &&
    (b["context"] === "tool" || b["context"] === "article")
  )
    page = `https://www.planetsorted.com/${b["context"] === "tool" ? "tools" : "guidebooks"}/${b["slug"]}`;
  const cookie = req.cookies?.["returnTo"];
  if (cookie) {
    try {
      const u = new URL(
        cookie,
        process.env["WEB_ORIGIN"] ?? "http://localhost:3000",
      );
      flow ??= u.searchParams.get("flowId");
      page ??= u.searchParams.get("url");
      key ??= u.searchParams.get("apiKey");
    } catch {
      /* Invalid context is discarded. */
    }
  }
  return {
    flowId: flow,
    partnerApiKey: key,
    pageUrl: page,
    meta: { source: "server" },
  };
}
function bodyOf(payload: unknown): Record<string, unknown> {
  if (typeof payload !== "string" || payload.length > 12000) return {};
  try {
    const b = JSON.parse(payload);
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
export default fp(async (app) => {
  app.post(
    "/api/funnel-events",
    {
      bodyLimit: 12000,
      config: { rateLimit: { max: 240, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      let raw = req.body;
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          return reply.code(400).send({ error: "Invalid event." });
        }
      }
      const parsed = browserBody.safeParse(raw);
      if (!parsed.success)
        return reply.code(400).send({ error: "Invalid event." });
      const b = parsed.data;
      reply.header("Cache-Control", "no-store");
      if (
        b.event === "widget_impression" &&
        (!b.partnerApiKey || !b.meta?.page_load_id)
      )
        return reply
          .code(400)
          .send({
            error: "Impressions require a page-load identity and partner.",
          });
      const origin = req.headers.origin;
      if (!origin)
        return reply.code(403).send({ error: "Unknown event origin." });
      if (b.partnerApiKey) {
        const [partner] = await db
          .select({ allowedDomains: partners.allowedDomains })
          .from(partners)
          .where(eq(partners.apiKey, b.partnerApiKey))
          .limit(1);
        try {
          new URL(b.pageUrl);
        } catch {
          return reply.code(400).send({ error: "Invalid event page." });
        }
        if (
          !partner ||
          !isUrlAllowedForPartner(origin + "/", partner.allowedDomains) ||
          !isUrlAllowedForPartner(b.pageUrl, partner.allowedDomains)
        )
          return reply.code(403).send({ error: "Unknown event origin." });
      } else if (
        origin !== (process.env["WEB_ORIGIN"] ?? "http://localhost:3000")
      )
        return reply.code(403).send({ error: "Unknown event origin." });
      try {
        await recordFunnelEvent({
          ...b,
          meta: { ...b.meta, source: "browser" },
          dedupeKey: `browser:${b.eventId}:${b.partnerApiKey ?? ""}`,
        });
      } catch {
        return reply.code(503).send({ error: "Event could not be recorded." });
      }
      return reply.code(204).send();
    },
  );
  app.get("/api/cron/funnel-retention", async (req, reply) => {
    const secret = process.env["CRON_SECRET"];
    const actual = req.headers.authorization ?? "";
    const expected = secret ? `Bearer ${secret}` : "";
    if (
      !secret ||
      Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
      return reply.code(401).send({ error: "Not authorised." });
    await pruneFunnelEvents();
    return { ok: true };
  });
  app.addHook("onSend", async (req, reply, payload) => {
    try {
      const route = req.routeOptions.url ?? "";
      const c = context(req),
        data = bodyOf(payload),
        status = reply.statusCode;
      const meta = {
        source: "server",
        http_status: status,
        status: data["deliveryStatus"],
        reason: status >= 400 ? "http_error" : data["deliveryReason"],
      };
      const id = randomUUID();
      if (req.method === "POST" && SAVES.has(route)) {
        await recordFunnelSafely({
          ...c,
          event: "save_requested",
          meta,
          dedupeKey: `request:${id}`,
        });
        let event: FunnelEvent;
        if (status >= 400)
          event =
            status === 408 || status === 504 ? "save_timeout" : "save_failed";
        else
          event =
            data["deliveryStatus"] === "accepted"
              ? "save_accepted"
              : data["deliveryStatus"] === "pending"
                ? "save_pending"
                : data["deliveryStatus"] === "unknown"
                  ? "save_timeout"
                  : "save_failed";
        await recordFunnelSafely({
          ...c,
          event,
          meta,
          dedupeKey:
            typeof data["shortId"] === "string"
              ? `save:${data["shortId"]}:${event}`
              : `failure:${id}`,
        });
      } else if (
        req.method === "GET" &&
        route === "/api/saves/status/:shortId" &&
        status === 200 &&
        req.userId
      ) {
        try {
          const [item] = await db
            .select({
              shortId: savedItems.shortId,
              idempotencyKey: savedItems.idempotencyKey,
              partnerId: savedItems.partnerId,
              url: savedItems.url,
            })
            .from(savedItems)
            .where(
              and(
                eq(savedItems.userId, req.userId),
                eq(
                  savedItems.shortId,
                  (req.params as { shortId: string }).shortId,
                ),
              ),
            )
            .limit(1);
          if (item) {
            const event: FunnelEvent =
              data["deliveryStatus"] === "accepted"
                ? "save_accepted"
                : data["deliveryStatus"] === "pending"
                  ? "save_pending"
                  : data["deliveryStatus"] === "unknown"
                    ? "save_timeout"
                    : "save_failed";
            let key;
            if (item.partnerId) {
              const [p] = await db
                .select({ key: partners.apiKey })
                .from(partners)
                .where(eq(partners.id, item.partnerId))
                .limit(1);
              key = p?.key;
            }
            await recordFunnelSafely({
              event,
              flowId: item.idempotencyKey,
              partnerApiKey: key,
              pageUrl: item.url,
              meta,
              dedupeKey: `save:${item.shortId}:${event}`,
            });
          }
        } catch {
          /* Observing status cannot change the status response. */
        }
      } else if (route === "/api/auth/google") {
        await recordFunnelSafely({
          ...c,
          event: status < 400 ? "google_started" : "google_failed",
          meta,
        });
      } else if (route === "/api/auth/google/callback") {
        const cookies = reply.getHeader("set-cookie");
        const text = Array.isArray(cookies)
          ? cookies.join(";")
          : String(cookies ?? "");
        await recordFunnelSafely({
          ...c,
          event:
            status < 400 && text.includes("sor7ed_session=")
              ? "google_completed"
              : "google_failed",
          meta,
        });
      } else if (
        req.method === "POST" &&
        ["/api/whatsapp/connect", "/api/signin/challenge"].includes(route)
      ) {
        await recordFunnelSafely({
          ...c,
          event:
            status < 400
              ? "whatsapp_connect_started"
              : "whatsapp_connect_failed",
          meta,
        });
      } else if (
        req.method === "POST" &&
        route === "/api/signin/verify" &&
        status >= 400
      ) {
        await recordFunnelSafely({
          ...c,
          event: "whatsapp_connect_failed",
          meta,
        });
      }
    } catch {
      // The observer must preserve every response, including malformed requests
      // and requests served while telemetry is unavailable.
      app.log.warn("Funnel observer could not record an event");
    }
    return payload;
  });
});
