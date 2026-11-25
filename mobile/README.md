# SOR7ED mobile

The Account tab opens the **existing https://www.sor7ed.com/account** inside the native app. It uses the same account, history, settings and delivery system as the website and extension. No second member database, API keys or Replit service is needed.

The original local prototype is preserved under **On device**, Backups and Settings. Those links are device-only and are **not automatically uploaded or merged** into the member account. Export them before replacing the device. Clearing local links does not delete the member account.

## Run without Replit

Install Node.js 22 LTS and Git, then:

    git clone https://github.com/claudiokurath/sor7ed-button.git
    cd sor7ed-button
    git checkout mobile/local-library-prototype
    cd mobile
    npm ci
    npx expo start --go

Install Expo Go on your phone and scan the QR code (compatible Expo SDK required). The phone and computer should be on the same network. `npx expo start --go --tunnel` is an optional alternative when local networking is blocked; Expo may prompt to install its tunnel helper. No Mac is needed for Expo Go on iPhone.

This is a standalone package: run its commands **inside mobile/**. It has its own lockfile and is intentionally outside the root npm workspaces.

## Real account and WhatsApp sign-in

1. Open Account. The real SOR7ED sign-in page appears if you are not already signed in inside the app.
2. Start sign-in, open WhatsApp, send the prepared message, then return to the app and enter the received code.
3. Your existing account history loads. Account changes use the existing web/API routes.

The native bridge handles only the existing `about:blank` → `wa.me` popup. Cookies remain in the WebView; no session tokens or proof values are copied into AsyncStorage or messages. Android Back goes back inside the account before leaving the app. External HTTPS links open outside the account view; untrusted schemes are blocked.

The **Open in browser** control is a fallback, including for any Google sign-in route that disallows embedded browsers. Browser and WebView sessions are separate: logging in in the browser does not automatically sign in the WebView. The supported embedded flow is the existing WhatsApp sign-in, without changing authentication.

Web preview (`npm run web`) links to the real account in the browser, because the production site intentionally blocks framing. An internet connection is required for account access. This build does **not** include an Android incoming-share target or an iOS Share Extension.

## Build Android / iPhone with Expo EAS

The Expo owner is **sor7ed**: https://expo.dev/accounts/sor7ed. The app is configured for that owner; the existing project is https://expo.dev/accounts/sor7ed/projects/sor7ed and the linked EAS project ID is `e8a6eb2d-c938-4b5f-b6ed-71aa52741509`. Sign in as an owner/admin of that account. From `mobile/`:

    npx eas-cli@latest login
    npx eas-cli@latest init --id e8a6eb2d-c938-4b5f-b6ed-71aa52741509
    npx eas-cli@latest build --platform android --profile preview

`app.json` already contains the supplied project ID. The `eas init --id` command above verifies the link after login; it should not create another project. The preview profile creates an installable Android APK. EAS provides the build/download URL when complete; it does not place a file in Downloads automatically.

For store builds:

    npx eas-cli@latest build --platform android --profile production
    npx eas-cli@latest build --platform ios --profile production

EAS can build iOS in the cloud without a local Mac. Apple signing/TestFlight distribution requires an Apple Developer membership. An iOS internal preview also needs registered test devices. A native development build uses the `development` profile, then `npx expo start --dev-client`.

Identifiers are `com.sor7ed.mobile` on both platforms. Confirm availability in your developer accounts before the first store release. Store submission/review is separate from building; a minimal website container is not guaranteed acceptance. No store submission or paid cloud build is performed by the repository checks.

## Verify

    npm run typecheck
    npm test
    npx expo install --check
    npx expo export --platform all

CI runs dependency installation, typecheck, navigation/WhatsApp bridge tests and all-platform JavaScript export. These checks do not replace a physical-device test: verify WhatsApp → app return, code entry, persistent login, saved links, external destinations, Android Back, sign-out, network failure/retry and iOS safe areas before distribution. Do not use real customer links or send WhatsApp messages in automated tests.

Brand: black, #141414 panels, #FFBA2E accents, uppercase Anton headings. Anton's licence is in assets/fonts/Anton-OFL.txt.
