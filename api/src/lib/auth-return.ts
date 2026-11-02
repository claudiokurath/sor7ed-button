/** Use one allowlist before OAuth and after reading its browser cookie. */
export function safeAuthReturn(
  raw: string | undefined,
  origin: string,
): string {
  const base = new URL(origin);
  try {
    const url = new URL(raw || "/account", base);
    const allowed =
      [
        "/account",
        "/save",
        "/save/extension",
        "/dashboard",
        "/dashboard/setup",
      ].includes(url.pathname) ||
      /^\/dashboard\/invite\/[a-f0-9]{16}$/.test(url.pathname);
    if (url.origin === base.origin && !url.username && !url.password && allowed)
      return url.pathname + url.search;
  } catch {
    /* Safe account fallback. */
  }
  return "/account";
}
