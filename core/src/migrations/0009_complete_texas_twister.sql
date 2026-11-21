CREATE TABLE "funnel_daily" (
	"day" date NOT NULL,
	"event" text NOT NULL,
	"source" text DEFAULT 'server' NOT NULL,
	"partner_key" text DEFAULT '' NOT NULL,
	"page_url" text DEFAULT '' NOT NULL,
	"count" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnel_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event" text NOT NULL,
	"flow_id" uuid,
	"partner_key" text,
	"page_url" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_items" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "saved_items" ADD COLUMN "reopen_delay_ms" bigint;--> statement-breakpoint
ALTER TABLE "saved_items" ADD COLUMN "reopened_within_7d" boolean;--> statement-breakpoint
CREATE UNIQUE INDEX "funnel_daily_group_idx" ON "funnel_daily" USING btree ("day","event","source","partner_key","page_url");--> statement-breakpoint
CREATE UNIQUE INDEX "funnel_events_dedupe_idx" ON "funnel_events" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "funnel_events_retention_idx" ON "funnel_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "funnel_events_flow_idx" ON "funnel_events" USING btree ("flow_id","event");--> statement-breakpoint
UPDATE saved_items AS s
SET opened_at = c.first_opened,
    reopen_delay_ms = greatest(0, floor(extract(epoch FROM (c.first_opened - s.created_at)) * 1000))::bigint,
    reopened_within_7d = c.first_opened >= s.created_at AND c.first_opened <= s.created_at + interval '7 days'
FROM (SELECT saved_item_id, min(clicked_at) AS first_opened FROM saved_item_clicks GROUP BY saved_item_id) c
WHERE s.id = c.saved_item_id AND s.opened_at IS NULL;
--> statement-breakpoint
-- Observe verification without changing auth or webhook handlers. Failures in
-- telemetry must never roll back an otherwise valid verification.
CREATE FUNCTION sorted_funnel_verification() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event_id bigint;
BEGIN
  IF NEW.whatsapp_verified AND (TG_OP = 'INSERT' OR OLD.whatsapp_verified IS NOT TRUE) THEN
    INSERT INTO funnel_events(event,meta,dedupe_key)
    VALUES ('whatsapp_connect_completed','{"source":"server"}'::jsonb,'wa-verified:' || md5(NEW.id::text))
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING id INTO event_id;
    IF event_id IS NOT NULL THEN
      INSERT INTO funnel_daily(day,event,partner_key,page_url,count)
      VALUES ((now() AT TIME ZONE 'UTC')::date,'whatsapp_connect_completed','','',1)
      ON CONFLICT (day,event,source,partner_key,page_url) DO UPDATE SET count = funnel_daily.count + 1;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Funnel verification event could not be recorded';
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER sorted_funnel_verification AFTER INSERT OR UPDATE OF whatsapp_verified ON users
FOR EACH ROW EXECUTE FUNCTION sorted_funnel_verification();
