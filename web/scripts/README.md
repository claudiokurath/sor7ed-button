# Save flow browser checks

`verify-save-flow.cjs` exercises the real widget and Next.js popup with mocked
API responses. It covers delivery outcomes, connection polling, expiry refresh,
concurrent focus events, missing/relative images, retry/reload/OAuth action IDs,
current content metadata, forged popup messages and the labelled demo. It does
not contact Meta, send WhatsApp messages, or use real credentials.

Start the web app in one terminal:

```sh
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 npm run dev --workspace=web -- --port 3045
```

If Playwright and Chromium are available, run in a second terminal:

```sh
SAVE_FLOW_WEB_ORIGIN=http://localhost:3045 node web/scripts/verify-save-flow.cjs
```

Otherwise install the browser tools outside this repository, then run:

```sh
S7_BROWSER_TOOLS=/tmp/sor7ed-browser-tools
npm install --prefix "$S7_BROWSER_TOOLS" --no-save --package-lock=false playwright
"$S7_BROWSER_TOOLS/node_modules/.bin/playwright" install chromium
NODE_PATH="$S7_BROWSER_TOOLS/node_modules" SAVE_FLOW_WEB_ORIGIN=http://localhost:3045 node web/scripts/verify-save-flow.cjs
```

`SAVE_FLOW_API_ORIGIN` must match the web app’s `NEXT_PUBLIC_API_BASE_URL` if it
differs from `http://localhost:3001`. `CHROMIUM_PATH` optionally selects an
installed Chromium binary. The test uses distinct loopback origins to verify
popup origin checks. It disables Chromium’s local-network permission prompt
for that local fixture; normal CORS and origin protections stay enabled.
