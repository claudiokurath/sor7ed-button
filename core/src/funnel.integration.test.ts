import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import * as schema from "./schema.js";
const url = process.env["SORTED_FUNNEL_TEST_DATABASE_URL"];
if (url) {
  const u = new URL(url);
  if (
    !["localhost", "127.0.0.1"].includes(u.hostname) ||
    u.pathname !== "/sor7ed_funnel_tests"
  )
    throw Error("Funnel tests require an isolated loopback fixture");
}
const pool = url ? new pg.Pool({ connectionString: url, max: 16 }) : null;
vi.mock("./client.js", () => ({ db: pool ? drizzle(pool, { schema }) : null }));
const { recordFunnelEvent, pruneFunnelEvents } = await import("./funnel.js");
const { recordSavedItemClick } = await import("./queries.js");
describe.skipIf(!url)("funnel data against isolated Postgres", () => {
  beforeAll(async () => {
    const existing = await pool!.query(
      "select to_regclass('public.users') as users",
    );
    if (existing.rows[0].users)
      throw Error("Recreate the empty disposable funnel database");
    const j = JSON.parse(
      await readFile(
        new URL("./migrations/meta/_journal.json", import.meta.url),
        "utf8",
      ),
    );
    for (const e of j.entries)
      await pool!.query(
        await readFile(
          new URL(`./migrations/${e.tag}.sql`, import.meta.url),
          "utf8",
        ),
      );
  });
  beforeEach(async () => {
    await pool!.query(
      "TRUNCATE funnel_events, funnel_daily, users, partners CASCADE",
    );
  });
  afterAll(async () => {
    await pool?.end();
  });
  it("deduplicates impressions atomically per partner/page load and retains only hashes/paths", async () => {
    const data = {
      event: "widget_impression" as const,
      partnerApiKey: "public-key",
      pageUrl: "https://publisher.example/guide?token=secret#private",
      meta: {
        source: "browser",
        page_load_id: randomUUID(),
        body: "private message",
        title: "private content",
      },
    };
    await Promise.all(
      Array.from({ length: 20 }, () =>
        recordFunnelEvent({ ...data, dedupeKey: randomUUID() }),
      ),
    );
    const rows = await pool!.query("select * from funnel_events");
    expect(rows.rowCount).toBe(1);
    const row = rows.rows[0];
    expect(row.partner_key).toMatch(/^[a-f0-9]{64}$/);
    expect(row.page_url).toBe("https://publisher.example/guide");
    expect(JSON.stringify(row)).not.toContain("private");
    expect(JSON.stringify(row)).not.toContain("secret");
    expect(
      (await pool!.query("select count from funnel_daily")).rows[0].count,
    ).toBe("1");
  });
  it("keeps browser and server totals separate and aggregates forever after retention", async () => {
    await recordFunnelEvent({
      event: "save_timeout",
      meta: { source: "browser" },
    });
    await recordFunnelEvent({
      event: "save_timeout",
      meta: { source: "server" },
    });
    expect((await pool!.query("select * from funnel_daily")).rowCount).toBe(2);
    await pool!.query(
      "update funnel_events set occurred_at=now()-interval '91 days'",
    );
    await pruneFunnelEvents();
    expect((await pool!.query("select * from funnel_events")).rowCount).toBe(0);
    expect((await pool!.query("select * from funnel_daily")).rowCount).toBe(2);
  });
  it("records first-open latency once and distinguishes returns inside/outside seven days", async () => {
    const user = randomUUID();
    await pool!.query("insert into users(id) values($1)", [user]);
    const early = randomUUID(),
      late = randomUUID();
    await pool!.query(
      "insert into saved_items(id,user_id,url,title,created_at) values($1,$3,'https://publisher.example/','early',now()-interval '2 days'),($2,$3,'https://publisher.example/','late',now()-interval '8 days')",
      [early, late, user],
    );
    await recordSavedItemClick(early, null);
    const a = (
      await pool!.query(
        "select opened_at,reopen_delay_ms,reopened_within_7d from saved_items where id=$1",
        [early],
      )
    ).rows[0];
    expect(a.reopened_within_7d).toBe(true);
    expect(Number(a.reopen_delay_ms)).toBeGreaterThan(172799000);
    await recordSavedItemClick(early, null);
    expect(
      (
        await pool!.query("select opened_at from saved_items where id=$1", [
          early,
        ])
      ).rows[0].opened_at,
    ).toEqual(a.opened_at);
    await recordSavedItemClick(late, null);
    expect(
      (
        await pool!.query(
          "select reopened_within_7d from saved_items where id=$1",
          [late],
        )
      ).rows[0].reopened_within_7d,
    ).toBe(false);
  });
  it("observes verification without changing auth/webhook and fails open if analytics fails", async () => {
    const user = randomUUID();
    await pool!.query("insert into users(id) values($1)", [user]);
    await pool!.query("update users set whatsapp_verified=true where id=$1", [
      user,
    ]);
    await pool!.query("update users set whatsapp_verified=true where id=$1", [
      user,
    ]);
    expect(
      (
        await pool!.query(
          "select * from funnel_events where event='whatsapp_connect_completed'",
        )
      ).rowCount,
    ).toBe(1);
    // A separately forced verification failure rolls back telemetry only.
    await pool!.query(
      "delete from funnel_events; delete from funnel_daily; alter table funnel_daily add constraint force_analytics_failure check (event <> 'whatsapp_connect_completed')",
    );
    try {
      const other = randomUUID();
      await pool!.query(
        "insert into users(id,whatsapp_verified) values($1,true)",
        [other],
      );
      expect(
        (
          await pool!.query("select whatsapp_verified from users where id=$1", [
            other,
          ])
        ).rows[0].whatsapp_verified,
      ).toBe(true);
      expect((await pool!.query("select * from funnel_events")).rowCount).toBe(
        0,
      );
    } finally {
      await pool!.query(
        "alter table funnel_daily drop constraint force_analytics_failure",
      );
    }
  });
});
