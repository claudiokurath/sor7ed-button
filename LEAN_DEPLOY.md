# Lean Button launch

This is the Button backend, not a browser extension. PlanetSorted remains a separate content website. Use this guide for the budget-conscious launch; the Fly/Redis/R2 instructions in DEPLOY.md describe full mode only.

## What runs

- Existing Next.js web project on Vercel: `https://www.sor7ed.com`.
- Separate Fastify API project on Vercel: `https://api.sor7ed.com`.
- Existing Neon Postgres project, pooled connection for runtime; direct connection for migrations.
- `BUTTON_MODE=lean` on the API. No worker, Redis, R2, AI calls or reminder scheduler.

Shared rate limits use atomic Postgres counters. Monthly partner quotas reset lazily on the first new save of the month. Original HTTPS preview images are used without uploading copies; the source can remove or block them. Webhook processing is registered with Vercel `waitUntil` before acknowledging Meta. This is bounded request processing, not a durable queue; monitor failures and provider retries.

Automatic WhatsApp delivery is retained inside the service window. Outside it, the popup asks the user to reopen the conversation. Lean mode never falls back to a paid template. An ambiguous send is not retried automatically, to avoid duplicate messages. STOP and START still control opt-outs. No claim that provider usage or hosting is free indefinitely: confirm current limits and terms before launch.

## Database

Apply all source-controlled migrations, including `0007_lean_rate_limits`, before enabling lean mode. Use the direct Neon connection for migrations:

```sh
npm ci
DOTENV_CONFIG_PATH="$PWD/.env.local" npm run db:migrate
```

The root env file must contain DATABASE_URL and DATABASE_URL_UNPOOLED. Keep both private. Rotate any connection password previously shared in chat. Do not migrate PlanetSorted's database or reuse its credentials.

## API project

Import `claudiokurath/sor7ed-button` as a separate Vercel project with root directory `api`, Fastify framework and Node.js 22. Enable access to source outside the root directory so `core` and `types` workspaces resolve. Install from the monorepo lockfile. `api/vercel.json` selects London. Do not activate the repository-root multi-service configuration for this arrangement.

Set these API-only environment variables in the deployment environment:

```text
BUTTON_MODE=lean
DATABASE_URL=<Button pooled Neon URL>
JWT_SECRET=<new random secret>
BASE_URL=https://www.sor7ed.com
API_BASE_URL=https://api.sor7ed.com
WEB_ORIGIN=https://www.sor7ed.com
COOKIE_DOMAIN=.sor7ed.com
GOOGLE_CLIENT_ID=<optional Button OAuth client>
GOOGLE_CLIENT_SECRET=<optional Button OAuth secret>
META_WHATSAPP_TOKEN=<Button WhatsApp access token>
META_WHATSAPP_PHONE_ID=<Button sending phone ID>
META_WHATSAPP_DISPLAY_NUMBER=<international digits without plus>
META_WEBHOOK_VERIFY_TOKEN=<new random verification token>
META_APP_SECRET=<Button Meta app secret>
```

Vercel supplies NODE_ENV=production and VERCEL. Do not set dummy provider secrets to bypass boot checks. Google and Meta account configuration remains required before the API can go live.

Google OAuth redirect URI:
`https://api.sor7ed.com/api/auth/google/callback`

Meta webhook callback, subscribed to messages:
`https://api.sor7ed.com/webhook/whatsapp`

After a healthy preview, assign api.sor7ed.com to the API project and replace its stale deployment mapping. Keep the web domain assigned to the existing web project. Never redirect the API namespace to PlanetSorted.

## Web configuration

```text
NEXT_PUBLIC_API_BASE_URL=https://api.sor7ed.com
NEXT_PUBLIC_WEB_ORIGIN=https://www.sor7ed.com
NEXT_PUBLIC_WEB_BASE_URL=https://www.sor7ed.com
API_INTERNAL_URL=https://api.sor7ed.com
```

Redeploy web after changing public env vars. Authentication cookies require the sibling-domain configuration above. On previews, test using a consistent allowed origin and cookie domain rather than weakening production CORS.

## Verification completed

- Typecheck and complete production build passed.
- 126 API/core tests passed with disposable Postgres; no skipped database tests.
- `npm run test:lean` passed: signed CONNECT, automatic sending through a local Meta stub, duplicate protection, ambiguous-send protection, opt-outs, closed-window behavior, concurrent quota enforcement and shared rate limits across two API processes.
- Save popup checked at 390px and 1280px: no initial send with a closed window, exactly one send after reopening, no overflow or JavaScript errors.

The integration harness refuses production databases and external HTTP. It requires a disposable loopback database named sor7ed_lean_tests, via SOR7ED_LEAN_TEST_DATABASE_URL. See scripts/create-save-test-databases.mjs and CI for the complete setup.

These checks do not prove real Google login or WhatsApp delivery. Final live checks require the owner's Google/Meta setup: sign in, CONNECT, click once, verify one message, repeat the click, test STOP, and test reopening a closed window. `/health` must report database ok and redis disabled. No Fly machines, Redis plan or upload service is required for this mode.

## Consumer account and extension follow-up

See [consumer-account-extension.md](docs/consumer-account-extension.md). That
branch adds WhatsApp-proven sign-in without Google and requires migration 0008.
Google credentials are optional in lean mode there; Meta credentials still
remain necessary. The original deployment and real-device checks still apply.

## November 2026 security correction

- Website keys start disabled. Create a partner account, request its partner-bound DNS TXT challenge in the dashboard, publish the record and verify it. Empty domains authorize nothing. Keep records published; successful DNS checks are cached for at most five minutes. Existing registered domains also need proof before saves work. No database migration is required for this proof layer. Changing JWT_SECRET changes DNS proof values and requires updating records.
- Saved-link previews show the real destination hostname. Opening /s shows a confirmation; only its explicit Continue POST redirects. Both Button web and API require the same server-only CLICK_TRACKING_SECRET in production to record continuations. It must never use a NEXT_PUBLIC_ prefix. The production values were configured securely without exporting existing credentials. Unsigned click calls fail; one continuation per keyed network address/item/day is counted. Counts remain estimates and do not prove unique readers or completed publisher sessions.
- Google login requires verified_email and checks the return address both before and after OAuth.
- Web responses deny framing and include CSP, no-referrer and nosniff. The widget and font are served from SOR7ED; document the widget origin in partner script/style/font/image/connect CSP directives.
- Button terms live at /button-terms; old PlanetSorted /terms links retain their compatibility redirect. The Chrome extension is still a developer-preview ZIP until a store account publishes a reviewed release; do not describe it as available from an app store.

Verification uses fixture accounts/resources and simulated providers. Real WhatsApp delivery, payment and production DNS ownership were not exercised with customer data.
