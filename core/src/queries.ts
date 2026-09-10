// Keeping these here, rather than inline in route handlers, means the
// compliance-critical session-window check lives in exactly one place —
// this is what the WhatsApp service calls before every outbound send.
import { db } from "./client.js";
import { users, savedItems, whatsappConnectionRequests, partners, partnerMembers } from "./schema.js";
import { eq, desc, and, lt, gte, isNotNull, sql, count, countDistinct } from "drizzle-orm";
import { generateEmbedding } from "./ai.js";

export async function isWhatsAppSessionOpen(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ lastInbound: users.lastInboundMessageAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row?.lastInbound) return false;
  const windowMs = 23 * 60 * 60 * 1000; // 23h buffer against clock skew
  return Date.now() - row.lastInbound.getTime() < windowMs;
}

export async function updateLastInbound(whatsappNumber: string): Promise<void> {
  await db
    .update(users)
    .set({ lastInboundMessageAt: new Date() })
    .where(eq(users.whatsappNumber, whatsappNumber));
}

// Single point of truth for opt-out state, mirroring isWhatsAppSessionOpen
// above — every outbound send must check this before dispatching (see
// whatsapp/service.ts). Meta's WhatsApp Business Platform policy requires
// honoring STOP/UNSUBSCRIBE; skipping this check risks the WABA itself
// being flagged, which is a total-outage risk for every partner at once.
export async function isWhatsAppOptedOut(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ optedOutAt: users.whatsappOptedOutAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.optedOutAt != null;
}

export async function setWhatsAppOptOut(whatsappNumber: string, optedOut: boolean): Promise<void> {
  await db
    .update(users)
    .set({ whatsappOptedOutAt: optedOut ? new Date() : null })
    .where(eq(users.whatsappNumber, whatsappNumber));
}

export async function getRecentSaves(userId: string, limit = 5) {
  return db
    .select({
      id: savedItems.id,
      shortId: savedItems.shortId,
      title: savedItems.title,
      url: savedItems.url,
      aiSummary: savedItems.aiSummary,
      createdAt: savedItems.createdAt,
    })
    .from(savedItems)
    .where(eq(savedItems.userId, userId))
    .orderBy(desc(savedItems.createdAt))
    .limit(limit);
}

export async function getPendingReminders() {
  return db
    .select({
      id: savedItems.id,
      shortId: savedItems.shortId,
      title: savedItems.title,
      userId: savedItems.userId,
      userPhone: users.whatsappNumber,
      userWhatsappVerified: users.whatsappVerified,
    })
    .from(savedItems)
    .innerJoin(users, eq(savedItems.userId, users.id))
    .where(
      and(eq(savedItems.reminderSent, false), isNotNull(savedItems.reminderAt), lt(savedItems.reminderAt, new Date()))
    )
    .limit(50);
}

// Atomic: marks the token used AND writes the phone number in one
// transaction, so a duplicate webhook delivery can't double-process it.
export async function verifyConnectionRequest(token: string, phoneNumber: string): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(whatsappConnectionRequests)
      .where(
        and(
          eq(whatsappConnectionRequests.token, token),
          eq(whatsappConnectionRequests.status, "pending"),
          sql`expires_at > NOW()`
        )
      )
      .limit(1);

    if (!request) return null;

    await tx
      .update(whatsappConnectionRequests)
      .set({ status: "verified", verifiedAt: new Date() })
      .where(eq(whatsappConnectionRequests.id, request.id));

    await tx
      .update(users)
      .set({ whatsappNumber: phoneNumber, whatsappVerified: true })
      .where(eq(users.id, request.userId));

    return request.userId;
  });
}

// If a user ever administers more than one partner account, .limit(1)
// arbitrarily returns just one of them — a fine simplification for now,
// since nothing in this phase needs multi-partner administration. First
// thing to revisit if that ever becomes a real requirement.
export async function getPartnerForUser(userId: string) {
  const [row] = await db
    .select({
      id: partners.id,
      name: partners.name,
      brandName: partners.brandName,
      brandColor: partners.brandColor,
      buttonLabel: partners.buttonLabel,
      apiKey: partners.apiKey,
      plan: partners.plan,
      monthlySaveLimit: partners.monthlySaveLimit,
      savesThisMonth: partners.savesThisMonth,
      allowedDomains: partners.allowedDomains,
    })
    .from(partnerMembers)
    .innerJoin(partners, eq(partnerMembers.partnerId, partners.id))
    .where(eq(partnerMembers.userId, userId))
    .limit(1);
  return row ?? null;
}

// count()/countDistinct() apply .mapWith(Number) internally, converting
// Postgres's bigint COUNT(*) result (returned as a string by the pg driver
// to avoid silent precision loss) into a real JS number. A raw
// sql<number>`count(*)` cast would only lie to the type system — the
// runtime value would still be a string.
export async function getPartnerAnalytics(partnerId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totals] = await db
    .select({
      totalSaves: count(savedItems.id),
      uniqueSavers: countDistinct(savedItems.userId),
    })
    .from(savedItems)
    .where(eq(savedItems.partnerId, partnerId));

  const [todayRow] = await db
    .select({ savesToday: count(savedItems.id) })
    .from(savedItems)
    .where(and(eq(savedItems.partnerId, partnerId), gte(savedItems.createdAt, todayStart)));

  // Grouping by url and title (rather than a separate page-metadata table)
  // is fine at this stage — if a partner's page title changes later, older
  // saves will show the old title, which is an acceptable MVP trade-off.
  const topPages = await db
    .select({ url: savedItems.url, title: savedItems.title, saves: count(savedItems.id) })
    .from(savedItems)
    .where(eq(savedItems.partnerId, partnerId))
    .groupBy(savedItems.url, savedItems.title)
    .orderBy(desc(count(savedItems.id)))
    .limit(10);

  return {
    totalSaves: totals?.totalSaves ?? 0,
    uniqueSavers: totals?.uniqueSavers ?? 0,
    savesToday: todayRow?.savesToday ?? 0,
    topPages,
  };
}

interface SearchResultRow extends Record<string, unknown> {
  id: string;
  shortId: string;
  title: string;
  url: string;
  aiSummary: string | null;
  createdAt: Date;
}

// Passing a JS array directly into a raw sql template without formatting
// produces Postgres's own array syntax ({0.1,0.2}), which pgvector does
// NOT accept — it expects bracketed syntax ([0.1,0.2]). JSON.stringify
// naturally produces the bracketed form; the explicit ::vector cast
// removes any ambiguity about the parameter's type. This is different
// from enrichSavedItem's write path above, which uses Drizzle's typed
// query builder and handles serialization automatically — raw SQL
// templates carry no such automatic handling.
export async function searchSavedItems(userId: string, query: string, limit = 5): Promise<SearchResultRow[]> {
  const embedding = await generateEmbedding(query);

  if (embedding) {
    const result = await db.execute<SearchResultRow>(sql`
      SELECT
        id, short_id AS "shortId", title, url, ai_summary AS "aiSummary", created_at AS "createdAt",
        (1 - (embedding <=> ${JSON.stringify(embedding)}::vector)) * 0.7 +
        COALESCE(ts_rank(
          setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(ai_summary, '')), 'B'),
          plainto_tsquery('english', ${query})
        ), 0) * 0.3 AS score
      FROM saved_items
      WHERE user_id = ${userId} AND embedding IS NOT NULL
      ORDER BY score DESC
      LIMIT ${limit}
    `);
    // node-postgres returns { rows: [...] }, not an array to destructure
    // directly off the result — same shape already proven correct back in
    // Phase 4's atomic partner-save-limit query.
    if (result.rows.length > 0) return result.rows;
  }

  // Fallback: pre-Phase-8 items with no embedding yet, or a transient
  // OpenAI failure. Full-text only, so LIBRARY <term> degrades gracefully
  // rather than breaking outright.
  const fallback = await db.execute<SearchResultRow>(sql`
    SELECT id, short_id AS "shortId", title, url, ai_summary AS "aiSummary", created_at AS "createdAt"
    FROM saved_items
    WHERE user_id = ${userId}
      AND to_tsvector('english', COALESCE(title,'') || ' ' || COALESCE(description,'') || ' ' || COALESCE(ai_summary,''))
          @@ plainto_tsquery('english', ${query})
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  return fallback.rows;
}
