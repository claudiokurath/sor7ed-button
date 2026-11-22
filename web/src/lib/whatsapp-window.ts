type WindowHost = {
  open: (url: string, target: string, features: string) => {
    opener: unknown;
    location: { replace: (url: string) => void };
    close: () => void;
  } | null;
};

/**
 * Accept only https://wa.me/<number> links. Shared by the popup, the phone
 * button and the desktop QR so none of them can point anywhere else.
 */
export function parseWhatsAppUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.hostname !== 'wa.me' || url.port || url.username || url.password || !/^\/\d{7,15}\/?$/.test(url.pathname)) {
    throw new Error('This WhatsApp link is invalid. Start sign-in again.');
  }
  return url;
}

/** Open synchronously from the click, keeping the code/draft in its own tab. */
export function openWhatsAppWindow(host: WindowHost, raw: string): boolean {
  const url = parseWhatsAppUrl(raw);
  const child = host.open('about:blank', '_blank', 'popup=yes,width=760,height=800,resizable=yes,scrollbars=yes');
  if (!child) return false;
  try {
    // The blank child is same-origin until navigation, so sever opener before
    // loading WhatsApp. No browser proof or account state enters this window.
    child.opener = null;
    child.location.replace(url.href);
    return true;
  } catch {
    child.close();
    throw new Error('Could not open WhatsApp. Please try again.');
  }
}
