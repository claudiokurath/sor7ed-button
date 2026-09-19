import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  vector,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// last_inbound_message_at drives the WhatsApp 24h session-window check:
// every outbound send compares this against ~23h to decide free-form
// message vs. approved template. Updated by the inbound webhook on every
// message the user sends, including LIBRARY queries and the CONNECT token.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").unique(),
    googleId: text("google_id").unique(),
    whatsappNumber: text("whatsapp_number").unique(),
    whatsappVerified: boolean("whatsapp_verified").default(false).notNull(),
    // Set when the user texts STOP/UNSUBSCRIBE, cleared on START. Every
    // outbound send (sendSaveCard, sendReminder) must check this — Meta's
    // WhatsApp Business Platform policy requires honoring opt-outs, and
    // ignoring them risks the WABA itself being flagged.
    whatsappOptedOutAt: timestamp("whatsapp_opted_out_at", { withTimezone: true }),
    lastInboundMessageAt: timestamp("last_inbound_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_wa_number_idx").on(t.whatsappNumber)]
);

export const partners = pgTable("partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  apiKey: text("api_key")
    .unique()
    .notNull()
    .default(sql`encode(gen_random_bytes(24), 'hex')`),
  brandName: text("brand_name"),
  brandColor: text("brand_color").default("#25D366").notNull(),
  buttonLabel: text("button_label").default("Save to WhatsApp").notNull(),
  plan: text("plan").default("free").notNull(),
  monthlySaveLimit: integer("monthly_save_limit").default(100).notNull(),
  savesThisMonth: integer("saves_this_month").default(0).notNull(),
  // Registered hostnames (bare, lowercase, no scheme/port — e.g.
  // "example.com"), used to validate that a /api/saves request is saving
  // a URL the partner actually owns, since apiKey itself is public
  // (printed in the embed snippet) and carries no secrecy on its own.
  // Empty array = unrestricted (dev/setup default; tighten before go-live).
  allowedDomains: text("allowed_domains").array().default(sql`'{}'`).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Defined before saved_items because saved_items references it.
export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("collections_user_idx").on(t.userId)]
);

// short_id uses all 12 hex chars from 6 random bytes (48 bits), not a
// truncated 8-char slice (32 bits, birthday-bound collisions around
// ~65k saves). 48 bits pushes that threshold to ~16.8M saves. Hex avoids
// '+'/'/' that base64 can produce, which aren't safe in a public URL path.
export const savedItems = pgTable(
  "saved_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shortId: text("short_id")
      .unique()
      .notNull()
      .default(sql`encode(gen_random_bytes(6), 'hex')`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "set null" }),
    collectionId: uuid("collection_id").references(() => collections.id, { onDelete: "set null" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    cachedImageUrl: text("cached_image_url"),
    aiSummary: text("ai_summary"),
    aiTags: text("ai_tags").array().default(sql`'{}'`),
    // 1536 dims matches OpenAI text-embedding-3-small output.
    embedding: vector("embedding", { dimensions: 1536 }),
    reminderAt: timestamp("reminder_at", { withTimezone: true }),
    reminderSent: boolean("reminder_sent").default(false).notNull(),
    // Meta's message id (the "wamid...." string) for the save-card message
    // this item was delivered in — either the free-form text sent inside
    // the 24h session window, or the approved template sent outside it.
    // Lets a WhatsApp quote-reply (REMIND, swiped as a reply to a specific
    // card) be matched back to the exact item, instead of always assuming
    // "the most recently saved one." Null for items saved before this
    // column existed, or where the WhatsApp send failed/was skipped
    // (opted-out user, unverified number) — REMIND falls back to
    // most-recent in that case, same as the original MVP behaviour.
    whatsappMessageId: text("whatsapp_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("saved_items_user_idx").on(t.userId),
    index("saved_items_user_created_idx").on(t.userId, t.createdAt),
    index("saved_items_wa_message_idx").on(t.whatsappMessageId),
  ]
);

// Drives the click-to-chat verification flow: generate a token, insert a
// row, build a wa.me link pre-filled with CONNECT-<token>, and let the
// inbound webhook match it and mark the user verified.
export const whatsappConnectionRequests = pgTable(
  "whatsapp_connection_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").unique().notNull(),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW() + INTERVAL '15 minutes'`),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("wa_conn_token_idx").on(t.token)]
);

// One row per time a saved item's /s/[shortId] link is actually opened by
// a person (not a crawler fetching OG tags for a link preview) and they
// get redirected back to the partner's original page. This is the
// concrete "return visit" signal partners need to see ROI from the
// product — a save that's never re-opened is just a bookmark; a save
// that IS re-opened is a person coming back to the partner's site days
// (or weeks) later because SOR7ED reminded them via WhatsApp.
export const savedItemClicks = pgTable(
  "saved_item_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    savedItemId: uuid("saved_item_id")
      .notNull()
      .references(() => savedItems.id, { onDelete: "cascade" }),
    // Denormalized from saved_items.partner_id at click time, purely so
    // getPartnerAnalytics can aggregate clicks with a single indexed
    // lookup instead of joining through saved_items for every query.
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "set null" }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("saved_item_clicks_item_idx").on(t.savedItemId),
    index("saved_item_clicks_partner_idx").on(t.partnerId),
    index("saved_item_clicks_partner_clicked_idx").on(t.partnerId, t.clickedAt),
  ]
);

// Links a dashboard user to the partner account(s) they administer. Named
// partner_members rather than partner_users deliberately — the latter
// could be misread as "the partner's own end users" (people saving things
// via WhatsApp), when this actually means "who can log into this
// partner's dashboard."
export const partnerMembers = pgTable(
  "partner_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    role: text("role").default("admin").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  // Enforces one membership row per (user, partner) pair at the database
  // level, so a duplicate creation attempt fails cleanly with a constraint
  // violation rather than silently inserting a second row.
  (t) => [uniqueIndex("partner_members_user_partner_idx").on(t.userId, t.partnerId)]
);
