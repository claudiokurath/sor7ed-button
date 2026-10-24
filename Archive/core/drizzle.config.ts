import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgres://sor7ed:sor7ed@localhost:5432/sor7ed",
  },
  verbose: true,
  strict: true,
});
