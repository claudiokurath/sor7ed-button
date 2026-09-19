// Raw HTTP layer over Meta's Cloud API. No business logic lives here —
// session-window compliance and message formatting live in service.ts.
// Meta expects the "to" field as E.164 without a leading "+" (e.g.
// "447700900123", not "+447700900123") — this is a common gotcha.

const META_API_VERSION = "v21.0"; // check Meta's changelog periodically; this drifts over time

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
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

  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as MetaSendResponse;

  if (!res.ok) {
    // Meta returns a structured error body even on failure. Surfacing it
    // (rather than a generic fetch error) matters here specifically: error
    // 131047 means "more than 24 hours since the customer's last message" —
    // the exact condition sendSaveCard's session check exists to avoid.
    // Check Meta's own error-code reference for the full, current list
    // rather than treating any fixed set as exhaustive.
    throw Object.assign(new Error(`Meta API error (${res.status})`), {
      status: res.status,
      metaResponse: json,
    });
  }

  return json;
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
