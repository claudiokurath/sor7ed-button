// Explicit return links only: never automatically redirect a completed save.
// Restrict the destination to the origin that initiated the widget flow.
export function widgetReturnUrl(raw: string | null, origin: string | null): string | null {
  if (!raw || !origin) return null;
  try {
    const target = new URL(raw);
    const source = new URL(origin);
    if (!["https:", "http:"].includes(target.protocol) || target.username || target.password) return null;
    if (source.origin !== origin || target.origin !== source.origin) return null;
    return target.href;
  } catch {
    return null;
  }
}
