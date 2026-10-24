import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertRequiredEnv } from "./env.js";

const workerEnvironment = {
  DATABASE_URL: "postgres://audit-placeholder",
  REDIS_URL: "redis://audit-placeholder",
  BASE_URL: "https://sor7ed.com",
  API_BASE_URL: "https://api.sor7ed.com",
  META_WHATSAPP_TOKEN: "audit-placeholder",
  META_WHATSAPP_PHONE_ID: "audit-placeholder",
  R2_BUCKET: "audit-placeholder",
  R2_ACCOUNT_ID: "audit-placeholder",
  R2_ACCESS_KEY_ID: "audit-placeholder",
  R2_SECRET_ACCESS_KEY: "audit-placeholder",
  R2_PUBLIC_URL: "https://uploads.example",
};
const apiEnvironment = {
  JWT_SECRET: "audit-placeholder",
  META_WEBHOOK_VERIFY_TOKEN: "audit-placeholder",
  META_APP_SECRET: "audit-placeholder",
  META_WHATSAPP_DISPLAY_NUMBER: "440000000000",
  GOOGLE_CLIENT_ID: "audit-placeholder",
  GOOGLE_CLIENT_SECRET: "audit-placeholder",
  WEB_ORIGIN: "https://sor7ed.com",
};

describe("required environment by process role", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    for (const [key, value] of Object.entries(workerEnvironment)) vi.stubEnv(key, value);
    for (const key of Object.keys(apiEnvironment)) vi.stubEnv(key, undefined);
  });

  afterEach(() => { vi.unstubAllEnvs(); });

  it("boots the production worker without API authentication or webhook credentials", () => {
    expect(() => assertRequiredEnv("worker")).not.toThrow();
  });

  it("keeps API authentication and webhook credentials required", () => {
    expect(() => assertRequiredEnv("api")).toThrow(
      `Missing required environment variables: ${Object.keys(apiEnvironment).join(", ")}`
    );
    for (const [key, value] of Object.entries(apiEnvironment)) vi.stubEnv(key, value);
    expect(() => assertRequiredEnv("api")).not.toThrow();
  });

  it.each(["DATABASE_URL", "REDIS_URL", "META_WHATSAPP_TOKEN", "META_WHATSAPP_PHONE_ID", "R2_BUCKET", "R2_PUBLIC_URL"])(
    "fails worker startup when %s is missing",
    (key) => {
      vi.stubEnv(key, undefined);
      expect(() => assertRequiredEnv("worker")).toThrow(`Missing required environment variables: ${key}`);
    }
  );

  it("permits local worker development without production integrations", () => {
    vi.stubEnv("NODE_ENV", "development");
    for (const key of Object.keys(workerEnvironment)) {
      if (key.startsWith("META_") || key.startsWith("R2_")) vi.stubEnv(key, undefined);
    }
    expect(() => assertRequiredEnv("worker")).not.toThrow();
    expect(() => assertRequiredEnv("api")).toThrow("JWT_SECRET");
  });

  it("lean API requires real auth/provider credentials but not Redis or R2", () => {
    vi.stubEnv("BUTTON_MODE", "lean");
    vi.stubEnv("REDIS_URL", undefined);
    for (const key of Object.keys(workerEnvironment)) if (key.startsWith("R2_")) vi.stubEnv(key, undefined);
    expect(() => assertRequiredEnv("api")).toThrow("GOOGLE_CLIENT_ID");
    for (const [key, value] of Object.entries(apiEnvironment)) vi.stubEnv(key, value);
    expect(() => assertRequiredEnv("api")).not.toThrow();
    expect(() => assertRequiredEnv("worker")).toThrow("does not run a background worker");
  });
});
