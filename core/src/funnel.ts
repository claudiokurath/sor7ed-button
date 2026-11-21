import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "./client.js";
import { funnelEvents, funnelDaily } from "./schema.js";
import {
  FUNNEL_EVENTS,
  partnerKeyHash,
  funnelPageUrl,
  funnelFlowId,
  funnelMeta,
  type FunnelEvent,
} from "./funnel-policy.js";
export type FunnelInput = {
  event: FunnelEvent;
  flowId?: unknown;
  partnerApiKey?: unknown;
  pageUrl?: unknown;
  meta?: unknown;
  dedupeKey?: string;
};
/** No raw key, query string, page content, message body, account or IP is stored. */
export async function recordFunnelEvent(input: FunnelInput): Promise<boolean> {
  if (!FUNNEL_EVENTS.includes(input.event))
    throw new Error("Unknown funnel event");
  const now = new Date();
  const key = partnerKeyHash(input.partnerApiKey),
    page = funnelPageUrl(input.pageUrl),
    flow = funnelFlowId(input.flowId),
    meta = funnelMeta(input.meta);
  const identity =
    input.event === "widget_impression" && key && meta["page_load_id"]
      ? `impression:${key}:${meta["page_load_id"]}`
      : input.dedupeKey;
  const dedupe = identity
    ? createHash("sha256").update(`${input.event}:${identity}`).digest("hex")
    : randomUUID();
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(funnelEvents)
      .values({
        event: input.event,
        occurredAt: now,
        flowId: flow,
        partnerKey: key,
        pageUrl: page,
        meta,
        dedupeKey: dedupe,
      })
      .onConflictDoNothing()
      .returning({ id: funnelEvents.id });
    if (!rows.length) return false;
    await tx
      .insert(funnelDaily)
      .values({
        day: now.toISOString().slice(0, 10),
        event: input.event,
        source: meta["source"] === "browser" ? "browser" : "server",
        partnerKey: key ?? "",
        pageUrl: page ?? "",
        count: 1,
      })
      .onConflictDoUpdate({
        target: [
          funnelDaily.day,
          funnelDaily.event,
          funnelDaily.source,
          funnelDaily.partnerKey,
          funnelDaily.pageUrl,
        ],
        set: { count: sql`${funnelDaily.count} + 1` },
      });
    return true;
  });
}
/** Existing saves/auth responses must not fail because analytics is unavailable. */
export async function recordFunnelSafely(input: FunnelInput): Promise<void> {
  try {
    await recordFunnelEvent(input);
  } catch {
    console.warn("Funnel event could not be recorded", { event: input.event });
  }
}
export async function pruneFunnelEvents(): Promise<void> {
  // Daily rollups are written atomically at ingestion and are never pruned.
  await db.execute(
    sql`DELETE FROM funnel_events WHERE occurred_at < now() - interval '90 days'`,
  );
}
