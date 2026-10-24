import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "./schema.js";

// These tests NEVER use DATABASE_URL. Opt into a dedicated, local, disposable
// database. The fixed database name also prevents a typo from truncating a
// developer's regular database or the other integration suite's fixtures.
const testUrl = process.env["SOR7ED_TEST_DATABASE_URL"];
if (testUrl) {
  const url = new URL(testUrl);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/sor7ed_save_tests") {
    throw new Error("Save integration tests require the local disposable sor7ed_save_tests database");
  }
}

const pool = testUrl ? new pg.Pool({ connectionString: testUrl, max: 16 }) : null;
vi.mock("./client.js", () => ({ db: pool ? drizzle(pool, { schema }) : null }));
const { claimSaveAction, SaveActionError, updateSaveDelivery, readOwnSaveDelivery } = await import("./save-actions.js");

describe.skipIf(!testUrl)("save actions against disposable Postgres", () => {
  let userId: string;
  let partnerId: string;
  const apiKey = "test-partner-public-key";

  beforeAll(async () => {
    const journalPath = new URL("./migrations/meta/_journal.json", import.meta.url);
    const journal = JSON.parse(await readFile(fileURLToPath(journalPath), "utf8")) as { entries: { tag: string }[] };
    const existing = await pool!.query("SELECT to_regclass('public.users') AS users");
    if (existing.rows[0].users) throw new Error("Integration tests require an empty disposable database; recreate it before running");
    for (const entry of journal.entries) {
      await pool!.query(await readFile(fileURLToPath(new URL(`./migrations/${entry.tag}.sql`, import.meta.url)), "utf8"));
    }
  });

  beforeEach(async () => {
    await pool!.query("TRUNCATE users, partners CASCADE");
    userId = randomUUID();
    partnerId = randomUUID();
    await pool!.query("INSERT INTO users (id, whatsapp_number, whatsapp_verified) VALUES ($1, $2, true)", [userId, "447700900001"]);
    await pool!.query("INSERT INTO partners (id, name, brand_name, api_key, allowed_domains) VALUES ($1, $2, $3, $4, $5)", [
      partnerId, "Test publisher", "Test brand", apiKey, ["partner.example"],
    ]);
  });

  afterAll(async () => { await pool?.end(); });

  const action = (overrides: Record<string, unknown> = {}) => ({
    userId,
    partnerApiKey: apiKey,
    idempotencyKey: "action-001",
    url: "https://partner.example/guide",
    title: "A useful guide",
    ...overrides,
  });

  async function persistedCounts() {
    const items = await pool!.query("SELECT count(*)::int AS count FROM saved_items");
    const partner = await pool!.query("SELECT saves_this_month FROM partners WHERE id = $1", [partnerId]);
    return { items: items.rows[0].count, quota: partner.rows[0].saves_this_month };
  }

  it("creates one pending item and charges quota once for 24 concurrent duplicates", async () => {
    const results = await Promise.all(Array.from({ length: 24 }, () => claimSaveAction(action())));
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.item.id)).size).toBe(1);
    expect(results[0]!.item.deliveryStatus).toBe("pending");
    expect(results[0]!.user).toEqual({ whatsappNumber: "447700900001", whatsappVerified: true });
    expect(results[0]!.partner).toEqual({ id: partnerId, name: "Test publisher", brandName: "Test brand" });
    expect(await persistedCounts()).toEqual({ items: 1, quota: 1 });
  });

  it("returns the existing pending action even when the partner quota is exhausted", async () => {
    await pool!.query("UPDATE partners SET monthly_save_limit = 1 WHERE id = $1", [partnerId]);
    const first = await claimSaveAction(action());
    const retry = await claimSaveAction(action());
    expect(retry.created).toBe(false);
    expect(retry.item.id).toBe(first.item.id);
    expect(retry.item.deliveryStatus).toBe("pending");
    expect(await persistedCounts()).toEqual({ items: 1, quota: 1 });
  });

  it("detects reused keys with different content without spending more quota", async () => {
    await claimSaveAction(action());
    await expect(claimSaveAction(action({ title: "Different content" }))).rejects.toMatchObject({
      statusCode: 409, message: "This save action key was already used for different content",
    });
    expect(await persistedCounts()).toEqual({ items: 1, quota: 1 });
  });

  it("resolves concurrent altered payloads to one winner and one conflict", async () => {
    const results = await Promise.allSettled([
      claimSaveAction(action()),
      claimSaveAction(action({ description: "Different description" })),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(SaveActionError);
    expect(rejected.reason.statusCode).toBe(409);
    expect(await persistedCounts()).toEqual({ items: 1, quota: 1 });
  });

  it("never overspends the remaining quota under distinct concurrent actions", async () => {
    await pool!.query("UPDATE partners SET monthly_save_limit = 3 WHERE id = $1", [partnerId]);
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, index) => claimSaveAction(action({ idempotencyKey: `different-${index}` }))));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    const failures = results.filter((result) => result.status === "rejected") as PromiseRejectedResult[];
    expect(failures).toHaveLength(17);
    expect(failures.every((result) => result.reason instanceof SaveActionError && result.reason.statusCode === 429)).toBe(true);
    expect(await persistedCounts()).toEqual({ items: 3, quota: 3 });
  });

  it("rolls back both the quota and item if a deferred insert constraint fails at commit", async () => {
    await pool!.query(`
      CREATE FUNCTION reject_save_at_commit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'test deferred insertion failure'; END $$;
      CREATE CONSTRAINT TRIGGER reject_save_at_commit
      AFTER INSERT ON saved_items DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION reject_save_at_commit();
    `);
    try {
      await expect(claimSaveAction(action())).rejects.toThrow("test deferred insertion failure");
      expect(await persistedCounts()).toEqual({ items: 0, quota: 0 });
    } finally {
      await pool!.query("DROP TRIGGER reject_save_at_commit ON saved_items; DROP FUNCTION reject_save_at_commit()");
    }
    expect((await claimSaveAction(action())).created).toBe(true);
  });

  it("rejects invalid partner, foreign domain and missing user before consuming quota", async () => {
    await expect(claimSaveAction(action({ partnerApiKey: "unknown-key" }))).rejects.toMatchObject({ statusCode: 403 });
    await expect(claimSaveAction(action({ url: "https://foreign.example/guide" }))).rejects.toMatchObject({ statusCode: 403 });
    await expect(claimSaveAction(action({ userId: randomUUID() }))).rejects.toMatchObject({ statusCode: 404 });
    await expect(claimSaveAction(action({ idempotencyKey: "bad key" }))).rejects.toMatchObject({ statusCode: 400 });
    await expect(claimSaveAction(action({ idempotencyKey: undefined }))).rejects.toMatchObject({ statusCode: 400 });
    expect(await persistedCounts()).toEqual({ items: 0, quota: 0 });
  });

  it("scopes an action key to both the user and the partner", async () => {
    const otherUser = randomUUID();
    await pool!.query("INSERT INTO users (id) VALUES ($1)", [otherUser]);
    await pool!.query("INSERT INTO partners (name, api_key, allowed_domains) VALUES ($1, $2, $3)", ["Other publisher", "other-key", ["partner.example"]]);
    const first = await claimSaveAction(action());
    const second = await claimSaveAction(action({ userId: otherUser }));
    const third = await claimSaveAction(action({ partnerApiKey: "other-key" }));
    expect([first, second, third].every((result) => result.created)).toBe(true);
    expect(new Set([first, second, third].map((result) => result.item.id)).size).toBe(3);
    expect(await persistedCounts()).toEqual({ items: 3, quota: 2 });
  });

  it("allows an intentional second save using a new action key", async () => {
    await claimSaveAction(action());
    await claimSaveAction(action({ idempotencyKey: "action-002" }));
    expect(await persistedCounts()).toEqual({ items: 2, quota: 2 });
  });

  it("persists provider acceptance and message identity together, preserving the outcome on retry", async () => {
    const first = await claimSaveAction(action());
    await updateSaveDelivery(first.item.id, "accepted", undefined, "wamid.test-001");
    const retry = await claimSaveAction(action());
    expect(retry.created).toBe(false);
    expect(retry.item).toMatchObject({ deliveryStatus: "accepted", deliveryReason: null, whatsappMessageId: "wamid.test-001" });
    expect(retry.item.deliveryUpdatedAt).toBeInstanceOf(Date);
    await updateSaveDelivery(first.item.id, "unknown", "response_lost");
    const updated = await claimSaveAction(action());
    expect(updated.item).toMatchObject({ deliveryStatus: "unknown", deliveryReason: "response_lost", whatsappMessageId: "wamid.test-001" });
  });

  it("keeps legacy unkeyed rows unknown without collapsing separate historic saves", async () => {
    await pool!.query("INSERT INTO saved_items (user_id, partner_id, url, title) VALUES ($1, $2, $3, $4), ($1, $2, $3, $4)", [
      userId, partnerId, "https://partner.example/legacy", "Legacy save",
    ]);
    const rows = await pool!.query("SELECT idempotency_key, request_hash, delivery_status FROM saved_items");
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.every((row) => row.idempotency_key === null && row.request_hash === null && row.delivery_status === "unknown")).toBe(true);
  });

  it("only exposes delivery state to the owner, even when another user knows the public short id", async () => {
    const first = await claimSaveAction(action());
    await updateSaveDelivery(first.item.id, "failed", "provider_rejected");
    expect(await readOwnSaveDelivery(userId, first.item.shortId)).toMatchObject({
      shortId: first.item.shortId, deliveryStatus: "failed", deliveryReason: "provider_rejected",
    });
    expect(await readOwnSaveDelivery(randomUUID(), first.item.shortId)).toBeNull();
    expect(await readOwnSaveDelivery(userId, "unknown-short-id")).toBeNull();
  });
});
