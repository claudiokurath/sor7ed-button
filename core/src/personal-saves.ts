import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "./client.js";
import { savedItems, users, saveResendActions } from "./schema.js";
import { SaveActionError, saveActionRequestHash } from "./save-actions.js";

type PersonalInput = {
  userId: string;
  idempotencyKey: string;
  url: string;
  title: string;
  description?: string | undefined;
  imageUrl?: string | undefined;
};
export async function claimPersonalSave(input: PersonalInput) {
  return db.transaction(async (tx) => {
    // Serialize the per-account budget and action claim, including retries.
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.userId))
      .for("update");
    if (!user)
      throw new SaveActionError(401, "Sign in again to save this page.");
    const hash = saveActionRequestHash(input);
    const [existing] = await tx
      .select()
      .from(savedItems)
      .where(
        and(
          eq(savedItems.userId, input.userId),
          eq(savedItems.source, "extension"),
          eq(savedItems.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (existing) {
      if (existing.requestHash !== hash)
        throw new SaveActionError(
          409,
          "This action belongs to a different page.",
        );
      return { item: existing, user, created: false };
    }
    const result = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(savedItems)
      .where(
        and(
          eq(savedItems.userId, input.userId),
          eq(savedItems.source, "extension"),
          gte(savedItems.createdAt, new Date(Date.now() - 86400_000)),
        ),
      );
    if ((result[0]?.count ?? 0) >= 100)
      throw new SaveActionError(429, "Your daily save limit has been reached.");
    const [item] = await tx
      .insert(savedItems)
      .values({
        userId: input.userId,
        source: "extension",
        sourceHost: new URL(input.url).hostname,
        url: input.url,
        title: input.title,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        idempotencyKey: input.idempotencyKey,
        requestHash: hash,
        deliveryStatus: "pending",
      })
      .returning();
    if (!item) throw new Error("Could not claim save");
    return { item, user, created: true };
  });
}

/** A deliberate resend gets its own durable key; checking state never sends. */
export async function claimResend(
  userId: string,
  shortId: string,
  actionKey: string,
) {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(savedItems)
      .where(
        and(eq(savedItems.userId, userId), eq(savedItems.shortId, shortId)),
      )
      .for("update");
    if (!item) throw new SaveActionError(404, "Saved page not found.");
    const [existing] = await tx
      .select()
      .from(saveResendActions)
      .where(
        and(
          eq(saveResendActions.userId, userId),
          eq(saveResendActions.actionKey, actionKey),
        ),
      );
    if (existing) {
      if (existing.savedItemId !== item.id)
        throw new SaveActionError(
          409,
          "This send action belongs to a different item.",
        );
      return { item, created: false };
    }
    if (!["failed", "skipped", "unknown"].includes(item.deliveryStatus))
      return { item, created: false };
    const [action] = await tx
      .insert(saveResendActions)
      .values({ userId, savedItemId: item.id, actionKey })
      .onConflictDoNothing()
      .returning();
    if (!action)
      throw new SaveActionError(409, "This send action was already used.");
    const [updated] = await tx
      .update(savedItems)
      .set({
        deliveryStatus: "pending",
        deliveryReason: null,
        deliveryUpdatedAt: new Date(),
      })
      .where(eq(savedItems.id, item.id))
      .returning();
    if (!updated) throw new Error("Could not claim resend");
    return { item: updated, created: true };
  });
}
