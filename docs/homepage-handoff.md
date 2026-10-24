# Homepage design handoff

Implements the marketing-site prototype supplied in `project (1).zip` on
23 October 2026. The supplied Archivo and JetBrains Mono fonts and white tangle
asset are served locally. No prototype CDN, runtime Babel, or global React is
included. The small garden illustration is a local demo asset.

The homepage and informational sections render on the server. Only the
interactive tangle/card preview is a client component. Its animation can be
reset, respects reduced motion, and sends no API requests or WhatsApp messages.
Its image is preloaded so pressing the mark needs no network request.

Existing `/demo`, `/save`, `/save/demo`, `/s`, partner dashboard, widget,
backend, databases and legacy domain redirects are unchanged. Dashboard,
widget and popup prototypes in the ZIP remain design references for later work.

## Release limitations

The public API health and login endpoints returned HTTP 404 during the prior
read-only verification. The homepage directs visitors to the local simulation
and setup explanation instead of broken signup or dashboard links. It clearly
states that live saving and partner account setup are not available yet.

Production activation requires the API/worker deployment, correct API domain,
provider configuration, an end-to-end consent/sign-in/delivery check, and a
complete Button-specific privacy policy. The current page has a labelled
privacy summary only. No production data or credentials were changed.

## Validation

- Next production build and workspace TypeScript checks.
- Existing tests: 99 pass; 24 database-dependent tests skip without disposable
  Postgres configuration. No shared database was used.
- Chromium: 320, 390, 768 and 1440px widths; overflow, CTA colours, demo
  preview/reset, FAQ and partner anchors; reduced motion and keyboard checks.
- Recheck old sor7ed.com content path redirects with fake query parameters;
  Button routes and preview hosts must remain on the Button app.

This branch is for preview/review. It does not itself activate live delivery.

## 24 October refinement from supplied audit transcript

The later pasted export contains homepage suggestions and an audit discussion,
not the missing `SOR7ED Save.html` consumer prototype. Applied the relevant
homepage refinements without replacing the working app with untested sketches:

- Mounted preview and image before interaction; state controls visibility.
- Accessible toggle state, controlled preview and explicit reset label.
- Pixel-unit tick offset; demo labels wrap at word boundaries.
- Embed example uses the verified www widget host (HTTP 200).
- Clarified unrestricted empty domain lists, subdomains, forwarded-link opens,
  stored identifiers, opt-out/session data and ambiguous sending outcomes.

Evidence for the public copy:

| Claim | Source |
| --- | --- |
| Domain list behavior | `core/src/domain-check.ts` |
| Saved metadata, Google ID, WhatsApp state/message ID | `core/src/schema.ts` |
| Partner metrics and key rotation | `web/src/app/dashboard/page.tsx`, `rotate-key-button.tsx`, `api/src/routes/partner.ts` |
| Send outcome distinctions | `web/src/app/save/page.tsx`, `core/src/whatsapp/service.ts` |
| Human link opens | `web/src/app/s/[shortId]/page.tsx` |
| Supported embed attributes | `web/public/widget.js` |

Validation for this refinement: Node 24.19.0; web typecheck and production build
passed. API/core tests: 99 passed, 24 database tests skipped because this
homepage-only run did not configure a disposable database. Existing mocked
`verify-save-flow.cjs` passed. Chromium at 320/390/768/1440px verified zero
requests during preview/reset, no overflow, stable preview-slot dimensions and
keyboard controls. Screenshots retained in the execution workspace under
`artifacts/homepage-refinement/`.

Generated redirect rules match the pre-change production manifest exactly.
HTTP checks preserve 307 legacy content redirects and query strings, keep
`/save` on the Button, and keep dashboard authentication on the Button API.
The local `/s/example` check returns 500 without a running API; no live saved
item or real delivery was tested. Homepage changes do not alter that route.
Read-only production checks: www widget and fallback image HTTP 200; API health
and `/bot` HTTP 404. The full-demo wording in widget.js remains unchanged.

The transcript's SSRF, invite concurrency, enrichment overwrite, reminders and
stale-pending findings are audit leads, not verified fixes in this PR. They
need review against the current backend branch (lean mode separately disables
enrichment and reminders). No backend, migration, provider configuration,
production deployment or customer record was changed by this refinement.
The privacy summary still needs a full Button-specific policy before launch.
