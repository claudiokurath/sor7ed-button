# Save and WhatsApp connection reliability

## API contract

Updated widgets submit a stable `idempotencyKey` with `/api/saves`. The key
identifies one user action, not every future save of that URL. The same key
and payload return the original save; changing the payload returns 409.
User and partner scope prevent another account's action from being reused.

The unique action insert and conditional quota increment commit in one
transaction. Only the winning request enqueues enrichment and attempts a
WhatsApp send. Old callers without a key remain compatible but do not get
retry deduplication; update their integration to supply a stable key.

Responses retain `shortId` and `cardUrl` and add:

```json
{
  "shortId": "abc123def456",
  "cardUrl": "https://sor7ed.com/s/abc123def456",
  "saveStatus": "saved",
  "deliveryStatus": "accepted",
  "deliveryReason": null
}
```

Delivery states:

| State | Meaning |
|---|---|
| pending | Original request is still attempting sending. |
| accepted | Meta returned a message ID; device delivery is not established. |
| skipped | No verified number or the user opted out. |
| failed | Configuration or a definite provider rejection prevented sending. |
| unknown | Network interruption, ambiguous provider result or missing message ID. |

`GET /api/saves/status/:shortId` requires the owning user's session and
returns this same contract with private/no-store caching. Pending work older
than two minutes is reported as unknown. Replays and status checks **never
resend**, including after an ambiguous timeout. Historical rows default to
unknown because their previous delivery cannot be inferred reliably.

This change records outcomes; it does not add durable delivery jobs or
Meta delivered-status callbacks. A process crash can leave unknown work.
The next reliability phase is an outbox/inbox with reconciliation, rather
than blindly retrying sends that may already have reached Meta.

## Connection behaviour

`POST /api/whatsapp/connect` reuses one active pending token and returns
`{url, expiresAt}`. Explicit `{refresh:true}` invalidates pending links and
creates a new one. Issuance, refresh and verification lock the same user
row. Verification claims an unexpired token conditionally and expires all
other legacy pending links within the same transaction. If linking the
phone fails, the claim rolls back.

The popup creates one link and polls `/api/auth/me`; polling never creates
new tokens. Focus/visibility events and save attempts are single-flight.
The action ID survives OAuth and reloads. Widgets correlate messages by
origin, popup window and flow ID; nonaccepted states use `save-status` so
old widgets do not mistake them for a successful send.

## Rollout

1. Run `npm run db:migrate` against this product's own database to apply
   `0006_save_action_delivery` before deploying code that queries its columns.
2. Deploy the API and worker with the updated shared core package.
3. Deploy web and widget together; smoke-test a new and a returning user.

No Planet Sorted credentials or database migrations are involved. This PR
does not apply any production migration or send test WhatsApp messages.
If rolling application code back, retain the additive migration. Do not
drop new columns while the updated API is still serving requests.

## Regression checks

`npm test` runs helper/provider/API tests. Database suites are opt-in and
refuse nonlocal URLs or unexpected database names. CI enables all suites
using a disposable pgvector/Postgres service, without production secrets.

To reproduce locally on a disposable instance (example port 55437):

```sh
docker run --rm -d --name sor7ed-save-tests -p 127.0.0.1:55437:5432 \
  -e POSTGRES_USER=sor7ed_test -e POSTGRES_PASSWORD=local-test-only \
  -e POSTGRES_DB=postgres pgvector/pgvector:pg16
# Wait until: docker exec sor7ed-save-tests pg_isready -U sor7ed_test -d postgres
export SOR7ED_TEST_ADMIN_URL=postgresql://sor7ed_test:local-test-only@127.0.0.1:55437/postgres
export SOR7ED_TEST_DATABASE_URL=postgresql://sor7ed_test:local-test-only@127.0.0.1:55437/sor7ed_save_tests
export SOR7ED_CONNECTION_TEST_DATABASE_URL=postgresql://sor7ed_test:local-test-only@127.0.0.1:55437/sor7ed_connect_tests
export SOR7ED_API_TEST_DATABASE_URL=postgresql://sor7ed_test:local-test-only@127.0.0.1:55437/sor7ed_api_tests
node scripts/create-save-test-databases.mjs
npm test
npm run typecheck
npm run build
```

The setup script recreates only those three named local test databases.
Stop other fixture tests before running it. Tests cover concurrent saves,
quota exhaustion and rollback, owner-only status reads, exclusive CONNECT
verification, refresh/expiry, legacy duplicate tokens and uncertain sends.
