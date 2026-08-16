/** Fail fast on missing required env vars. Call once at process boot. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const REQUIRED_ALWAYS = ["DATABASE_URL", "REDIS_URL", "JWT_SECRET", "BASE_URL", "API_BASE_URL"] as const;

const REQUIRED_PRODUCTION = [
  "META_WHATSAPP_TOKEN",
  "META_WHATSAPP_PHONE_ID",
  "META_WEBHOOK_VERIFY_TOKEN",
  "META_APP_SECRET",
  "META_WHATSAPP_DISPLAY_NUMBER",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "WEB_ORIGIN",
] as const;

export function assertRequiredEnv(role: "api" | "worker" = "api"): void {
  const missing: string[] = [];
  for (const key of REQUIRED_ALWAYS) {
    if (!process.env[key]) missing.push(key);
  }
  if (process.env["NODE_ENV"] === "production") {
    for (const key of REQUIRED_PRODUCTION) {
      if (!process.env[key]) missing.push(key);
    }
  }
  // Worker does not need Google OAuth, but does need Meta for reminders.
  if (role === "worker" && process.env["NODE_ENV"] === "production") {
    for (const key of ["META_WHATSAPP_TOKEN", "META_WHATSAPP_PHONE_ID"] as const) {
      if (!process.env[key] && !missing.includes(key)) missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
