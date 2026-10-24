import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Postgres is provided by the linked project. Preserve the Button's existing
  // Google OAuth flow; do not provision Neon Auth or additional services.
  auth: false,
});
