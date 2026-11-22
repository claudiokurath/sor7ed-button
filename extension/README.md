# SOR7ED Links browser extension

Build from the repository root: `npm run extension:package`.
Extract `dist/send-to-sorted-extension.zip`, then choose **Load unpacked** in
Chrome/Edge's extensions developer mode. Version 0.2.7 uses the original
scribble on a yellow circular badge and a narrow host grant for `https://www.sor7ed.com/*`.

Clicking the toolbar scribble or the context menu authorizes that selected page.
A small first-party progress window saves automatically for a signed-in member
with an active WhatsApp conversation, then closes after provider acceptance.
A crafted capture URL alone cannot authorize an automatic send. Sign-in or
reconnection appears only when required; the same capture resumes afterward.
Sending uses the original website URL, so WhatsApp resolves its native preview.
A site's missing/private metadata can still prevent a thumbnail from appearing.

After replacing an older extracted folder, press **Reload** on its card in
`chrome://extensions` (or `edge://extensions`), accept the SORTED-domain access
request if shown, then pin the scribble. Manually loaded copies do not update
from the website. This is not a browser-store release.

The extension never continuously reads browsing history and has no all-sites
host grant. Its first-party grant injects only a short-lived approval into the
save tab created by an explicit click; page capture still uses activeTab.
No session token is copied into the extension.

To rebuild icon files: `node scripts/build-extension-icons.mjs`.
See `docs/consumer-account-extension.md` for account handling and the explicit
development-only origin override used by local verification.

The Chrome Web Store package name is SOR7ED Links — Save to WhatsApp; its short name is SOR7ED Links. It is pronounced “Sorted Links”. Both spellings appear in the supplied store copy; search matching is controlled by the store, not a manifest alias. The approved toolbar vector
source is extension/brand/scribble-circle-yellow.svg; the icon builder exports its PNGs
at every required toolbar/store size. Re-upload the ZIP under Package to update
the listing name; editing the listing description does not change that name.

`STORE-LISTING.txt` contains the title, short description and full description to
paste into the Chrome Web Store listing. The package updates its manifest title
and summary; uploading a ZIP does not replace the separately edited full store
description. The archive contains `manifest.json` directly at its root.

The yellow badge uses #FFBA2E with a black scribble and transparent corners.
Small PNG sizes use optical stroke adjustments to retain legibility. The
original standalone bold logo remains in extension/brand/scribble-bold.svg.
