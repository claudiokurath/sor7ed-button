// Every outbound send should go through this file, not client.ts directly —
// this is what enforces the 24h session-window rule in exactly one place.
import { sendLinkCard, sendTemplate, WhatsAppSendError, type TemplateComponent } from "./client.js";
import { isWhatsAppSessionOpen, isWhatsAppOptedOut } from "../queries.js";
import { savedCardImageUrl } from "./card-images.js";
import { isLeanMode } from "../mode.js";

// Deliberately narrower than the shared SavedItem DTO (@sor7ed/types),
// which models the JSON-over-the-wire shape consumed by the web app
// (createdAt/reminderAt as string). sendSaveCard is called with a raw
// Drizzle row instead, where those same columns come back as Date — a
// type this function never touches, so it isn't coupled to either shape.
interface SaveCardItem {
  shortId: string;
  url: string;
  title: string;
  aiSummary: string | null;
  cachedImageUrl: string | null;
}

const LANGUAGE_CODE = "en_GB";

function originalPageUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch {}
  throw new WhatsAppSendError("This saved page has an invalid address.", "failed");
}

function requireDisplayNumber(): string {
  const number = process.env["META_WHATSAPP_DISPLAY_NUMBER"];
  if (!number) throw new Error("META_WHATSAPP_DISPLAY_NUMBER is not set");
  return number;
}

export type SaveCardOutcome =
  | { status: 'accepted'; messageId: string; reason: null }
  | { status: 'skipped'; reason: 'opted_out' | 'session_closed' }
  | { status: 'unknown'; reason: 'unconfirmed' };

function acceptedOutcome(messageId: string | undefined): SaveCardOutcome {
  return typeof messageId === 'string' && messageId.length > 0
    ? { status: 'accepted', messageId, reason: null }
    : { status: 'unknown', reason: 'unconfirmed' };
}

// A successful provider response with a message ID means accepted, not
// delivered. Explicit opt-out and missing IDs must not look like success.
export async function sendSaveCard(
  userId: string,
  userPhone: string,
  item: SaveCardItem,
  _partnerName: string
): Promise<SaveCardOutcome> {
  // Checked first and unconditionally — an opted-out user gets nothing
  // sent regardless of session-window state, which only affects *how*
  // a message would be sent, not *whether* one should be.
  if (await isWhatsAppOptedOut(userId)) return { status: 'skipped', reason: 'opted_out' };

  const sessionOpen = await isWhatsAppSessionOpen(userId);

  if (!sessionOpen) return { status: 'skipped', reason: 'session_closed' };

  // Only the presentation changes. Open still goes directly to the source URL.
  const url = originalPageUrl(item.url);
  return acceptedOutcome(await sendLinkCard(userPhone, { title: item.title, url, imageUrl: savedCardImageUrl(item.shortId) }));
}

const REMINDER_TEMPLATE = "sor7ed_reminder";

// A scheduled reminder can never legitimately fire while a session is
// open — an open session means the user just messaged the bot, which is
// the opposite of the dormancy a reminder implies. Rather than have this
// function duplicate sendSaveCard's session-check branching for a
// condition that will always resolve the same way, it's named for exactly
// what it does: always sends the approved template, no branching.
//
// userId is required (not just userPhone) specifically for the opt-out
// check below — a reminder is scheduled well before send time, so the
// user may have opted out in the interim; this is the only place that's
// actually re-checked before the message goes out.
export async function sendReminder(userId: string, userPhone: string, item: { title: string; shortId: string; url: string }): Promise<void> {
  if (isLeanMode()) return;
  if (await isWhatsAppOptedOut(userId)) return;

  const components: TemplateComponent[] = [
    {
      type: "body",
      parameters: [
        { type: "text", text: item.title },
        { type: "text", text: originalPageUrl(item.url) },
      ],
    },
  ];
  await sendTemplate(userPhone, REMINDER_TEMPLATE, LANGUAGE_CODE, components);
}

export function generateClickToChatUrl(token: string): string {
  const number = requireDisplayNumber();
  return `https://wa.me/${number}?text=${encodeURIComponent(`${process.env['WHATSAPP_TRANSPORT'] === 'relay' ? 'BUTTON-CONNECT-' : 'CONNECT-'}${token}`)}`;
}
