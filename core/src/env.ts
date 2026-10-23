import { isLeanMode } from "./mode.js";
/** Fail fast on missing required env vars. Call once at process boot. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const REQUIRED_ALWAYS = ["DATABASE_URL", "REDIS_URL", "BASE_URL", "API_BASE_URL"] as const;

const REQUIRED_PRODUCTION = [
  "META_WHATSAPP_TOKEN",
  "META_WHATSAPP_PHONE_ID",
  // Required in production because api and worker run as separate processes
  // (separate disks) — local-disk uploads would silently split-brain without
  // a shared object store. See core/src/storage.ts.
  "R2_BUCKET",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PUBLIC_URL",
] as const;

const REQUIRED_API_PRODUCTION = [
  "META_WEBHOOK_VERIFY_TOKEN",
  "META_APP_SECRET",
  "META_WHATSAPP_DISPLAY_NUMBER",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "WEB_ORIGIN",
] as const;

export function assertRequiredEnv(role: "api" | "worker" = "api"): void {
  const lean = isLeanMode();
  if (lean && role === "worker") throw new Error("Lean mode does not run a background worker");
  const required: string[] = REQUIRED_ALWAYS.filter(key => !lean || key !== "REDIS_URL");
  if (role === "api") required.push("JWT_SECRET");
  if (process.env["NODE_ENV"] === "production") {
    required.push(...REQUIRED_PRODUCTION.filter(key => !lean || !key.startsWith("R2_")));
    if (role === "api") required.push(...REQUIRED_API_PRODUCTION);
  }
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
