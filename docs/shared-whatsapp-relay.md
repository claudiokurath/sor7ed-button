# Existing-number deployment

Set `WHATSAPP_TRANSPORT=relay` with the lean configuration to use the shared
PlanetSorted WhatsApp sender without copying its Meta credentials. Required:

- `WHATSAPP_RELAY_URL=https://www.planetsorted.com/api/button/whatsapp`
- `WHATSAPP_RELAY_SECRET`: dedicated signing key, also set as
  `BUTTON_RELAY_SECRET` on PlanetSorted; never reuse JWT or Meta credentials.
- `META_WHATSAPP_DISPLAY_NUMBER`: existing registered business number.
- Existing Neon URL, JWT/sign-in secrets, canonical origins and cookie domain.

The API requires no Meta access token, phone ID or app secret in relay mode.
Direct mode retains its existing Meta requirements and raw-body verification.
`/webhook/relay` checks the purpose-bound HMAC and five-minute timestamp,
claims the event ID atomically, and processes a command or silent session update.
The existing rate-limit table stores the hashed event IDs; no schema addition
is needed beyond migration 0008. Inbound events require the original Meta
signature upstream. Caller-supplied forwarded headers are never trusted.

PlanetSorted retains Meta's configured callback. It forwards Button SIGNIN,
BUTTON-CONNECT, LIBRARY and HELP; ordinary messages silently refresh known
Button accounts' service windows. Shared STOP/START updates opt-out state but
only PlanetSorted acknowledges it. Website crisis and weekly-consent handlers
stay on the website. Account/history records remain separate; no implicit
phone/Google/PlanetSorted account merge is performed.

The gateway keeps a private unique-action receipt before sending; a replay
cannot resend an accepted, pending or uncertain message. API send claims and
the 24-hour window still apply. No paid templates, worker or new storage service
is introduced. Background webhook work is lifecycle-bound, not a durable queue.
Do not claim delivered messages or real WhatsApp verification from mocked tests.

## Production packaging

The core workspace exposes `dist/index.js` to production Node processes and
keeps TypeScript source under the development export condition. Build core
before the API; API's build script does this explicitly. Development watch
commands enable the development condition. The lean integration suite now
builds and starts `api/dist/index.js` without tsx, so missing compiled workspace
files fail CI. Docker API/worker images also compile core before launching.
