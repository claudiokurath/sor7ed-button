# Agent notes — SORTED

## Product boundary
Sorted's main hub is sor7ed.com: central member account, Button and SOR7ED Links extension. PlanetSorted remains a separate public tools/guidebooks website, with no separate member sign-in.
Do not copy secrets from planetsorted. Do not merge into that monorepo without an explicit decision.

## Brand
Use **SOR7ED** in visible product names, controls, taglines and brand references. Display headings in capitals using Anton. Use black backgrounds, #141414 charcoal panels, white/light-grey text and #FFBA2E yellow accents. Leave ordinary uses of “sorted” in prose and registered legal names unchanged. Technical identifiers (repo name, package scopes, cookie names, domain `sor7ed.com`, Meta template names) remain unchanged.

The extension's customer-facing name is **SOR7ED Links**, pronounced **Sorted Links**. Its /links page and store package use the stylized spelling; the normal spelling may remain as a search alias in store copy. The hub uses SOR7ED in visible prose and the original SOR7ED logo. See docs/sorted-hub.md for the current public/member boundary.

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
5. `/s/[shortId]` serves OG with the actual destination hostname and shows a destination-confirmation page to people. Only the explicit same-origin POST Continue action redirects; crawlers and passive page loads must never count as opens. This deliberately replaces the old silent redirect after the November 2026 link-disguise audit.

## Secrets
Never commit `.env`, `secrets_for_claude.txt`, or `all_notion_secrets.json`.
If secrets appear in a zip or chat, treat as compromised and rotate.

## Deploy
See **LEAN_DEPLOY.md** for the current lean launch (Vercel API + web, Neon, no worker/Redis/R2). **DEPLOY.md** documents the optional full stack. Quick map: web → Vercel; api+worker → Fly (`fly.api.toml` / `fly.worker.toml`); Postgres → Neon + pgvector; Redis → Upstash.
When web/api are on sibling subdomains, `COOKIE_DOMAIN=.sor7ed.com` must be set on the API.
Production uploads require shared R2 storage for api and worker. Local-disk uploads are development-only; do not add Fly upload volumes.
