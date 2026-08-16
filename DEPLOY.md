# Deploy SOR7ED BUTTON to production

**Target stack (default):**

| Piece | Service | Public URL |
|---|---|---|
| `web` | Vercel | `https://sor7ed.com` |
| `api` | Fly.io | `https://api.sor7ed.com` |
| `worker` | Fly.io | (no public URL) |
| Postgres + pgvector | Neon | (internal) |
| Redis | Upstash | (internal) |

Swap any row if you prefer Railway/Render/etc. — env names stay the same.

---

## 0. Before anything

1. **Rotate** any Meta / Google / OpenAI / JWT secrets that ever lived in the source zip.
2. Own DNS for `sor7ed.com` (Cloudflare or registrar).
3. Install CLIs: `npm i -g vercel`, [flyctl](https://fly.io/docs/hands-on/install-flyctl/), `psql` optional.
4. Accounts: Vercel, Fly.io, Neon, Upstash, Google Cloud Console, Meta Developer.

Generate secrets locally:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 24   # META_WEBHOOK_VERIFY_TOKEN (any long random string)
```

---

## 1. Neon (Postgres + pgvector)

1. Create project → copy the **pooled** connection string → `DATABASE_URL`.
2. Enable extension (SQL editor):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

3. From this repo (with `DATABASE_URL` in env):

```bash
cp .env.example .env   # fill DATABASE_URL at least
npm install
npm run db:migrate
```

Confirm tables: `users`, `partners`, `saved_items`, `whatsapp_connection_requests`, `partner_members`.

---

## 2. Upstash (Redis)

1. Create Redis database (region near `lhr` if possible).
2. Copy the **Redis URL** (`rediss://…`) → `REDIS_URL`.

---

## 3. Fly.io — API

```bash
# once per machine
fly auth login
fly apps create sor7ed-button-api
fly volumes create sor7ed_uploads --region lhr --size 3 -a sor7ed-button-api

# set secrets (never commit these)
fly secrets set -a sor7ed-button-api \
  DATABASE_URL="postgres://…" \
  REDIS_URL="rediss://…" \
  JWT_SECRET="…" \
  BASE_URL="https://sor7ed.com" \
  API_BASE_URL="https://api.sor7ed.com" \
  WEB_ORIGIN="https://sor7ed.com" \
  COOKIE_DOMAIN=".sor7ed.com" \
  META_WHATSAPP_TOKEN="…" \
  META_WHATSAPP_PHONE_ID="…" \
  META_WEBHOOK_VERIFY_TOKEN="…" \
  META_APP_SECRET="…" \
  META_WHATSAPP_DISPLAY_NUMBER="447…" \
  GOOGLE_CLIENT_ID="….apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="…" \
  OPENAI_API_KEY="sk-…"

fly deploy -c fly.api.toml --app sor7ed-button-api
```

Health check: `curl https://sor7ed-button-api.fly.dev/health` → `{"status":"ok"}`.

### Custom domain `api.sor7ed.com`

```bash
fly certs add api.sor7ed.com -a sor7ed-button-api
# Add the DNS records Fly prints (CNAME or AAAA) at your DNS host
fly certs show api.sor7ed.com -a sor7ed-button-api
```

---

## 4. Fly.io — worker

```bash
fly apps create sor7ed-button-worker

# Same secrets as API (worker needs DB, Redis, Meta, OpenAI, BASE_URL, API_BASE_URL)
fly secrets set -a sor7ed-button-worker \
  DATABASE_URL="postgres://…" \
  REDIS_URL="rediss://…" \
  JWT_SECRET="…" \
  BASE_URL="https://sor7ed.com" \
  API_BASE_URL="https://api.sor7ed.com" \
  META_WHATSAPP_TOKEN="…" \
  META_WHATSAPP_PHONE_ID="…" \
  META_APP_SECRET="…" \
  META_WHATSAPP_DISPLAY_NUMBER="447…" \
  OPENAI_API_KEY="sk-…"

fly deploy -c fly.worker.toml --app sor7ed-button-worker
fly logs -a sor7ed-button-worker
# expect: "SOR7ED BUTTON worker running (enrichment + reminders + monthly reset)"
```

### Uploads caveat (important)

`core/src/storage.ts` writes to **local disk**. API and worker are separate Fly apps → separate disks.

**MVP options (pick one):**

| Option | Effort | Notes |
|---|---|---|
| **A. Skip fancy images first** | none | Saves still work; cards use OG fallback / partner image URL until you add object storage |
| **B. R2/S3** | ~1 hr | Swap `uploadImage` in `storage.ts`; both processes write to the same bucket. **Recommended before scale** |
| **C. Single combined process** | medium | Run worker in the same machine as API (not in default compose) |

Do **not** expect worker-written files to appear on `api.sor7ed.com/uploads/*` until B or C.

---

## 5. Vercel — web

```bash
cd web
vercel link          # create / link project
```

### Project settings (Vercel dashboard or `vercel` prompts)

- **Root Directory:** `web`
- **Framework:** Next.js
- **Install Command:** from monorepo root is trickier — simplest path:

**Option A (recommended):** deploy from monorepo root with:

```
Install Command:  npm install
Build Command:    npm run build --workspace=web
Output Directory: web/.next
Root Directory:   .   (repo root)
```

Or use Vercel’s monorepo “Root Directory = `web`” and add `web` install that can resolve `@sor7ed/types`:

Because `web` only depends on `@sor7ed/types` (plain TS, no build), Root Directory = `web` works if you also include types via:

```
# vercel project Root Directory = web
# Install: cd ../ && npm install --workspace=web --workspace=types
```

**Simplest proven path for this repo:**

1. Vercel → New Project → import `claudiokurath/sor7ed-button`
2. Root Directory: **`web`**
3. Environment variables (Production):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.sor7ed.com` |
| `NEXT_PUBLIC_WEB_ORIGIN` | `https://sor7ed.com` |
| `NEXT_PUBLIC_WEB_BASE_URL` | `https://sor7ed.com` |
| `API_INTERNAL_URL` | `https://api.sor7ed.com` |

4. Deploy. Then add domain `sor7ed.com` + `www` in Vercel → Domains.

`widget.js` is served from `web/public/widget.js` → `https://sor7ed.com/widget.js`.

---

## 6. Google OAuth

[Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth 2.0 Client (Web):

**Authorized JavaScript origins**

- `https://sor7ed.com`
- `https://api.sor7ed.com`

**Authorized redirect URIs**

- `https://api.sor7ed.com/api/auth/google/callback`

Client ID → `GOOGLE_CLIENT_ID`  
Client secret → `GOOGLE_CLIENT_SECRET` (Fly api secrets)

---

## 7. Meta WhatsApp Cloud API

1. Meta Developer App → WhatsApp → API Setup → copy **Token** + **Phone number ID**.
2. **Display number** (E.164, no `+`) → `META_WHATSAPP_DISPLAY_NUMBER`.
3. App → Settings → Basic → **App Secret** → `META_APP_SECRET`.
4. WhatsApp → Configuration → Webhook:

| Field | Value |
|---|---|
| Callback URL | `https://api.sor7ed.com/webhook/whatsapp` |
| Verify token | same as `META_WEBHOOK_VERIFY_TOKEN` |
| Subscribe | `messages` |

5. **Message templates** (Business Manager, language `en_GB`):

### `sor7ed_saved_card`

- Header: **IMAGE**
- Body: something like  
  `Saved from {{1}}\n\n*{{2}}*`  
  ({{1}} = partner name, {{2}} = title — match `core/src/whatsapp/service.ts`)
- Button: **Visit website** → dynamic URL path `s/{{1}}`  
  Base URL in template config must be `https://sor7ed.com/`  
  (full link becomes `https://sor7ed.com/s/<shortId>`)

### `sor7ed_reminder`

- Body: title + url placeholders matching `service.ts` reminder send

After approval, test outside the 24h window (or use a fresh number).

---

## 8. DNS checklist

| Host | Type | Target |
|---|---|---|
| `sor7ed.com` / `www` | per Vercel | Vercel |
| `api.sor7ed.com` | CNAME/AAAA | per `fly certs` |

Wait for TLS on both. Then:

```bash
curl -sS https://api.sor7ed.com/health
curl -sSI https://sor7ed.com/widget.js | head -5
```

---

## 9. Env matrix (copy-paste)

### Fly `sor7ed-button-api`

```
DATABASE_URL
REDIS_URL
JWT_SECRET
BASE_URL=https://sor7ed.com
API_BASE_URL=https://api.sor7ed.com
WEB_ORIGIN=https://sor7ed.com
COOKIE_DOMAIN=.sor7ed.com
META_WHATSAPP_TOKEN
META_WHATSAPP_PHONE_ID
META_WEBHOOK_VERIFY_TOKEN
META_APP_SECRET
META_WHATSAPP_DISPLAY_NUMBER
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
OPENAI_API_KEY          # optional but recommended
NODE_ENV=production     # set via fly.toml [env]
PORT=8080               # set via fly.toml [env]
```

### Fly `sor7ed-button-worker`

```
DATABASE_URL
REDIS_URL
JWT_SECRET
BASE_URL=https://sor7ed.com
API_BASE_URL=https://api.sor7ed.com
META_WHATSAPP_TOKEN
META_WHATSAPP_PHONE_ID
META_APP_SECRET
META_WHATSAPP_DISPLAY_NUMBER
OPENAI_API_KEY
NODE_ENV=production
```

### Vercel `web`

```
NEXT_PUBLIC_API_BASE_URL=https://api.sor7ed.com
NEXT_PUBLIC_WEB_ORIGIN=https://sor7ed.com
NEXT_PUBLIC_WEB_BASE_URL=https://sor7ed.com
API_INTERNAL_URL=https://api.sor7ed.com
```

---

## 10. Go-live smoke test

1. Open `https://sor7ed.com/dashboard` → Google login → lands back signed in.
2. Create partner → copy embed snippet.
3. Paste on a test HTML page (or use dashboard setup).
4. Click **Save to WhatsApp** → CONNECT flow → message arrives.
5. Confirm `https://sor7ed.com/s/<shortId>` shows OG for WhatsApp crawler (`curl -A WhatsApp …`).
6. Text reply: text `LIBRARY` to the business number.
7. Fly logs: `fly logs -a sor7ed-button-api` / `…-worker` — no boot crashes on missing env.

---

## 11. Local prod-like check (optional)

```bash
cp .env.example .env   # fill real-ish values; NODE_ENV=development for looser checks
npm install
npm run dev:infra
npm run db:migrate
npm run dev:api & npm run dev:web & npm run dev:worker
```

Production fail-fast (`assertRequiredEnv`) only enforces the full Meta/Google set when `NODE_ENV=production`.

---

## 12. Rollback

```bash
fly releases -a sor7ed-button-api
fly deploy -c fly.api.toml --app sor7ed-button-api --image <previous-image>
# Vercel: Promote previous deployment in dashboard
```

---

## Related docs

- [README.md](./README.md) — product + local dev
- [AGENTS.md](./AGENTS.md) — invariants for AI/humans editing code
- `.env.example` — every variable with comments
