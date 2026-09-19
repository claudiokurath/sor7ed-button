// Keeping these here, rather than inline in route handlers, means the
// compliance-critical session-window check lives in exactly one place —
// this is what the WhatsApp service calls before every outbound send.
import { db } from "./client.js";
import {
  users,
  savedItems,
  whatsappConnectionRequests,
  partners,
  partnerMembers,
  savedItemClicks,
  partnerInvites,
} from "./schema.js";
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

// Called right after sendSaveCard returns, so a later quote-reply to this
// exact WhatsApp message (see resolveItemFromQuotedMessage below) can be
// traced back to the item it concerns. Best-effort: a null messageId
// (opt-out, or Meta's response didn't include one) is written as-is —
// REMIND's fallback to "most recently saved" already covers that case.
export async function setSavedItemMessageId(itemId: string, messageId: string | null): Promise<void> {
  await db.update(savedItems).set({ whatsappMessageId: messageId }).where(eq(savedItems.id, itemId));
}

// Resolves a WhatsApp quote-reply's context.id (the message id being
// replied to) back to the specific saved item it was sent for — the
// mechanism that lets REMIND target "the item I'm actually swiping-reply
// to" instead of guessing at "whichever was saved most recently." Scoped
// to userId as well as the message id so one user can never accidentally
// (or maliciously, given message ids are not secret) resolve into another
// user's saved item.
export async function resolveItemFromQuotedMessage(
  userId: string,
  quotedMessageId: string
): Promise<{ id: string; title: string } | null> {
  const [row] = await db
    .select({ id: savedItems.id, title: savedItems.title })
    .from(savedItems)
    .where(and(eq(savedItems.userId, userId), eq(savedItems.whatsappMessageId, quotedMessageId)))
    .limit(1);
  return row ?? null;
}

// Records a genuine return visit: a person opening a saved item's short
// link (via WhatsApp, days after the original save) and being redirected
// back to the partner's page. Called from the /s/[shortId] lookup route
// only when the request is confirmed NOT to be a link-preview crawler —
// see web/src/app/s/[shortId]/page.tsx for that check. partnerId is
// denormalized onto the click row at write time so analytics never needs
// to join back through saved_items.
export async function recordSavedItemClick(savedItemId: string, partnerId: string | null): Promise<void> {
  await db.insert(savedItemClicks).values({ savedItemId, partnerId });
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

// Everyone who can currently log into this partner's dashboard, plus who
// invited whom and when — the roster shown on the dashboard's team panel.
export async function listPartnerMembers(partnerId: string) {
  return db
    .select({
      id: partnerMembers.id,
      userId: partnerMembers.userId,
      email: users.email,
      role: partnerMembers.role,
      createdAt: partnerMembers.createdAt,
    })
    .from(partnerMembers)
    .innerJoin(users, eq(partnerMembers.userId, users.id))
    .where(eq(partnerMembers.partnerId, partnerId))
    .orderBy(partnerMembers.createdAt);
}

// Only pending, non-expired invites — accepted/revoked/expired ones are
// noise on the "who's outstanding" list the dashboard shows alongside
// the member roster.
export async function listPendingInvites(partnerId: string) {
  return db
    .select({ id: partnerInvites.id, email: partnerInvites.email, createdAt: partnerInvites.createdAt })
    .from(partnerInvites)
    .where(
      and(eq(partnerInvites.partnerId, partnerId), eq(partnerInvites.status, "pending"), sql`expires_at > NOW()`)
    )
    .orderBy(desc(partnerInvites.createdAt));
}

export async function createPartnerInvite(
  partnerId: string,
  email: string,
  invitedByUserId: string,
  token: string
): Promise<void> {
  await db.insert(partnerInvites).values({ partnerId, email, invitedByUserId, token });
}

export async function revokePartnerInvite(partnerId: string, inviteId: string): Promise<void> {
  await db
    .update(partnerInvites)
    .set({ status: "revoked" })
    .where(and(eq(partnerInvites.id, inviteId), eq(partnerInvites.partnerId, partnerId)));
}

// Accepts an invite for the currently-signed-in user. Transactional for
// the same reason as verifyConnectionRequest above: marking the invite
// used and creating the membership must succeed or fail together, so a
// duplicate webhook-style retry can never leave a used-but-memberless
// invite, or a membership with no corresponding consumed invite.
// onConflictDoNothing on the membership insert covers the case where the
// invited user is, unusually, already a member (e.g. they left and were
// re-invited then double-clicked) — acceptance should still succeed
// rather than throwing on the unique index.
export async function acceptPartnerInvite(
  token: string,
  userId: string
): Promise<{ partnerId: string; partnerName: string } | { error: "not_found" | "expired" }> {
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select({
        id: partnerInvites.id,
        partnerId: partnerInvites.partnerId,
        status: partnerInvites.status,
        expiresAt: partnerInvites.expiresAt,
      })
      .from(partnerInvites)
      .where(eq(partnerInvites.token, token))
      .limit(1);

    if (!invite) return { error: "not_found" };
    if (invite.status !== "pending" || invite.expiresAt.getTime() <= Date.now()) return { error: "expired" };

    await tx
      .update(partnerInvites)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(partnerInvites.id, invite.id));

    await tx
      .insert(partnerMembers)
      .values({ userId, partnerId: invite.partnerId, role: "admin" })
      .onConflictDoNothing();

    const [partner] = await tx
      .select({ name: partners.name })
      .from(partners)
      .where(eq(partners.id, invite.partnerId))
      .limit(1);

    return { partnerId: invite.partnerId, partnerName: partner?.name ?? "this account" };
  });
}

export async function removePartnerMember(partnerId: string, memberId: string): Promise<void> {
  await db
    .delete(partnerMembers)
    .where(and(eq(partnerMembers.id, memberId), eq(partnerMembers.partnerId, partnerId)));
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

  // The actual "does this thing work" number for a partner: of everything
  // saved, how many were ever re-opened via the WhatsApp link later? A
  // save with zero clicks is indistinguishable from a bookmark nobody
  // returns to; a click is a person coming back to the partner's site
  // days later specifically because SOR7ED nudged them.
  const [clickTotals] = await db
    .select({
      totalClicks: count(savedItemClicks.id),
      itemsClicked: countDistinct(savedItemClicks.savedItemId),
    })
    .from(savedItemClicks)
    .where(eq(savedItemClicks.partnerId, partnerId));

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

  const totalSaves = totals?.totalSaves ?? 0;
  const itemsClicked = clickTotals?.itemsClicked ?? 0;

  return {
    totalSaves,
    uniqueSavers: totals?.uniqueSavers ?? 0,
    savesToday: todayRow?.savesToday ?? 0,
    topPages,
    // Return-visit signal: how many distinct saved items were ever
    // reopened, how many times in total (repeat opens count), and the
    // resulting conversion rate. Rounded to 1dp for display; 0 when
    // there's nothing saved yet rather than NaN from a 0/0 division.
    returnVisits: {
      itemsClicked,
      totalClicks: clickTotals?.totalClicks ?? 0,
      conversionRate: totalSaves > 0 ? Math.round((itemsClicked / totalSaves) * 1000) / 10 : 0,
    },
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
