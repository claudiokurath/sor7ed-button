# Fly bootstrap — 23 October 2026

Created `sor7ed-button-api` and `sor7ed-button-worker` in the authenticated
account's personal organization (Fly CLI slug `personal`). Neither app has a
running production release yet.

The API has staged `BASE_URL`, `API_BASE_URL`, `WEB_ORIGIN`, `COOKIE_DOMAIN`,
and generated `JWT_SECRET` / `META_WEBHOOK_VERIFY_TOKEN`. The worker has staged
`BASE_URL` and `API_BASE_URL`. These are server-side secrets, not repository
files. The canonical web host is `https://www.sor7ed.com`; Vercel's public URL
settings were updated to match for its next build.

## Remaining dependencies

- A separate Neon free-tier project (chosen by the owner), pooled
  `DATABASE_URL` on both apps, pgvector, and the migrations in `core/`.
- A BullMQ-compatible Redis service and `REDIS_URL` on both apps.
- Google OAuth client ID/secret on the API. Authorized callback:
  `https://api.sor7ed.com/api/auth/google/callback`.
- Meta WhatsApp token/phone ID on both apps, plus app secret and WhatsApp
  display number on the API. Configure the signed webhook and matching
  verification token. Do not reuse Planet Sorted credentials implicitly.
- Shared production R2 storage: bucket, account ID, access key, secret key
  and public URL on both apps. Local upload disks are development-only.

Do not move API DNS to Fly until the API is healthy, TLS is ready and all
provider configuration has been checked. No production migrations or live
messages have been run during this bootstrap. Follow DEPLOY.md for activation.

## Container preparation

Both Dockerfiles use Node 22 and copy all workspace manifests before `npm ci`,
preserving the root lockfile's workspace layout. Sharp's locked Alpine native
packages are used instead of installing the development libvips toolchain.
Both images build locally and pass a native image-processing smoke check.

`.dockerignore` excludes credentials, environment files, Git metadata, local
dependencies, build output and archived copies from the build context. The
optional `proxy_ca` build secret supports managed environments without baking
their CA into the resulting image. It is not required on a normal Fly builder.

Fly's Depot build stalled and the fallback remote builder could not establish
its WebSocket tunnel from this execution environment. Local Docker builds
succeeded instead. An image build is not a running deployment.
