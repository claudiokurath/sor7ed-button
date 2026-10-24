// Real PostgreSQL concurrency checks. Run against an explicit test database:
// SOR7ED_CONNECTION_TEST_DATABASE_URL=postgresql://... npm run test --workspace=core
// Each run creates and drops only its own randomly named schema. No Meta calls.
import crypto from "node:crypto";
import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "./schema.js";

const fixture = vi.hoisted(() => ({ db: null as NodePgDatabase<typeof schema> | null }));
vi.mock("./client.js", () => ({
  db: new Proxy({}, {
    get(_target, property) {
      if (!fixture.db) throw new Error("Test database is not ready");
      const value = Reflect.get(fixture.db, property);
      return typeof value === "function" ? value.bind(fixture.db) : value;
    },
  }),
}));
import { createOrReuseConnectionRequest, verifyConnectionRequest } from "./queries.js";

const connectionString = process.env["SOR7ED_CONNECTION_TEST_DATABASE_URL"];
const suite = connectionString ? describe : describe.skip;

suite("connection requests with real PostgreSQL", () => {
  const testSchema = `connect_test_${crypto.randomBytes(8).toString("hex")}`;
  let admin: pg.Pool;
  let pool: pg.Pool;
  let userId: string;

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString });
    await admin.query(`CREATE SCHEMA ${testSchema}`);
    pool = new pg.Pool({ connectionString, options: `-c search_path=${testSchema}`, max: 20 });
    await pool.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        whatsapp_number text UNIQUE,
        whatsapp_verified boolean NOT NULL DEFAULT false,
        last_inbound_message_at timestamptz
      );
      CREATE TABLE whatsapp_connection_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token text NOT NULL UNIQUE,
        status text NOT NULL DEFAULT 'pending',
        expires_at timestamptz NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
        verified_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
    `);
    fixture.db = drizzle(pool, { schema });
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE whatsapp_connection_requests, users CASCADE");
    const result = await pool.query<{ id: string }>("INSERT INTO users DEFAULT VALUES RETURNING id");
    userId = result.rows[0]!.id;
  });

  afterAll(async () => {
    fixture.db = null;
    if (pool) await pool.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
      await admin.end();
    }
  });

  it("returns one live token under simultaneous requests", async () => {
    const requests = await Promise.all(Array.from({ length: 16 }, () => createOrReuseConnectionRequest(userId)));
    expect(new Set(requests.map((r) => r.token)).size).toBe(1);
    expect(new Set(requests.map((r) => r.expiresAt.toISOString())).size).toBe(1);
    const rows = await pool.query("SELECT token FROM whatsapp_connection_requests WHERE status = 'pending'");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]!.token).toBe(requests[0]!.token);
  });

  it("allows exactly one concurrent verification and preserves the winning number", async () => {
    const request = await createOrReuseConnectionRequest(userId);
    const attempts = await Promise.all(Array.from({ length: 12 }, (_, i) => verifyConnectionRequest(request.token, `44000000${i}`)));
    expect(attempts.filter((result) => result === userId)).toHaveLength(1);
    const winner = attempts.findIndex((result) => result === userId);
    const users = await pool.query("SELECT whatsapp_number, whatsapp_verified FROM users WHERE id = $1", [userId]);
    expect(users.rows[0]).toEqual({ whatsapp_number: `44000000${winner}`, whatsapp_verified: true });
    const opened = await pool.query("SELECT last_inbound_message_at IS NOT NULL AS opened FROM users WHERE id = $1", [userId]);
    expect(opened.rows[0].opened).toBe(true);
    expect(await verifyConnectionRequest(request.token, "449999999999")).toBeNull();
  });

  it("rejects expired or unknown tokens without changing the account", async () => {
    const request = await createOrReuseConnectionRequest(userId);
    await pool.query("UPDATE whatsapp_connection_requests SET expires_at = NOW() - INTERVAL '1 second' WHERE token = $1", [request.token]);
    expect(await verifyConnectionRequest(request.token, "440000000000")).toBeNull();
    expect(await verifyConnectionRequest("UNKNOWN", "440000000000")).toBeNull();
    const users = await pool.query("SELECT whatsapp_number, whatsapp_verified FROM users WHERE id = $1", [userId]);
    expect(users.rows[0]).toEqual({ whatsapp_number: null, whatsapp_verified: false });
  });

  it("allows one winner across different legacy tokens and invalidates the other", async () => {
    await pool.query("INSERT INTO whatsapp_connection_requests (user_id, token) VALUES ($1, 'OLD-A'), ($1, 'OLD-B')", [userId]);
    const tokens = ["OLD-A", "OLD-B"];
    const attempts = await Promise.all(tokens.map((token, i) => verifyConnectionRequest(token, `44000000000${i}`)));
    expect(attempts.filter((result) => result === userId)).toHaveLength(1);
    const winner = attempts.findIndex((result) => result === userId);
    const rows = await pool.query("SELECT token, status FROM whatsapp_connection_requests ORDER BY token");
    expect(rows.rows).toEqual(tokens.map((token, i) => ({ token, status: i === winner ? "verified" : "expired" })));
    const users = await pool.query("SELECT whatsapp_number, whatsapp_verified FROM users WHERE id = $1", [userId]);
    expect(users.rows[0]).toEqual({ whatsapp_number: `44000000000${winner}`, whatsapp_verified: true });
    expect(await verifyConnectionRequest(tokens[1 - winner]!, "449999999999")).toBeNull();
  });

  it("refreshes explicitly and rejects the previous live token", async () => {
    const previous = await createOrReuseConnectionRequest(userId);
    const next = await createOrReuseConnectionRequest(userId, true);
    expect(next.token).not.toBe(previous.token);
    expect(await verifyConnectionRequest(previous.token, "440000000000")).toBeNull();
    expect(await createOrReuseConnectionRequest(userId)).toEqual(next);
    expect(await verifyConnectionRequest(next.token, "440000000000")).toBe(userId);
  });

  it("replaces an expired link and invalidates legacy duplicate pending links", async () => {
    const expired = await createOrReuseConnectionRequest(userId);
    await pool.query("UPDATE whatsapp_connection_requests SET expires_at = NOW() - INTERVAL '1 second' WHERE token = $1", [expired.token]);
    const live = await createOrReuseConnectionRequest(userId);
    expect(live.token).not.toBe(expired.token);
    await pool.query("INSERT INTO whatsapp_connection_requests (user_id, token, created_at) VALUES ($1, 'LEGACY', NOW() - INTERVAL '1 minute')", [userId]);
    expect(await createOrReuseConnectionRequest(userId)).toEqual(live);
    expect(await verifyConnectionRequest("LEGACY", "440000000000")).toBeNull();
    const rows = await pool.query("SELECT token FROM whatsapp_connection_requests WHERE status = 'pending'");
    expect(rows.rows).toEqual([{ token: live.token }]);
  });

  it("rolls back token consumption when another account owns the number", async () => {
    await pool.query("INSERT INTO users (whatsapp_number, whatsapp_verified) VALUES ('440000000000', true)");
    const request = await createOrReuseConnectionRequest(userId);
    await expect(verifyConnectionRequest(request.token, "440000000000")).rejects.toMatchObject({ code: "23505" });
    const token = await pool.query("SELECT status, verified_at FROM whatsapp_connection_requests WHERE token = $1", [request.token]);
    expect(token.rows[0]).toEqual({ status: "pending", verified_at: null });
    expect(await verifyConnectionRequest(request.token, "441111111111")).toBe(userId);
  });

  it("serializes a refresh racing verification without deadlocking", async () => {
    const previous = await createOrReuseConnectionRequest(userId);
    const [next, verified] = await Promise.all([
      createOrReuseConnectionRequest(userId, true),
      verifyConnectionRequest(previous.token, "440000000000"),
    ]);
    expect([null, userId]).toContain(verified);
    expect(next.token).not.toBe(previous.token);
    const token = await pool.query("SELECT status FROM whatsapp_connection_requests WHERE token = $1", [previous.token]);
    expect(token.rows[0]!.status).toBe(verified === null ? "expired" : "verified");
  });

  it("checks actual expiry after waiting for a competing user lock", async () => {
    const request = await createOrReuseConnectionRequest(userId);
    await pool.query("UPDATE whatsapp_connection_requests SET expires_at = clock_timestamp() + INTERVAL '200 milliseconds' WHERE token = $1", [request.token]);
    const blocker = await pool.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
      const verification = verifyConnectionRequest(request.token, "440000000000");
      await blocker.query("SELECT pg_sleep(0.4)");
      await blocker.query("COMMIT");
      expect(await verification).toBeNull();
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
    }
  });
});
