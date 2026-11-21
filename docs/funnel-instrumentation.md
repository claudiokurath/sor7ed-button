# Funnel instrumentation

## Rollout

1. Apply the Button database migration `0009_complete_texas_twister` with the
   existing Drizzle migration command. Use the Button direct connection, never
   PlanetSorted's database. The migration also backfills genuine historical
   short-link opens and installs an observational verification trigger.
2. Configure a private `CRON_SECRET` on the API Vercel project, then deploy the
   API. Vercel calls `/api/cron/funnel-retention` daily at 03:15 UTC with its
   bearer token. The endpoint refuses requests if the secret is absent or wrong.
3. Deploy web. The public widget emits optional telemetry to
   `https://api.sor7ed.com/api/funnel-events`. A missing analytics API does not
   block the button. Do not interpret a merged PR alone as a live API rollout.

No auth route, webhook handler, message sender, retries or session-window rules
are changed by this instrumentation. The API observer preserves responses when
analytics fails; the database verification trigger also catches analytics errors
without rolling back account verification.

## What counts

Browser interactions are accepted only for a registered partner's allowed
origin/page or the configured web origin. They are untrusted observations, not
proof that a message was sent. The public endpoint cannot submit server save,
Google, WhatsApp-completion or nudge outcomes.

- `widget_impression`: one per document load and partner key, deduplicated both
  in the document and atomically in Postgres. Multiple widget instances count once.
- `button_press`, `popup_opened`, `popup_blocked_fallback`, browser `save_timeout`:
  sent by the widget. Popups are counted only when opened; normal mobile
  same-tab navigation is not counted as a blocked popup.
- `google_started`, `google_completed`, `google_failed`: API OAuth responses;
  completion requires the successful response to set the session cookie. Cookie
  values never enter telemetry.
- `whatsapp_connect_started`, `whatsapp_connect_failed`: API challenge/connect
  responses. `whatsapp_connect_completed` is observed from a genuine verification
  transition in Postgres, without changing auth or webhook code. That transition
  has no browser flow/partner context, so those fields are null.
- `save_requested`: each save HTTP request, including failed/replayed requests.
  `save_accepted`, `save_pending`, `save_failed`, `save_timeout`: observed server
  responses; an item's repeated status polling does not count its same outcome
  again. `accepted` means provider acceptance, not confirmed delivery. Unknown
  delivery is a timeout/unconfirmed observation, not success.

Daily rollups separate `source = browser` from `source = server`; do not add the
two timeout totals together as if they were independent saves. Flow IDs correlate
widget and save steps where existing request context makes them available;
legacy opaque IDs are deterministically mapped to UUIDs. No account identifier
is added to analytics to connect unrelated sessions.

The existing explicit, signed Continue POST for `/s/[shortId]` records the first
`opened_at`, `reopen_delay_ms` and nullable `reopened_within_7d` on `saved_items`.
Passive GETs, rich-link fetches and crawlers do not count. Later opens do not
overwrite the first open. Direct destination links bypass this handler and
therefore cannot be measured by it; no redirect or delivery behavior is changed.

## Data policy

`funnel_events` stores server timestamps, an event name, nullable correlation
UUID, SHA-256 partner-key hash, origin plus path, allowlisted metadata and a
hashed deduplication key. Queries, fragments, credentials, raw API keys, page
titles/content, message bodies, email addresses, phone numbers and IP addresses
are not copied into telemetry. Existing saved-item data is unchanged.

Ingestion writes the raw row and increments `funnel_daily` in one transaction.
Conflicting duplicate events do neither. The daily retention job deletes raw rows
older than 90 days; it never deletes daily aggregates. Aggregate dimensions are
UTC day, event, browser/server source, hashed partner and sanitized page path.

## Copy and weekly nudges

The default widget label is `Keep in WhatsApp`. Set `data-label="Keep"` on the
script for the plain variant; this is an explicit publisher-controlled variant,
not automatic random assignment. Popup and accepted/reopen/hero copy follow the
requested wording.

`weeklyNudgeCopy(n, m)` provides the requested body and Resurface all / Archive /
Quiet reply labels. `nudge_sent` and `nudge_opened` are supported server event
names. **Weekly nudges are inactive:** this repository has no weekly sender or
handlers for these actions, and lean mode has no reminder scheduler. There are
no fabricated send/open events. Activating these actions needs a separate,
explicitly authorized delivery/webhook change; it would conflict with this PR's
requirement to leave that logic unchanged.

## Verification

Unit tests cover privacy filtering, rejection of forged server events,
failure/success observation, retention authorization and copy. Isolated Postgres
tests cover the full migration chain, concurrent impression deduplication,
atomic aggregates, raw retention, first-open timing and verification-trigger
failure isolation. Widget tests cover crypto fallbacks, popup cleanup,
deduplication, correlation, URL filtering and the label variant. CI creates a
dedicated `sor7ed_funnel_tests` database; tests reject non-loopback databases.
