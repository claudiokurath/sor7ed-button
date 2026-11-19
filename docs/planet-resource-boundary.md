# Planet Sorted resources in the Button library

Planet Sorted is a public information site. Its navigation has no sign-in or
account control. Blog readers use the Notion **Blog Post Gamma** property;
tool explanations use **Gamma**. A content button opens the separate Button
`/save?source=planet-sorted&context=article|tool&slug=...` flow. It uses the
existing Button WhatsApp identity, personal library and delivery receipts.
Extension and publisher/widget flows are unchanged.

The authenticated API POST `/api/planet-sorted/saves` accepts a slug, context
and idempotency key, never a visitor-supplied protocol URL or title. It resolves
current publication and the destination through Planet Sorted's read-only
POST `/api/button/resource`, signing the exact body with the existing shared
relay secret and the distinct `resource` purpose. No new environment variable,
member database, schema migration or provider credential is required.

- Button secret: existing `WHATSAPP_RELAY_SECRET`.
- Planet Sorted secret: existing `BUTTON_RELAY_SECRET`.
- Keep these equal through the established relay configuration. Never copy
  credentials between repos or put this secret in browser code.
- Resolver host is fixed at https://www.planetsorted.com.
- Articles use the exact current Notion **Protocol Gamma** URL. There is no
  generated text, PDF substitution or guessed Gamma deck.
- Native tools save a permanent Button `/resource` URL. Opening it checks a
  live verified Button account and resolves a fresh five-minute signed iframe
  grant. Expiring grants are never stored in the library or WhatsApp cards.
- Other tools use their current Gamma URL.
- Resource reads never save or send. Save replay checks reuse the existing
  atomic personal-save receipt; pending/unknown outcomes never resend.
- Existing STOP, session-window and WhatsApp transport rules apply unchanged.
- Planet's popup feedback checks exact origin, popup identity and action ID;
  only provider `accepted` feedback resolves the scribble into a tick.

Deploy Button API and web before Planet Sorted's caller. Until Planet's
resolver is deployed, private resource resolution fails closed. The Button
web origin needs to be allowed in Planet's native-tool frame-ancestors.

This connects future resource saves. It does not merge historical Supabase
members/saves into Neon, claim native tool result persistence, synchronize
Notion CRM schemas, or publish a mobile app. Existing records are retained.
The internal personal-save source enum remains `extension` for compatibility;
resource URLs and titles distinguish these saves in the same member library.
