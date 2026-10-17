# Vercel Services candidate

`vercel.services.candidate.json` is a review artifact, not active deployment configuration. If adopted, its paths assume the file is copied to the repository root as `vercel.json` and the Vercel project root is the repository root. Services is currently in Beta.

The candidate sends all `api.sor7ed.com` traffic to Fastify, plus `/api/*`, `/health` and `/webhook/whatsapp` on web hosts. The final rewrite serves Next.js, including `widget.js`, `/demo`, `/save`, `/dashboard` and Button's `/s/*` links. The web service receives a deployment-aware `API_INTERNAL_URL` binding; do not replace the binding with a manually configured URL.

Temporary redirects on `sor7ed.com` and `www.sor7ed.com` carry legacy `/go/:slug`, `/r/:slug` and `/auth/whatsapp-confirm` requests to the matching paths on `https://www.planetsorted.com`. The final redirect canonicalizes remaining `www.sor7ed.com` traffic to `sor7ed.com`, matching the API's apex CORS origin. Vercel forwards query strings through these redirects. API-host routes and Button's `/s/*` links remain within Button. Both web domain aliases must be attached to the eventual Button deployment for the compatibility rules to apply.

## Before adoption

- `api/src/routes/webhook.ts` acknowledges signed requests before processing inbound messages. It currently has no durable webhook queue or Vercel `waitUntil` integration. Request-bound execution must account for work after the response before moving this API to Functions.
- `worker/src/index.ts` is a persistent BullMQ consumer for enrichment, reminders and monthly counters. This candidate does not host it. Keep a continuously running worker on a suitable host using the same database, Redis and R2 bucket as the API.
- Apply database migrations through `0006_save_action_delivery` before deploying the updated API. `/health` proves database/Redis connectivity, not schema readiness.
- Set the API/worker requirements documented in `DEPLOY.md`. Browser variables must target `https://api.sor7ed.com` and `https://sor7ed.com`, with API `WEB_ORIGIN=https://sor7ed.com` and `COOKIE_DOMAIN=.sor7ed.com`.
- Confirm production domain assignments, Google OAuth callback and Meta webhook/template configuration separately. This artifact changes none of those settings.

Schema validation establishes configuration syntax. A preview build and public-route checks remain necessary before promotion. For preview browser flows, configure preview origins and the deployment's relative API routes; the internal binding alone does not isolate browser requests from production.
