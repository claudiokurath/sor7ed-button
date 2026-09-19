// Every outbound send should go through this file, not client.ts directly —
// this is what enforces the 24h session-window rule in exactly one place.
import { sendText, sendTemplate, type TemplateComponent } from "./client.js";
import { isWhatsAppSessionOpen, isWhatsAppOptedOut } from "../queries.js";

// Deliberately narrower than the shared SavedItem DTO (@sor7ed/types),
// which models the JSON-over-the-wire shape consumed by the web app
// (createdAt/reminderAt as string). sendSaveCard is called with a raw
// Drizzle row instead, where those same columns come back as Date — a
// type this function never touches, so it isn't coupled to either shape.
interface SaveCardItem {
  shortId: string;
  title: string;
  aiSummary: string | null;
  cachedImageUrl: string | null;
}

const SAVE_CARD_TEMPLATE = "sor7ed_saved_card";
const LANGUAGE_CODE = "en_GB";

function requireBaseUrl(): string {
  const url = process.env["BASE_URL"];
  if (!url) throw new Error("BASE_URL is not set");
  return url;
}

function requireDisplayNumber(): string {
  const number = process.env["META_WHATSAPP_DISPLAY_NUMBER"];
  if (!number) throw new Error("META_WHATSAPP_DISPLAY_NUMBER is not set");
  return number;
}

// The approved template's header is a fixed IMAGE type, so a call that
// omits the image parameter will be rejected regardless of whether the
// saved item happens to have a preview image. Always supply a fallback
// rather than conditionally sending an empty header — that fallback image
// needs to exist as a static asset at /og-fallback.png before go-live.
function resolveHeaderImage(item: SaveCardItem): string {
  return item.cachedImageUrl ?? `${requireBaseUrl()}/og-fallback.png`;
}

// Returns the WhatsApp message id the card was sent as (undefined if
// skipped due to opt-out, or if Meta's response didn't include one) — the
// caller (api/src/routes/saves.ts) persists this on the saved_items row so
// a later quote-reply to this exact message (e.g. REMIND) can be resolved
// back to the item it's about, instead of guessing "whichever was saved
// most recently." See webhook.ts's REMIND handler.
export async function sendSaveCard(
  userId: string,
  userPhone: string,
  item: SaveCardItem,
  partnerName: string
): Promise<string | undefined> {
  // Checked first and unconditionally — an opted-out user gets nothing
  // sent regardless of session-window state, which only affects *how*
  // a message would be sent, not *whether* one should be.
  if (await isWhatsAppOptedOut(userId)) return undefined;

  const sessionOpen = await isWhatsAppSessionOpen(userId);

  if (sessionOpen) {
    const summary = item.aiSummary ? `\n${item.aiSummary}\n` : "";
    const text = `Saved from ${partnerName} ✓\n\n*${item.title}*${summary}\n${requireBaseUrl()}/s/${item.shortId}\n\n_Reply REMIND tomorrow (or REMIND friday 10am) to get nudged about this later._`;
    return sendText(userPhone, text);
  }

  const components: TemplateComponent[] = [
    { type: "header", parameters: [{ type: "image", image: { link: resolveHeaderImage(item) } }] },
    { type: "body", parameters: [{ type: "text", text: partnerName }, { type: "text", text: item.title }] },
    // The suffix here must exactly match the static base URL configured
    // for this template's URL button in Meta Business Manager. This code
    // assumes the template's base URL is "https://sor7ed.com/" and the
    // dynamic suffix is "s/<shortId>" — whichever convention you pick,
    // it must match what's registered with Meta, not just what's in code.
    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: `s/${item.shortId}` }] },
  ];

  return sendTemplate(userPhone, SAVE_CARD_TEMPLATE, LANGUAGE_CODE, components);
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
export async function sendReminder(userId: string, userPhone: string, item: { title: string; shortId: string }): Promise<void> {
  if (await isWhatsAppOptedOut(userId)) return;

  const base = requireBaseUrl();
  const components: TemplateComponent[] = [
    {
      type: "body",
      parameters: [
        { type: "text", text: item.title },
        { type: "text", text: `${base}/s/${item.shortId}` },
      ],
    },
  ];
  await sendTemplate(userPhone, REMINDER_TEMPLATE, LANGUAGE_CODE, components);
}

export function generateClickToChatUrl(token: string): string {
  const number = requireDisplayNumber();
  return `https://wa.me/${number}?text=${encodeURIComponent(`CONNECT-${token}`)}`;
}
