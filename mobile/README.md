# SOR7ED Mobile Prototype

Standalone Expo app for managing a personal saved-links library. It is intentionally local-only: links are stored on the device with AsyncStorage, and backup export/restore is handled by the app. It does not currently connect to Google sign-in, the SOR7ED API, or cloud sync.

## Run

Use Node.js 20 or newer and run these commands from this directory:

    npm install
    npm run start

Use `npm run android`, `npm run ios`, or `npm run web` to launch a platform target. Run `npm run typecheck` for TypeScript validation.

This folder is a standalone Expo package and is not part of the repository's existing npm workspaces.
