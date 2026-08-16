import type { FastifyInstance } from "fastify";
import oauthPlugin from "@fastify/oauth2";
import { eq } from "drizzle-orm";
import { db, users } from "@sor7ed/core";

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

export async function authRoutes(app: FastifyInstance) {
  await app.register(oauthPlugin, {
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
  app.get<{ Querystring: { returnTo?: string } }>("/api/auth/login", async (req, reply) => {
    if (req.query.returnTo) {
      reply.setCookie("returnTo", req.query.returnTo, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 600,
      });
    }
    return reply.redirect("/api/auth/google");
  });

  app.get("/api/auth/google/callback", async (req, reply) => {
    const { token } = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileRes.ok) return reply.code(502).send({ error: "Failed to fetch Google profile" });
    const profile = (await profileRes.json()) as { id: string; email: string };

    // Single atomic statement — avoids a select-then-write race under
    // concurrent first-time sign-ins with the same email.
    const [user] = await db
      .insert(users)
      .values({ email: profile.email, googleId: profile.id })
      .onConflictDoUpdate({ target: users.email, set: { googleId: profile.id } })
      .returning({ id: users.id });
    if (!user) return reply.code(500).send({ error: "Failed to upsert user" });

    const sessionToken = await reply.jwtSign({ sub: user.id });
    reply.setCookie("sor7ed_session", sessionToken, {
      path: "/",
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    const returnTo = req.cookies["returnTo"] ?? process.env["WEB_ORIGIN"] ?? "http://localhost:3000";
    reply.clearCookie("returnTo", { path: "/" });
    return reply.redirect(returnTo);
  });

  app.get("/api/auth/me", { preHandler: app.requireAuth }, async (req, reply) => {
    const [user] = await db
      .select({ id: users.id, email: users.email, whatsappVerified: users.whatsappVerified })
      .from(users)
      .where(eq(users.id, req.userId!))
      .limit(1);
    if (!user) return reply.code(401).send({ error: "User not found" });
    return reply.send(user);
  });

  app.post("/api/auth/signout", async (_req, reply) => {
    reply.clearCookie("sor7ed_session", { path: "/" });
    return reply.send({ ok: true });
  });
}
