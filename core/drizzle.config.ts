import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Neon migrations require a direct connection; runtime queries use pooling.
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"] ?? "postgres://sor7ed:sor7ed@localhost:5432/sor7ed",
  },
  verbose: true,
  strict: true,
});
