import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@sor7ed/core";

type Result = { current: number; ttl: number };
type Callback = (error: Error | null, result?: Result) => void;

/** Atomic fixed-window counters shared by all API instances, with no Redis. */
export class PostgresRateLimitStore {
  private increments = 0;
  constructor(_options?: unknown, private namespace = "global") {}

  child(options: unknown): PostgresRateLimitStore {
    const info = (options as { routeInfo?: { method?: string | string[]; url?: string }; groupId?: string });
    return new PostgresRateLimitStore(undefined, `${this.namespace}:${info.groupId ?? `${info.routeInfo?.method}:${info.routeInfo?.url}`}`);
  }

  private key(key: string): string {
    return createHash("sha256").update(`${this.namespace}:${key}`).digest("hex");
  }

  incr(key: string, callback: Callback, timeWindow: number): void {
    const hash = this.key(key);
    void db.execute<Result>(sql`
      INSERT INTO button_rate_limits(key_hash, hits, expires_at)
      VALUES (${hash}, 1, clock_timestamp() + ${timeWindow} * interval '1 millisecond')
      ON CONFLICT (key_hash) DO UPDATE SET
        hits = CASE WHEN button_rate_limits.expires_at <= clock_timestamp() THEN 1
          ELSE LEAST(button_rate_limits.hits::bigint + 1, 2147483647)::integer END,
        expires_at = CASE WHEN button_rate_limits.expires_at <= clock_timestamp()
          THEN clock_timestamp() + ${timeWindow} * interval '1 millisecond'
          ELSE button_rate_limits.expires_at END
      RETURNING hits AS current,
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - clock_timestamp())) * 1000))::integer AS ttl
    `).then(async result => {
      if (!result.rows[0]) throw new Error("Missing rate-limit counter");
      // Use a separate short transaction after the increment commits. Mixing
      // cross-key cleanup locks and the upsert can deadlock concurrent callers.
      if (++this.increments % 64 === 0) {
        await db.execute(sql`DELETE FROM button_rate_limits WHERE key_hash IN (
          SELECT key_hash FROM button_rate_limits WHERE expires_at < clock_timestamp()
          ORDER BY expires_at FOR UPDATE SKIP LOCKED LIMIT 100
        )`).catch(() => undefined);
      }
      callback(null, result.rows[0]);
    }).catch(() => callback(new Error("Rate-limit storage unavailable")));
  }

  read(key: string, callback: Callback): void {
    void db.execute<Result>(sql`
      SELECT hits AS current,
        GREATEST(0, CEIL(EXTRACT(EPOCH FROM (expires_at - clock_timestamp())) * 1000))::integer AS ttl
      FROM button_rate_limits WHERE key_hash = ${this.key(key)} AND expires_at > clock_timestamp()
    `).then(result => callback(null, result.rows[0] ?? { current: 0, ttl: 0 }))
      .catch(() => callback(new Error("Rate-limit storage unavailable")));
  }
}
