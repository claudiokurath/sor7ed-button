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
