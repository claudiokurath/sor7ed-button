CREATE TABLE "button_rate_limits" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"hits" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "quota_period_start" timestamp with time zone DEFAULT date_trunc('month', now()) NOT NULL;--> statement-breakpoint
CREATE INDEX "button_rate_limits_expiry_idx" ON "button_rate_limits" USING btree ("expires_at");