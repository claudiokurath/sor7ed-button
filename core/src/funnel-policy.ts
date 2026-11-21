import { createHash } from "node:crypto";
export const FUNNEL_EVENTS = [
  "widget_impression",
  "button_press",
  "popup_opened",
  "popup_blocked_fallback",
  "google_started",
  "google_completed",
  "google_failed",
  "whatsapp_connect_started",
  "whatsapp_connect_completed",
  "whatsapp_connect_failed",
  "save_requested",
  "save_accepted",
  "save_pending",
  "save_failed",
  "save_timeout",
  "nudge_sent",
  "nudge_opened",
] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];
export const BROWSER_FUNNEL_EVENTS = [
  "widget_impression",
  "button_press",
  "popup_opened",
  "popup_blocked_fallback",
  "save_timeout",
] as const;
export function partnerKeyHash(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 500
    ? createHash("sha256").update(value).digest("hex")
    : null;
}
export function funnelPageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 8000) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? (url.origin + url.pathname).slice(0, 2000)
      : null;
  } catch {
    return null;
  }
}
/** Correlation only: legacy/fallback flow IDs become deterministic UUIDs. */
export function funnelFlowId(value: unknown): string | null {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
    return null;
  if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value))
    return value.toLowerCase();
  const h = createHash("sha256").update(value).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function funnelMeta(value: unknown): Record<string, string | number> {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const output: Record<string, string | number> = {};
  if (
    ["browser", "server", "widget", "popup", "extension", "nudge"].includes(
      typeof input["source"] === "string" ? (input["source"] as string) : "",
    )
  )
    output["source"] = String(input["source"]);
  if (
    ["popup", "same_tab", "blocked"].includes(
      typeof input["navigation"] === "string"
        ? (input["navigation"] as string)
        : "",
    )
  )
    output["navigation"] = String(input["navigation"]);
  if (
    ["accepted", "pending", "failed", "skipped", "unknown"].includes(
      typeof input["status"] === "string" ? (input["status"] as string) : "",
    )
  )
    output["status"] = String(input["status"]);
  if (
    [
      "http_error",
      "unconfirmed",
      "opted_out",
      "session_closed",
      "not_connected",
      "not_configured",
      "timeout",
      "invalid_request",
    ].includes(
      typeof input["reason"] === "string" ? (input["reason"] as string) : "",
    )
  )
    output["reason"] = String(input["reason"]);
  if (
    typeof input["http_status"] === "number" &&
    Number.isInteger(input["http_status"]) &&
    input["http_status"] >= 100 &&
    input["http_status"] <= 599
  )
    output["http_status"] = input["http_status"];
  const page = funnelFlowId(input["page_load_id"]);
  if (page) output["page_load_id"] = page;
  return output;
}
