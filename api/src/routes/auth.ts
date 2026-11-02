import { safeAuthReturn } from "../lib/auth-return.js";
import type { FastifyInstance } from "fastify";
import oauthPlugin from "@fastify/oauth2";
import { eq } from "drizzle-orm";
import { db, users, isLeanMode, isWhatsAppSessionOpen } from "@sor7ed/core";

// @fastify/oauth2's own type augmentation only covers the auto-derived
// `oauth2<PascalName>` decorator key (via an index signature keyed on
// that literal pattern) — it does NOT type the raw `name` option we pass
// below, even though the plugin decorates the instance under both names
// at runtime. Without this, `app.googleOAuth2` compiles at runtime but
// fails typecheck. This is the documented workaround.
declare module "fastify" {
  interface FastifyInstance {
    googleOAuth2: oauthPlugin.OAuth2Namespace;
  }
}

// @fastify/oauth2 also ships a GOOGLE_CONFIGURATION constant with these
// same four values, but its .d.ts (a function/namespace merge under
// `export =`) doesn't expose it on the plain default-imported binding —
// only on an inner self-referential namespace member, which isn't worth
// chasing through a cast for four unlikely-to-change endpoint constants.
// Inlined directly from the package's own source instead.
const GOOGLE_OAUTH_CONFIG = {
  authorizeHost: "https://accounts.google.com",
  authorizePath: "/o/oauth2/v2/auth",
  tokenHost: "https://www.googleapis.com",
  tokenPath: "/oauth2/v4/token",
};

/** Shared cookie options. When web (Vercel) and api (Fly) sit on sibling
 *  subdomains (sor7ed.com + api.sor7ed.com), set COOKIE_DOMAIN=.sor7ed.com
 *  so the browser sends sor7ed_session on both hosts. Leave unset for
 *  localhost / same-origin proxy setups. */
export function cookieBase(maxAge: number) {
  const opts: {
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    maxAge: number;
    domain?: string;
  } = {
    path: "/",
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge,
  };
  const domain = process.env["COOKIE_DOMAIN"];
  if (domain) opts.domain = domain;
  return opts;
}

export async function authRoutes(app: FastifyInstance) {
  const googleEnabled = !!process.env["GOOGLE_CLIENT_ID"] && !!process.env["GOOGLE_CLIENT_SECRET"];
  if (googleEnabled) await app.register(oauthPlugin, {
    name: "googleOAuth2",
    credentials: {
      client: {
        id: process.env["GOOGLE_CLIENT_ID"]!,
        secret: process.env["GOOGLE_CLIENT_SECRET"]!,
      },
      auth: GOOGLE_OAUTH_CONFIG,
    },
    startRedirectPath: "/api/auth/google",
    callbackUri: `${process.env["API_BASE_URL"] ?? "http://localhost:3001"}/api/auth/google/callback`,
    scope: ["profile", "email"],
  });

  // Entry point the save page links to. Stashes the exact save-page URL
  // (query params and all — title, description, image, apiKey, url) in a
  // short-lived cookie, then hands off to the oauth2 plugin's own
  // auto-generated redirect route.
  app.get<{ Querystring: { returnTo?: string } }>(
    "/api/auth/login",
    {
      config: {
        rateLimit: {
          // No session yet at this point — keyed by IP, not userId.
          // Generous limit: this is a plain redirect, but it's also the
          // one unauthenticated entry point that writes a cookie and
          // kicks off an OAuth round-trip per call, so it still shouldn't
          // be hammered.
          max: 20,
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
      const origin = process.env["WEB_ORIGIN"] ?? "http://localhost:3000";
      const next = safeAuthReturn(req.query.returnTo, origin);
      if (!googleEnabled) return reply.redirect(`${origin}/signin?next=${encodeURIComponent(next)}`);
      reply.setCookie("returnTo", next, cookieBase(600));
      return reply.redirect("/api/auth/google");
    }
  );

  app.get("/api/auth/google/callback", async (req, reply) => {
    if (!googleEnabled) return reply.code(503).send({ error: "Google sign-in is not configured. Use WhatsApp sign-in." });
    const { token } = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileRes.ok) return reply.code(502).send({ error: "Failed to fetch Google profile" });
    const profile = (await profileRes.json()) as { id?: string; email?: string; verified_email?: boolean };
    if (profile.verified_email !== true || typeof profile.id !== "string" || typeof profile.email !== "string" || !profile.email.includes("@")) return reply.code(403).send({ error: "Please verify your email with Google before signing in." });

    // Single atomic statement — avoids a select-then-write race under
    // concurrent first-time sign-ins with the same email.
    const [user] = await db
      .insert(users)
      .values({ email: profile.email, googleId: profile.id })
      .onConflictDoUpdate({ target: users.email, set: { googleId: profile.id } })
      .returning({ id: users.id });
    if (!user) return reply.code(500).send({ error: "Failed to upsert user" });

    const sessionToken = await reply.jwtSign({ sub: user.id }, { expiresIn: "30d" });
    reply.setCookie("sor7ed_session", sessionToken, cookieBase(60 * 60 * 24 * 30));

    const origin = process.env["WEB_ORIGIN"] ?? "http://localhost:3000";
    const returnTo = new URL(safeAuthReturn(req.cookies["returnTo"], origin), origin).href;
    reply.clearCookie("returnTo", cookieBase(0));
    return reply.redirect(returnTo);
  });

  app.get("/api/auth/me", { preHandler: app.requireAuth }, async (req, reply) => {
    reply.header("Cache-Control", "private, no-store");
    const [user] = await db
      .select({ id: users.id, email: users.email, whatsappVerified: users.whatsappVerified })
      .from(users)
      .where(eq(users.id, req.userId!))
      .limit(1);
    if (!user) return reply.code(401).send({ error: "User not found" });
    return reply.send({ ...user, requiresActiveSession: isLeanMode(), whatsappSessionOpen: await isWhatsAppSessionOpen(user.id) });
  });

  app.post("/api/auth/signout", async (_req, reply) => {
    reply.clearCookie("sor7ed_session", cookieBase(0));
    return reply.send({ ok: true });
  });
}
