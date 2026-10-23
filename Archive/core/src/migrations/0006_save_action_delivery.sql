ALTER TABLE "saved_items" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "saved_items" ADD COLUMN "request_hash" text;--> statement-breakpoint
ALTER TABLE "saved_items" ADD COLUMN "delivery_status" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_items" ADD COLUMN "delivery_reason" text;--> statement-breakpoint
ALTER TABLE "saved_items" ADD COLUMN "delivery_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_items_action_idx" ON "saved_items" USING btree ("user_id","partner_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_delivery_status_check" CHECK ("saved_items"."delivery_status" IN ('pending', 'accepted', 'failed', 'skipped', 'unknown'));