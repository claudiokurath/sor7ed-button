CREATE TABLE "saved_item_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"saved_item_id" uuid NOT NULL,
	"partner_id" uuid,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_item_clicks" ADD CONSTRAINT "saved_item_clicks_saved_item_id_saved_items_id_fk" FOREIGN KEY ("saved_item_id") REFERENCES "public"."saved_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_item_clicks" ADD CONSTRAINT "saved_item_clicks_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_item_clicks_item_idx" ON "saved_item_clicks" USING btree ("saved_item_id");--> statement-breakpoint
CREATE INDEX "saved_item_clicks_partner_idx" ON "saved_item_clicks" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "saved_item_clicks_partner_clicked_idx" ON "saved_item_clicks" USING btree ("partner_id","clicked_at");