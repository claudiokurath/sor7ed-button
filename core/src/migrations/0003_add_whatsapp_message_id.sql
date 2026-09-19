ALTER TABLE "saved_items" ADD COLUMN "whatsapp_message_id" text;--> statement-breakpoint
CREATE INDEX "saved_items_wa_message_idx" ON "saved_items" USING btree ("whatsapp_message_id");