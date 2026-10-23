import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./client.js";
import { isUrlAllowedForPartner } from "./domain-check.js";
import { partners, savedItems, users, type SaveDeliveryStatus } from "./schema.js";

export class SaveActionError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "SaveActionError";
  }
}

export interface SaveActionInput {
  userId: string;
  partnerApiKey: string;
  idempotencyKey: string;
  url: string;
  title: string;
  description?: string | undefined;
  imageUrl?: string | undefined;
}

/** Keep the payload immutable across retries, while treating omitted and
 * null optional values alike. The hash is scoped by user and partner in the
 * unique key, so it contains only the content that will actually be saved. */
export function saveActionRequestHash(input: Pick<SaveActionInput, "url" | "title" | "description" | "imageUrl">): string {
  return createHash("sha256")
    .update(JSON.stringify([input.url, input.title, input.description ?? null, input.imageUrl ?? null]))
    .digest("hex");
}

/** Claim a single browser action and reserve quota together.
 *
 * INSERT ... ON CONFLICT is the concurrency arbiter. PostgreSQL waits for
 * another transaction inserting the same (user, partner, action) key; once
 * that transaction commits, a duplicate reads its item without charging
 * quota again. If either insertion or quota fails, the entire transaction
 * rolls back. No process-local lock or read-then-increment is involved.
 *
 * Only callers receiving created:true may enqueue/send. A duplicate pending
 * action is deliberately not resent: a crashed sender may already have
 * reached Meta even if the delivery-state update did not reach Postgres.
 */
export async function claimSaveAction(input: SaveActionInput) {
  if (typeof input.idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(input.idempotencyKey)) {
    throw new SaveActionError(400, "A valid save action key is required");
  }
  const requestHash = saveActionRequestHash(input);

  return db.transaction(async (tx) => {
    const [partner] = await tx
      .select({ id: partners.id, name: partners.name, brandName: partners.brandName, allowedDomains: partners.allowedDomains })
      .from(partners)
      .where(eq(partners.apiKey, input.partnerApiKey))
      .limit(1);
    if (!partner) throw new SaveActionError(403, "Invalid partner API key");
    if (!isUrlAllowedForPartner(input.url, partner.allowedDomains)) {
      throw new SaveActionError(403, "This URL's domain is not registered to this partner account");
    }

    const [user] = await tx
      .select({ whatsappNumber: users.whatsappNumber, whatsappVerified: users.whatsappVerified })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    if (!user) throw new SaveActionError(404, "User not found");

    const [createdItem] = await tx
      .insert(savedItems)
      .values({
        userId: input.userId,
        partnerId: partner.id,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        url: input.url,
        title: input.title,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        deliveryStatus: "pending",
      })
      .onConflictDoNothing({ target: [savedItems.userId, savedItems.partnerId, savedItems.idempotencyKey] })
      .returning();

    const resultPartner = { id: partner.id, name: partner.name, brandName: partner.brandName };
    if (!createdItem) {
      const [existingItem] = await tx
        .select()
        .from(savedItems)
        .where(and(
          eq(savedItems.userId, input.userId),
          eq(savedItems.partnerId, partner.id),
          eq(savedItems.idempotencyKey, input.idempotencyKey),
        ))
        .limit(1);
      if (!existingItem) throw new Error("A saved action could not be read after its claim");
      if (existingItem.requestHash !== requestHash) {
        throw new SaveActionError(409, "This save action key was already used for different content");
      }
      return { created: false, item: existingItem, user, partner: resultPartner };
    }

    // Preserve the atomic SQL quota rule. Because this runs in the same
    // transaction as the INSERT, even an insertion/commit failure cannot
    // consume quota without a corresponding saved item.
    const quota = await tx.execute<{ id: string }>(sql`
      UPDATE partners
      SET saves_this_month = saves_this_month + 1
      WHERE id = ${partner.id} AND saves_this_month < monthly_save_limit
      RETURNING id
    `);
    if (!quota.rows[0]) throw new SaveActionError(429, "Monthly save limit reached for this partner");

    return { created: true, item: createdItem, user, partner: resultPartner };
  });
}

/** Persist provider outcome and message identity in one statement. Omitting
 * messageId preserves any previously recorded id; passing null clears it.
 * No delivered state is inferred from Meta accepting a request. */
export async function updateSaveDelivery(
  itemId: string,
  status: SaveDeliveryStatus,
  reason?: string | null,
  messageId?: string | null,
): Promise<void> {
  await db
    .update(savedItems)
    .set({
      deliveryStatus: status,
      deliveryReason: reason ?? null,
      deliveryUpdatedAt: new Date(),
      ...(messageId !== undefined ? { whatsappMessageId: messageId } : {}),
    })
    .where(eq(savedItems.id, itemId));
}

/** Delivery-state polling is always bound to the authenticated owner; a
 * public short-link id alone never grants access to account/delivery state. */
export async function readOwnSaveDelivery(userId: string, shortId: string) {
  const [item] = await db
    .select({
      shortId: savedItems.shortId,
      deliveryStatus: savedItems.deliveryStatus,
      deliveryReason: savedItems.deliveryReason,
      deliveryUpdatedAt: savedItems.deliveryUpdatedAt,
    })
    .from(savedItems)
    .where(and(eq(savedItems.userId, userId), eq(savedItems.shortId, shortId)))
    .limit(1);
  return item ?? null;
}
