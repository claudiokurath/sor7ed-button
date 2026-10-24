export type Draft = {
  flowId: string;
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
  savedAt: number;
  idempotencyKey: string;
};
const MAX_AGE = 30 * 60_000;
export function captureDraft(
  storage: Storage,
  search: string,
  fragment: string,
): Draft | null {
  const flow = new URLSearchParams(search).get("flow");
  if (fragment) {
    const raw = JSON.parse(decodeURIComponent(fragment.replace(/^#/, "")));
    if (!/^[a-f0-9-]{36}$/.test(raw.flowId))
      throw Error("This capture link is invalid.");
    const u = new URL(raw.url);
    if (
      !["https:", "http:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      raw.url.length > 2000
    )
      throw Error("Only public web pages can be saved.");
    const existing = storage.getItem(`sor7ed:draft:${raw.flowId}`);
    if (existing) {
      const old = JSON.parse(existing);
      if (old.url !== raw.url)
        throw Error("This capture belongs to a different page.");
      if (Date.now() - old.savedAt <= MAX_AGE) return old;
    }
    const draft: Draft = {
      flowId: raw.flowId,
      url: raw.url,
      title: String(raw.title || u.hostname).slice(0, 500),
      savedAt: Date.now(),
      idempotencyKey: `extension_${raw.flowId}`,
      ...(raw.description
        ? { description: String(raw.description).slice(0, 2000) }
        : {}),
      ...(raw.imageUrl && /^https:\/\//.test(raw.imageUrl)
        ? { imageUrl: String(raw.imageUrl).slice(0, 2000) }
        : {}),
    };
    storage.setItem(`sor7ed:draft:${draft.flowId}`, JSON.stringify(draft));
    return draft;
  }
  if (!flow || !/^[a-f0-9-]{36}$/.test(flow)) return null;
  const value = storage.getItem(`sor7ed:draft:${flow}`);
  if (!value) return null;
  const draft = JSON.parse(value);
  if (Date.now() - draft.savedAt > MAX_AGE) {
    storage.removeItem(`sor7ed:draft:${flow}`);
    return null;
  }
  return draft;
}
