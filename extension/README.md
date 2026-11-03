# Sorted browser extension (unreleased)

Build from the repository root: `npm run extension:package`.
Extract `dist/send-to-sorted-extension.zip`, then choose **Load unpacked** in
Chrome/Edge's extensions developer mode. It opens the central Sorted save window
for a page you explicitly choose. Sign-in and sending need the deployed Button
API and configured Meta account; loading the extension alone does not activate
them. This is not a browser-store release.

Version 0.1.1 includes the original white scribble on black for the toolbar and
extension listing. After replacing an older extracted folder, press **Reload**
on its card in `chrome://extensions` (or `edge://extensions`), then pin it to
the toolbar. Existing manually loaded copies do not update from the website.
To rebuild the icon files from the original mark, run
`node scripts/build-extension-icons.mjs` before packaging.

See `docs/consumer-account-extension.md` for data handling, limitations,
verification and the separate development-only origin override.
