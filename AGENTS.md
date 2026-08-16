# Agent notes — SOR7ED BUTTON

## Product boundary
Standalone partner Save-to-WhatsApp product. **Not** planetsorted.com.
Do not copy secrets from planetsorted. Do not merge into that monorepo without an explicit decision.

## Layout
- `api/` Fastify — public REST + Meta webhook
- `web/` Next.js — partner dashboard, /save popup, /s/[shortId] OG cards, widget.js
- `worker/` BullMQ consumers
- `core/` Drizzle schema, WhatsApp client/service, enrichment, storage
- `types/` shared DTOs

## Immutable-ish rules
1. WhatsApp 24h session window is enforced only in `core/src/whatsapp/service.ts` + `isWhatsAppSessionOpen`.
2. Meta webhook signature verification must stay on raw body bytes (`api/src/index.ts` content-type parser + `webhook.ts`).
3. Partner save limit is atomic SQL in `api/src/routes/saves.ts` — do not split into check-then-update.
4. CONNECT verify is transactional in `core/src/queries.ts`.
5. `/s/[shortId]` must serve OG to crawlers and redirect humans (same idea as planetsorted `/r/`).

## Secrets
Never commit `.env`, `secrets_for_claude.txt`, or `all_notion_secrets.json`.
If secrets appear in a zip or chat, treat as compromised and rotate.

## Deploy
See README. Web → Vercel; api+worker → Docker compose or equivalent; Postgres needs pgvector.
