# Neon setup — 23 October 2026

Project: `solitary-frost-91086846`, organization `org-plain-unit-89902053`,
production branch, database `neondb`, London, Postgres 16. Neon Auth is disabled;
the app retains its existing Google OAuth implementation and `pg`/Drizzle pool.

## Completed

- Installed the Neon CLI and the project-local `neon` / `neon-postgres` skills.
- Linked the requested project offline and added the Postgres-only `neon.ts`
  policy and CLI-required packages. The local `.neon` link is ignored by Git.
- Stored the supplied pooled `DATABASE_URL` in owner-only, ignored `.env.local`
  and staged it securely on both Fly apps. No credentials are in source control.
- `DATABASE_URL_UNPOOLED` is used by Drizzle migrations when supplied, with
  `DATABASE_URL` retained as the fallback and the runtime connection setting.
- Tested all seven existing migrations through the normal Drizzle migrator on
  a disposable Postgres 16 + pgvector container.
- Verified that the remote database was empty, then applied the existing
  migration statements and Drizzle checksums in one Neon HTTPS transaction
  against the direct endpoint. TCP from this execution environment was refused;
  the HTTPS SQL endpoint authenticated successfully. No application driver was
  replaced to work around that environment restriction.
- Read-back confirmed seven migration records, eight application tables, and
  the vector extension. A synthetic create/read/update/delete check completed
  in one transaction; read-back confirmed zero users, partners and saved items.
- `npm run build` and workspace TypeScript checks pass. The web app starts and
  returns HTTP 200. This does not establish API/provider end-to-end operation.

## Remaining

`neon deploy` required separate Neon platform OAuth; that sign-in timed out.
The database password permits SQL access but not Neon management API access.
The offline project link must therefore not be described as CLI-verified or a
successful Neon configuration deployment.

The Fly runtime still needs Redis, Google OAuth, Meta WhatsApp and shared image
storage settings before the full production API and worker can run. No API DNS
switch or real WhatsApp delivery test has been performed. Rotate the database
password shared in chat before launch, then update both Fly secrets and local
environment files securely. Do not paste the replacement password into chat.

The production API startup check stopped at its first missing dependency:
`R2_BUCKET is not set. Local-disk uploads are dev-only`. This check was not
bypassed. The frontend HTTP check and SQL checks are separate evidence, not a
claim that the full browser → API → WhatsApp flow passed.
