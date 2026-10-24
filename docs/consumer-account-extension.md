# Consumer account and extension — lean implementation

Built on feat/lean-button. This is a new implementation against the actual
repository, not the unavailable patch described in the supplied handover.

## Product boundary

PlanetSorted remains the public content site. The Button's `/signin`, `/account`
and `/save/extension` belong to www.sor7ed.com. Existing partner widgets keep
using `/save`; when Google is unconfigured, their return URL is carried through
the central WhatsApp sign-in. No PlanetSorted credentials or code were copied.

## Authentication

The browser requests a 10-minute challenge and retains a random browser proof.
The user sends a prepared SIGNIN message to the business WhatsApp number. Only
a raw-signature-verified Meta webhook can associate that challenge with a phone
and issue a six-digit code. The user types the code into the initiating browser.
Tokens, browser proofs and codes are HMAC-hashed in Postgres; the proof never
enters WhatsApp. The challenge locks after five wrong codes and is consumed in
a row-locked transaction. Replayed webhooks cannot issue a second code. No user
is created until code verification succeeds. Existing opt-outs remain in force.

A 30-day HttpOnly session cookie uses Secure in production, SameSite=Lax and
COOKIE_DOMAIN for the Button's sibling subdomains. Account changes require the
configured WEB_ORIGIN. Google OAuth remains optional in lean mode and available
for existing installations. SIGNIN_SECRET may be set independently; otherwise
JWT_SECRET is used. Configure real Meta credentials; fake credentials are not a
production substitute. No live message was sent during this implementation.

## Account

- Latest 100 saved pages shown as compact cards, with websites used.
- No fabricated recommendations or populated empty history.
- Display-name edit, masked phone, pause/resume and sign-out.
- Owner-scoped removal and transactional account deletion with cascading owned
  history; pending sign-in challenges for the number are removed too.
- Website team members must remove/transfer membership before deleting the
  consumer account, so website administration is not orphaned silently.
- Changing number currently means signing out and verifying a different number;
  history is not transferred or merged. Full account recovery/number migration
  is not implemented.

## Capture and saving

The MV3 extension uses activeTab, scripting and contextMenus, with no persistent
host permissions, background page scraping or external-message listener. The
production save destination is fixed to https://www.sor7ed.com. Toolbar and
context-menu handlers open the central save window; they never send a message
by themselves. It captures address/title/preview metadata, not full content or
login cookies. The user reviews the address and chooses to save it. Anyone with
a generated card URL can view its preview and open the original page; do not
represent these URLs as a private document vault.

The capture arrives in a fragment, is persisted in sessionStorage before any
sign-in redirect, and is removed from the address bar. The draft expires after
30 minutes. Its action identity derives from the random flow UUID, surviving
reload and sign-in. After persistence succeeds, the draft is removed and a local
receipt prevents reload from creating another save. A new explicit capture is
a new action. The database partial unique index plus user-row lock arbitrates
concurrent saves; the personal budget is 100 new saves per rolling 24 hours.
Original public HTTPS images are linked, never fetched/resized/uploaded by this
flow. Private pages may not provide usable preview images.

Only a newly claimed action may send. Checking status never sends. An explicit
resend has its own durable unique action key, requires confirmation and cannot
claim accepted or pending items. Unknown outcomes warn that a previous message
may already exist. Lean mode retains session-window and opt-out checks; it never
requests a template when a conversation has closed. No reminders or AI jobs.

## Database and release

Migration 0007 remains unchanged. Drizzle generated
0008_consumer_account_extension.sql with its journal and snapshot. It adds
sign-in challenges, resend action records, display name, source metadata and
an extension-only partial idempotency index. Existing rows retain partner
source. The optional old handover's partner discovery/listed catalog was not
recreated: recommendations currently link only to PlanetSorted, not invented
participating websites. Apply 0008 before deploying this branch's API. It has
only been applied to disposable local test databases, not the live Neon project.

Keep the API and web origins consistent with LEAN_DEPLOY.md. Before release,
configure Meta, deploy the API, check health and signed webhook subscription,
then deploy web and run a real-device sign-in/save/STOP/reopen test. A genuine
production HTTPS test and Meta delivery test remain outstanding. The Button
homepage redesign is separate PR #4; this branch does not replace it.

## Extension artifact

Run `npm run extension:package`. Output is dist/send-to-sorted-extension.zip.
Extract it and use Chrome/Edge's developer mode → Load unpacked. This is not a
browser-store release. For isolated local tests only, packaging accepts
`--dev-origin http://localhost:PORT` and emits a distinctly named DEVELOPMENT
ZIP; the production ZIP contains no localhost destination. A store release
still needs developer-account access, icons/store listing and a privacy policy.

## Verification

- Complete typecheck and production build.
- Existing 126 API/core tests with disposable Postgres, no database skips.
- Mandatory CI lean HTTP suite: signed WhatsApp sign-in, correct browser proof,
  expiry, five-attempt lock, replay/single-use protection, a real signed session
  cookie, concurrent personal-save and resend claims, ownership, pause, deletion,
  closed windows, quota races and shared Postgres limits across two processes.
- `npm run test:extension`: restored/expired drafts, immutable content per flow,
  stable action identity, mocked toolbar/context handlers and manifest limits.
- Chromium production web build at 390 and 1280px with API fixtures: capture
  survives sign-in, fragment is cleared, exactly one save occurs, reload does
  not resend, history removal works, no overflow or JavaScript errors.

The actual browser toolbar UI was not clicked, and no extension store was
contacted. Handler tests and capture tests are not a claim of that verification.
The API tests use real Postgres and a local Meta stand-in, not live WhatsApp.
