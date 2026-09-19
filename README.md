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
   - `REMIND` resolves to the exact card if it's sent as a WhatsApp
     swipe-reply to that card's save message; otherwise falls back to
     "most recently saved."
6. `/s/[shortId]` records a return-visit click (crawlers excluded) before
   redirecting back to the partner's page — this is the real ROI signal.

Partner dashboard: analytics (incl. return-visit/conversion rate),
monthly save limits, API key + rotate, allowed-domains lock (with a
top-of-page warning when unrestricted), embed snippet, team management
(invite/remove dashboard admins via shareable link — see
`/dashboard/invite/[token]`).

**No-signup demo**: `/demo` embeds the real widget with
`data-demo="true"` — routes to `/save/demo`, a fully client-side
simulation (no account, no real WhatsApp send, nothing written to the
DB) ending in a mockup of the WhatsApp card a real visitor would
receive. Sales/marketing entry point only.

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

**Full step-by-step:** see **[DEPLOY.md](./DEPLOY.md)** (Vercel + Fly.io + Neon + Upstash).

### Recommended split

| Piece | Host |
|---|---|
| `web` | Vercel → `sor7ed.com` (`web/vercel.json`) |
| `api` | Fly.io → `api.sor7ed.com` (`fly.api.toml`) |
| `worker` | Fly.io background (`fly.worker.toml`) |
| Postgres | Neon (pgvector enabled) |
| Redis | Upstash |
| Uploads | Local disk volume on API for MVP; swap `core/src/storage.ts` → R2/S3 before multi-instance |

```bash
# API
fly deploy -c fly.api.toml --app sor7ed-button-api

# Worker
fly deploy -c fly.worker.toml --app sor7ed-button-worker

# Web — import repo in Vercel, Root Directory = web
```

### Required production env

See `.env.example` and the env matrix in DEPLOY.md. Fail-fast checks run at api/worker boot when `NODE_ENV=production`.

Critical:

- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`
- `BASE_URL` (public web), `API_BASE_URL` (public api — Meta must fetch images)
- Full Meta set + Google OAuth (authorized redirect: `{API_BASE_URL}/api/auth/google/callback`)
- `COOKIE_DOMAIN=.sor7ed.com` when web + api are sibling subdomains (so `sor7ed_session` is shared)

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
