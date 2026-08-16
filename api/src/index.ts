import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import { Redis } from "ioredis";
import authPlugin from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { webhookRoutes } from "./routes/webhook.js";
import { connectRoutes } from "./routes/connect.js";
import { saveRoutes } from "./routes/saves.js";
import { itemLookupRoutes } from "./routes/item-lookup.js";
import { partnerRoutes } from "./routes/partner.js";
import { UPLOAD_DIR, assertRequiredEnv } from "@sor7ed/core";

assertRequiredEnv("api");

declare module "fastify" {
  interface FastifyRequest {
    rawBody: Buffer | undefined;
  }
}

const app = Fastify({
  logger: {
    level: process.env["NODE_ENV"] === "production" ? "info" : "debug",
    // Fastify's automatic request/response logging includes the full
    // Cookie header (i.e. every session token) and request bodies by
    // default. This closes that leak; it does NOT cover hand-written
    // app.log.* calls elsewhere that pass PII directly — those need
    // fixing at the call site (see webhook.ts).
    redact: {
      paths: ["req.headers.cookie", "req.headers.authorization", "req.body.whatsappNumber", "req.body.phoneNumber"],
      censor: "[REDACTED]",
    },
  },
});

// Captures the raw request body before JSON parsing, so webhook.ts can
// verify Meta's X-Hub-Signature-256 header against the exact bytes Meta
// sent — re-serializing the parsed JSON object can differ from Meta's
// original bytes, which would break the HMAC comparison.
app.decorateRequest("rawBody", undefined);
app.addContentTypeParser<Buffer>("application/json", { parseAs: "buffer" }, (req, body, done) => {
  try {
    req.rawBody = body;
    done(null, JSON.parse(body.toString()));
  } catch (err) {
    done(err as Error, undefined);
  }
});

// Must be registered before any route using requireAuth or reading/setting cookies.
await app.register(authPlugin);

await app.register(cors, {
  origin: [process.env["WEB_ORIGIN"] ?? "http://localhost:3000"],
  methods: ["GET", "POST"],
  credentials: true,
});

await app.register(rateLimit, {
  global: false, // opt-in per route — the webhook endpoint should NOT be limited the same way
  redis: new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379"),
  // @fastify/rate-limit throws whatever this returns and reads a
  // .statusCode property off it to set the response status — its own
  // default implementation returns an Error with statusCode explicitly
  // set to context.statusCode (429, or 403 if banned). A plain object
  // with no .statusCode falls through to Fastify's generic 500 handler;
  // confirmed by reading the plugin's source after seeing exactly that
  // 500 show up in a live test.
  errorResponseBuilder: (_req, context) =>
    Object.assign(new Error("Too many requests"), {
      statusCode: context.statusCode,
      retryAfter: context.after,
    }),
});

// UPLOAD_DIR comes from @sor7ed/core rather than process.cwd() here — it's
// anchored to the repo root, matching the same path enrichSavedItem writes
// to in the worker process (see core/src/storage.ts).
await app.register(fastifyStatic, { root: UPLOAD_DIR, prefix: "/uploads/" });

app.get("/health", async () => ({ status: "ok" }));
await app.register(authRoutes);
await app.register(webhookRoutes);
await app.register(connectRoutes);
await app.register(saveRoutes);
await app.register(itemLookupRoutes);
await app.register(partnerRoutes);

const port = Number(process.env["PORT"] ?? 3001);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
