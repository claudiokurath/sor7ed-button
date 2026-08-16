# SOR7ED BUTTON

**Partner Save-to-WhatsApp product.** Site owners embed one script; visitors save any page into their personal WhatsApp library.

> Standalone product. **Not** the [planetsorted.com](https://planetsorted.com) Lab site  
> (`claudiokurath/planetsorted`). Different auth, database, and domain (`sor7ed.com`).

---

## What it does

1. Partner pastes an embed snippet from the dashboard  
2. Visitor clicks **Save to WhatsApp** → popup `/save`  
3. Google sign-in → one-time WhatsApp `CONNECT-<token>` → save lands in chat  
4. Worker enriches the card (1200×630 image, AI summary/tags, embeddings)  
5. Visitor can text `LIBRARY`, `LIBRARY <word>`, `REMIND tomorrow`, `HELP`

Partner dashboard: analytics, monthly save limits, API key + rotate, embed snippet.

---

## Architecture

```
api/      Fastify  — auth, webhook, saves, partner REST     :3001
web/      Next.js  — /save popup, /s/[id] OG cards, dashboard :3000
worker/   BullMQ   — enrichment, reminders, monthly reset
core/     Shared   — Drizzle schema, WhatsApp, OpenAI, sharp
types/    Shared DTOs
```

**Stack:** Postgres 16 + pgvector · Redis 7 · Google OAuth · Meta WhatsApp Cloud API · OpenAI · sharp

```
Partner site
   │  <script src="https://sor7ed.com/widget.js" data-api-key="…">
   ▼
web /save  ──JWT cookie──►  api  ──►  Postgres
                              │
                              ├── Meta WhatsApp (save card)
                              └── Redis/BullMQ ──► worker (enrich)
```

---

## Quick start (local)

**Requirements:** Node 20+, Docker (Postgres + Redis)

```bash
cp .env.example .env
# fill JWT_SECRET at minimum:  openssl rand -hex 32
# optional for full flow: Meta + Google + OpenAI keys

npm install
npm run dev:infra          # postgres + redis
npm run db:migrate         # drizzle migrations (pgvector + schema)

# three terminals
npm run dev:api            # :3001
npm run dev:web            # :3000
npm run dev:worker
```

Open http://localhost:3000/dashboard → Google login → create partner → copy embed.

### Meta webhook (local)

Point Meta at a public tunnel to `POST/GET /webhook/whatsapp` on the API  
(e.g. `cloudflared tunnel --url http://localhost:3001`).

Verify token = `META_WEBHOOK_VERIFY_TOKEN`. App secret = `META_APP_SECRET`.

### WhatsApp templates (production)

Approve in Meta Business Manager (language `en_GB`):

| Name | Use |
|---|---|
| `sor7ed_saved_card` | Outside 24h window — header IMAGE + body (partner, title) + URL button → `s/<shortId>` |
| `sor7ed_reminder` | Scheduled reminders — body (title, url) |

Template URL button base must match `BASE_URL` (e.g. `https://sor7ed.com/`).

---

## Production deploy

### Recommended split

| Piece | Host |
|---|---|
| `web` | Vercel (or any Next host) → `sor7ed.com` |
| `api` + `worker` | Docker / Fly / Railway / any Node host |
| Postgres | Managed Postgres **with pgvector** |
| Redis | Managed Redis |
| Uploads | Today: local disk volume shared by api+worker. Swap `core/src/storage.ts` for S3/R2 before multi-instance scale. |

```bash
# API + worker + infra
docker compose up -d --build

# Web (Vercel)
# Root directory: web/
# Env: NEXT_PUBLIC_*, API_INTERNAL_URL (server-side to api)
```

### Required production env

See `.env.example`. Fail-fast checks run at api/worker boot when `NODE_ENV=production`.

Critical:

- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`
- `BASE_URL` (public web), `API_BASE_URL` (public api — Meta must fetch images)
- Full Meta set + Google OAuth (authorized redirect: `{API_BASE_URL}/api/auth/google/callback`)
- Cookie domain: web and api must share a parent domain (or proxy api under same host) so `sor7ed_session` works cross-subdomain — set cookie `domain` if you split hosts.

### Google OAuth

Authorized JavaScript origins: web origin  
Authorized redirect URI: `{API_BASE_URL}/api/auth/google/callback`

### Embed for partners

```html
<script
  src="https://sor7ed.com/widget.js"
  data-api-key="PARTNER_KEY"
  data-label="Save to WhatsApp"
  data-color="#25D366"
  async
></script>
```

Optional: place buttons with `<div data-sor7ed data-title="…" data-url="…"></div>`.

---

## Commands

| Script | What |
|---|---|
| `npm run dev:infra` | Postgres + Redis |
| `npm run dev:api` / `dev:web` / `dev:worker` | Local processes |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run typecheck` | All workspaces |
| `docker compose up -d --build` | api + worker + infra |

---

## Security notes

- Meta webhook HMAC (`META_APP_SECRET`) on every inbound POST  
- Partner monthly limits atomic (`UPDATE … WHERE saves < limit`)  
- CONNECT tokens single-use, 15 min expiry, transactional verify  
- Session JWT in httpOnly cookie (`sor7ed_session`)  
- Rate limits on authenticated save routes  
- **Never commit `.env`**. Rotate any keys that ever lived in a local zip or chat upload.

---

## Relationship to Planet Sorted

| | SOR7ED BUTTON (this repo) | planetsorted |
|---|---|---|
| Purpose | Partner save-any-URL → WA library | Lab tools/articles → WA |
| Auth | Google OAuth | Magic link (Supabase) |
| DB | Own Postgres + pgvector | Supabase |
| Domain | sor7ed.com | planetsorted.com |

Do not merge codebases casually. Cross-link products in product/marketing only.

---

## License

Private — all rights reserved.
