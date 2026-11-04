# SOR7ED browser extension (unreleased)

Build from the repository root: `npm run extension:package`.
Extract `dist/send-to-sorted-extension.zip`, then choose **Load unpacked** in
Chrome/Edge's extensions developer mode. Version 0.2.0 uses the original
scribble icon and a narrow host grant for `https://www.sor7ed.com/*`.

Clicking the toolbar scribble or the context menu authorizes that selected page.
A small first-party progress window saves automatically for a signed-in member
with an active WhatsApp conversation, then closes after provider acceptance.
A crafted capture URL alone cannot authorize an automatic send. Sign-in or
reconnection appears only when required; the same capture resumes afterward.
Sending uses the original website URL, so WhatsApp resolves its native preview.
A site's missing/private metadata can still prevent a thumbnail from appearing.

After replacing an older extracted folder, press **Reload** on its card in
`chrome://extensions` (or `edge://extensions`), accept the SOR7ED-domain access
request if shown, then pin the scribble. Manually loaded copies do not update
from the website. This is not a browser-store release.

The extension never continuously reads browsing history and has no all-sites
host grant. Its first-party grant injects only a short-lived approval into the
save tab created by an explicit click; page capture still uses activeTab.
No session token is copied into the extension.

To rebuild icon files: `node scripts/build-extension-icons.mjs`.
See `docs/consumer-account-extension.md` for account handling and the explicit
development-only origin override used by local verification.
