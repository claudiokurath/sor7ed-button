# SOR7ED BUTTON — Roadmap

Prioritized next work. Lean mode is the current production path.

## Now (high value, low risk)

- **Widget observability & UX** — clearer delivery statuses, data-status attributes, better timeout/failed messaging, and live-region announcements (in progress on this branch).
- **Partner analytics gap** — extension direct-saves skip `/s/[shortId]` return-click tracking. Document the limitation and consider an optional lightweight open ping or short-link opt-in so ROI signals are not lost.
- **Lean-mode failure visibility** — structured logging (and simple alerting) for Meta webhook failures, ambiguous sends, and “unknown” delivery states. `waitUntil` is bounded; a dead-letter table or periodic reconciliation would help.
- **Extension store readiness** — finish Chrome Web Store listing, privacy-policy alignment, and the real-device verification checklist already noted in the docs.

## Next

- **Account completeness** — WhatsApp number migration / history merge. Changing number currently orphans history; this will become a support request once real users exist.
- **Widget isolation** — optional Shadow DOM (or stronger scoping) so host CSS cannot affect the button. Current scoped CSS is intentional but limited; make any change opt-in to avoid surprising existing partners.
- **Archive cleanup** — the large `Archive/` tree is historical. Move or remove it once lean mode is fully stable to simplify navigation.

## Later (full mode)

- Re-enable enrichment (AI summary/tags/embeddings + consistent 1200×630 cards), reminders, and R2 uploads when richer cards or scheduled messages are desired. The code paths exist; lean mode deliberately skips them.
- Observability dashboard or simple metrics endpoint for partner save volume, delivery success rate, and quota usage.

## Done recently

- Lean launch path (Vercel + Neon, no worker/Redis/R2).
- WhatsApp-proven consumer sign-in and extension capture flow.
- Click-tracking confirmation page (no silent redirects).
- Brand yellow unification and consistent save-card fallbacks.

See `LEAN_DEPLOY.md`, `docs/consumer-account-extension.md`, and `AGENTS.md` for implementation constraints.
