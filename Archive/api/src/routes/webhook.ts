import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { eq, desc } from "drizzle-orm";
import {
  db,
  users,
  savedItems,
  updateLastInbound,
  verifyConnectionRequest,
  getRecentSaves,
  searchSavedItems,
  sendText,
  setWhatsAppOptOut,
  resolveItemFromQuotedMessage,
} from "@sor7ed/core";

interface InboundMessage {
  from: string;
  type: string;
  text?: { body: string };
  // Present when the inbound message is a WhatsApp "swipe to reply" quote
  // of an earlier message — context.id is that earlier message's own
  // wamid. This is what lets REMIND resolve to the exact card being
  // replied to, rather than assuming "whichever was saved most recently."
  context?: { id?: string };
}

interface WebhookPayload {
  object: string;
  entry?: Array<{ changes?: Array<{ value?: { messages?: InboundMessage[] } }> }>;
}

function parseReminderOffset(input: string): Date | null {
  const now = new Date();

  if (input === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  if (input === "this weekend" || input === "weekend") {
    const d = new Date(now);
    const daysUntilSat = (6 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSat);
    d.setHours(10, 0, 0, 0);
    return d;
  }

  const hoursMatch = input.match(/^(\d+)\s*hours?$/);
  if (hoursMatch) return new Date(now.getTime() + parseInt(hoursMatch[1]!) * 60 * 60 * 1000);

  const daysMatch = input.match(/^(\d+)\s*days?$/);
  if (daysMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() + parseInt(daysMatch[1]!));
    d.setHours(9, 0, 0, 0);
    return d;
  }

  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < dayNames.length; i++) {
    if (input.startsWith(dayNames[i]!)) {
      const target = new Date(now);
      const diff = (i - now.getDay() + 7) % 7 || 7;
      target.setDate(target.getDate() + diff);
      const timeMatch = input.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]!);
        const minute = parseInt(timeMatch[2] ?? "0");
        if (timeMatch[3] === "pm" && hour < 12) hour += 12;
        if (timeMatch[3] === "am" && hour === 12) hour = 0;
        target.setHours(hour, minute, 0, 0);
      } else {
        target.setHours(9, 0, 0, 0);
      }
      return target;
    }
  }
  return null;
}

// Confirms a payload genuinely came from Meta rather than an arbitrary
// caller who's discovered this endpoint's public URL — nothing enforced
// this locally since nothing else could reach localhost:3001, but once
// this has a real public URL, anyone could otherwise POST a forged
// "inbound message" (e.g. guessing at a CONNECT-<token> value).
function verifyMetaSignature(rawBody: Buffer | undefined, signatureHeader: string | undefined): boolean {
  const appSecret = process.env["META_APP_SECRET"];
  if (!appSecret || !signatureHeader || !rawBody) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signatureHeader);
  // timingSafeEqual requires equal-length buffers — a length mismatch
  // means it's already not a match, so short-circuit before comparing.
  return expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export async function webhookRoutes(app: FastifyInstance) {
  // Meta sends application/json — Fastify parses this by default,
  // no extra body-parser plugin is needed (that's only for
  // application/x-www-form-urlencoded, which this isn't).
  app.get("/webhook/whatsapp", async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (mode === "subscribe" && token === process.env["META_WEBHOOK_VERIFY_TOKEN"]) {
      return reply.code(200).send(challenge);
    }
    return reply.code(403).send("Forbidden");
  });

  app.post("/webhook/whatsapp", async (req, reply) => {
    if (!verifyMetaSignature(req.rawBody, req.headers["x-hub-signature-256"] as string | undefined)) {
      return reply.code(401).send("Invalid signature");
    }

    // Acknowledge within seconds regardless of internal outcome — Meta
    // retries aggressively on anything else, causing duplicate processing.
    reply.code(200).send("OK");

    const body = req.body as WebhookPayload;
    if (body.object !== "whatsapp_business_account") return;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const message of change.value?.messages ?? []) {
          try {
            await handleInboundMessage(app, message);
          } catch (err) {
            // Expected right now: sendText will throw because no real
            // META_WHATSAPP_TOKEN exists yet. The DB writes above this
            // (updateLastInbound, verifyConnectionRequest) still succeed —
            // this is exactly the "fails gracefully" state to test for.
            app.log.error({ err }, "Failed to process inbound WhatsApp message");
          }
        }
      }
    }
  });
}

async function handleInboundMessage(app: FastifyInstance, message: InboundMessage): Promise<void> {
  if (message.type !== "text" || !message.text) return;

  const from = message.from;
  const command = message.text.body.trim().toUpperCase();

  // Keeps the 24h session window alive for every subsequent send.
  await updateLastInbound(from);

  if (command.startsWith("CONNECT-")) {
    const token = command.slice("CONNECT-".length);
    const userId = await verifyConnectionRequest(token, from);
    if (userId) {
      await sendText(
        from,
        "✓ WhatsApp connected. Go back to the page you were saving and try again — it'll land right here from now on."
      );
    } else {
      await sendText(from, "That connection link has expired or was already used — go back to SOR7ED and tap 'Connect WhatsApp' again.");
    }
    return;
  }

  // Required by Meta's WhatsApp Business Platform policy: opt-outs must
  // be honored. This only stops *business-initiated* sends (sendSaveCard,
  // sendReminder — both check isWhatsAppOptedOut before dispatching); it
  // deliberately does NOT stop replying here, since this reply is itself
  // user-initiated (a direct response to the command that triggered it),
  // not a proactive message.
  if (command === "STOP" || command === "UNSUBSCRIBE" || command === "OPT OUT" || command === "OPTOUT") {
    await setWhatsAppOptOut(from, true);
    await sendText(from, "You're unsubscribed — you won't receive save cards or reminders. Reply START to turn them back on.");
    return;
  }

  if (command === "START" || command === "SUBSCRIBE") {
    await setWhatsAppOptOut(from, false);
    await sendText(from, "✓ You're resubscribed. Saves and reminders will land here again.");
    return;
  }

  if (command === "HELP") {
    await sendText(from, "Reply LIBRARY to see your last 5 saves, LIBRARY <word> to search them, or STOP to unsubscribe.");
    return;
  }

  if (command === "LIBRARY" || command.startsWith("LIBRARY ")) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.whatsappNumber, from)).limit(1);
    if (!user) {
      await sendText(from, "This number isn't connected to a SOR7ED account yet.");
      return;
    }

    const searchTerm = command.startsWith("LIBRARY ") ? command.slice("LIBRARY ".length).trim() : null;
    const results = searchTerm ? await searchSavedItems(user.id, searchTerm, 5) : await getRecentSaves(user.id, 5);

    if (results.length === 0) {
      await sendText(
        from,
        searchTerm
          ? `Nothing found for "${searchTerm}". Try a different word.`
          : "Nothing saved yet. Save something from a SOR7ED partner site and it'll show up here."
      );
      return;
    }

    const lines = results
      .map((s, i) => `${i + 1}. ${s.title}${s.aiSummary ? `\n_${s.aiSummary}_` : ""}\n${process.env["BASE_URL"]}/s/${s.shortId}`)
      .join("\n\n");
    await sendText(from, searchTerm ? `Results for "${searchTerm}":\n\n${lines}` : `Your recent saves:\n\n${lines}`);
    return;
  }

  if (command.startsWith("REMIND")) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.whatsappNumber, from)).limit(1);
    if (!user) {
      await sendText(from, "This number isn't connected to a SOR7ED account yet.");
      return;
    }

    const offset = command.slice("REMIND".length).trim().toLowerCase();
    const reminderAt = parseReminderOffset(offset);
    if (!reminderAt) {
      await sendText(from, "I didn't understand that. Try: REMIND tomorrow, REMIND 2 hours, or REMIND friday 10am");
      return;
    }

    // Prefer the item the user actually swipe-replied to (message.context.id
    // is the wamid of the message being quoted — set on outbound save cards
    // via setSavedItemMessageId). Scoped by userId so a guessed/observed
    // message id from another account can never be targeted. Falls back to
    // "most recently saved" for a plain REMIND with no quote context, which
    // preserves the original MVP behaviour.
    const quotedId = message.context?.id;
    const target = quotedId ? await resolveItemFromQuotedMessage(user.id, quotedId) : null;

    const recent =
      target ??
      (
        await db
          .select({ id: savedItems.id, title: savedItems.title })
          .from(savedItems)
          .where(eq(savedItems.userId, user.id))
          .orderBy(desc(savedItems.createdAt))
          .limit(1)
      )[0];

    if (!recent) {
      await sendText(from, "You don't have any saves yet.");
      return;
    }

    await db.update(savedItems).set({ reminderAt, reminderSent: false }).where(eq(savedItems.id, recent.id));

    const formatted = reminderAt.toLocaleString("en-GB", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    });
    await sendText(from, `✓ I'll remind you about "${recent.title}" on ${formatted}.`);
    return;
  }

  app.log.info({ hasFrom: Boolean(from) }, "Unrecognised inbound WhatsApp message");
}
