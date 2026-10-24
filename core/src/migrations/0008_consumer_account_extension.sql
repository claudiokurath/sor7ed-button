CREATE TABLE "save_resend_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"saved_item_id" uuid NOT NULL,
	"action_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_signin_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"proof_hash" text NOT NULL,
	"code_hash" text,
	"phone" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "whatsapp_signin_challenges_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "saved_items" ADD COLUMN "source" text DEFAULT 'partner' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_items" ADD COLUMN "source_host" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "save_resend_actions" ADD CONSTRAINT "save_resend_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save_resend_actions" ADD CONSTRAINT "save_resend_actions_saved_item_id_saved_items_id_fk" FOREIGN KEY ("saved_item_id") REFERENCES "public"."saved_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "save_resend_action_key_idx" ON "save_resend_actions" USING btree ("user_id","action_key");--> statement-breakpoint
CREATE INDEX "whatsapp_signin_expiry_idx" ON "whatsapp_signin_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "saved_items_source_host_idx" ON "saved_items" USING btree ("user_id","source_host");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_items_personal_action_idx" ON "saved_items" USING btree ("user_id","idempotency_key") WHERE "saved_items"."source" = 'extension';--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_source_check" CHECK ("saved_items"."source" IN ('partner', 'extension'));