export interface SaveCardItem {
  source?: string;
  title: string;
  description: string | null;
  cachedImageUrl: string | null;
  url: string;
  partnerName: string;
}
export function destination(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}
export async function getSaveCard(
  shortId: string,
): Promise<SaveCardItem | null> {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(shortId)) return null;
  const base = process.env["API_INTERNAL_URL"] ?? "http://localhost:3001";
  const response = await fetch(
    `${base}/api/saves/${encodeURIComponent(shortId)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error("This saved link is temporarily unavailable.");
  const item = (await response.json()) as SaveCardItem;
  return destination(item.url) ? item : null;
}
