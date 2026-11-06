# Consistent saved-link cards

Saved links use one WhatsApp image CTA with the captured page title, destination
hostname and an Open button pointing directly to the original URL. The browser
extension's existing metadata capture and package remain compatible.

The API serves a signed image-only URL tied to the saved item, using a separate
HMAC purpose with the existing API signing key. It reads only that row's stored
image location. Invalid signatures cannot trigger saved-item or source-image reads.
No saved URL, account data, cookies or browser screenshot is exposed by the media
route. Missing/deleted rows or temporary image lookup failures use brand artwork.

Source images use the existing public-address/redirect fetch guard. Only HTTPS
JPEG, PNG and WebP raster media are accepted, with a 3MiB streamed-byte cap,
16-megapixel decoding cap, and a four-second deadline including DNS resolution.
Images smaller than 600×315, extreme banners, animated, corrupt, unsupported,
blocked or unavailable media use the approved black-and-yellow scribble.

All frames are 1200×630 JPEG. Suitable pictures are auto-oriented, fitted inside
the frame without stretching, cropping or enlargement, and padded with black.
Source metadata is not preserved. The brand mark is rendered from the approved
vector at extension/brand/scribble-circle-yellow.svg. The generated brand source
in core/src/whatsapp/brand-mark.ts must be regenerated if that approved vector
changes.

Meta fetches the signed image from the API. The shared PlanetSorted gateway
allows only the specified image-card structure and own API image origin, while
retaining HMAC authentication and idempotent provider receipts. The Button still
enforces STOP and its existing 24-hour conversation window before sending. There
is no paid template fallback or automatic retry after an uncertain result.

Release order: deploy the backward-compatible gateway first, then the Button API.
The public `/api/card-images/brand` endpoint is a read-only brand-image check.
No credentials or schema changes are needed; no R2, worker or new paid service is
introduced. Actual receipt on a phone requires a real save; automated checks use
controlled provider responses and disposable test data.
