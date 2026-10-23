ALTER TABLE "partners" ADD COLUMN "allowed_domains" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp_opted_out_at" timestamp with time zone;