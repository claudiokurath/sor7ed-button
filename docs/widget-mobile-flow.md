# Widget navigation and partner setup

Phones up to 767px, and touch devices up to 1024px, open `/save` in the current
tab. Desktop keeps the popup; a blocked popup falls back to the current tab.
The same flow ID follows both paths and survives sign-in through `next`.
The save page shows actual delivery status and a user-operated return link.
It never automatically redirects back or fabricates an on-page success state.
Return destinations must be HTTP(S), contain no credentials and match the
initiating origin. These are explicit external links, not trusted redirects.

Partner saves now start at `/signin`, using the existing signed-webhook,
browser-proof and six-digit-code mechanism. Google is not a prerequisite.
This does not add account linking or merge phone and Google accounts.
Desktop message validation still checks source window, exact origin, flow and
demo flag. Popup polling/listeners stop after ten minutes; retries retain the
same action ID. No uncertain delivery is automatically retried.

## Content Security Policy

Allow `https://www.sor7ed.com` in `script-src` to load `widget.js`, and in
`img-src` for the existing tangle image. The widget opens a top-level save
page; it does not use an iframe, so no `frame-src` permission is needed.
It does not call the API from the partner page.

The current widget injects scoped CSS into a style element; it is not Shadow
DOM isolation. For a strict `style-src`, provide your server-generated nonce
on the widget script tag and include that same nonce in the style policy.
The widget propagates the script nonce to its style element. Do not use a
fixed nonce or weaken the whole site to `unsafe-inline` for this widget.
Animation uses JavaScript CSS properties; verify your actual policy in the
browser. Host CSS can still affect the widget; stronger isolation needs its
own compatibility review rather than silently changing partner behaviour.

The optional font request uses `https://fonts.googleapis.com` in `style-src`
and `https://fonts.gstatic.com` in `font-src`. If blocked, the local monospace
fallback remains usable. Describe those third-party requests in your notice.

## Verification boundaries

`npm run test:widget` verifies widget navigation and cleanup with browser API
stand-ins and validates return destinations. The production web build is
also checked with mocked API responses on mobile and desktop. Neither test
proves Instagram/Facebook webview behaviour or real WhatsApp delivery.
The API, Button Meta credentials and migration 0008 are still launch gates.
