// Raw HTTP layer over Meta's Cloud API. No business logic lives here —
// session-window compliance and message formatting live in service.ts.
// Meta expects the "to" field as E.164 without a leading "+" (e.g.
// "447700900123", not "+447700900123") — this is a common gotcha.

const META_API_VERSION = "v21.0"; // check Meta's changelog periodically; this drifts over time

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    public readonly outcome: 'failed' | 'unknown',
    public readonly status?: number
  ) {
    super(message);
    this.name = 'WhatsAppSendError';
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new WhatsAppSendError('WhatsApp sending is not configured.', 'failed');
  return value;
}

// Meta's send response shape: { messages: [{ id: "wamid...." }], ... }.
// Extracted defensively (optional chaining all the way through) rather
// than asserted, since this is a third-party API response — a shape
// change there should degrade to "no message id captured", not throw.
interface MetaSendResponse {
  messages?: Array<{ id?: string }>;
}

async function callMetaApi(body: unknown): Promise<MetaSendResponse> {
  const phoneId = requireEnv("META_WHATSAPP_PHONE_ID");
  const token = requireEnv("META_WHATSAPP_TOKEN");

  let res: Response;
  try {
    res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // A timeout can happen after Meta accepted a request. Do not silently
    // retry or tell the caller it definitely failed to reach WhatsApp.
    throw new WhatsAppSendError('WhatsApp sending could not be confirmed.', 'unknown');
  }

  if (!res.ok) {
    // Keep provider details out of user-facing responses. A definite
    // rejection differs from a timeout/server failure with uncertain outcome.
    throw new WhatsAppSendError(
      'WhatsApp did not confirm the message.',
      res.status >= 500 || res.status === 408 ? 'unknown' : 'failed',
      res.status
    );
  }

  try {
    return (await res.json()) as MetaSendResponse;
  } catch {
    throw new WhatsAppSendError('WhatsApp sending could not be confirmed.', 'unknown');
  }
}

// Returns Meta's message id for the sent message (undefined if the
// response shape didn't include one) — callers that need to correlate a
// later quote-reply back to this specific message (see
// whatsapp/service.ts's sendSaveCard) persist this against the row it
// concerns.
export async function sendText(to: string, body: string): Promise<string | undefined> {
  const res = await callMetaApi({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body, preview_url: true },
  });
  return res.messages?.[0]?.id;
}

export type TemplateComponent =
  | { type: "header"; parameters: [{ type: "image"; image: { link: string } }] }
  | { type: "body"; parameters: Array<{ type: "text"; text: string }> }
  | { type: "button"; sub_type: "url"; index: "0"; parameters: [{ type: "text"; text: string }] };

export async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  components: TemplateComponent[]
): Promise<string | undefined> {
  const res = await callMetaApi({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name: templateName, language: { code: languageCode }, components },
  });
  return res.messages?.[0]?.id;
}
