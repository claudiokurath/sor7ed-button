export const ACCOUNT_URL = 'https://www.sor7ed.com/account';

/** Only trusted HTTPS pages may share the embedded account's cookie context. */
export function navigationTarget(raw: string): 'account' | 'external' | 'blocked' {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return 'blocked';
    if (['www.sor7ed.com', 'sor7ed.com', 'api.sor7ed.com'].includes(url.hostname)) return 'account';
    return 'external';
  } catch {
    return 'blocked';
  }
}

export function whatsappTarget(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'wa.me' && !url.port &&
      !url.username && !url.password && /^\/\d{7,15}\/?$/.test(url.pathname)
      ? url.href : null;
  } catch { return null; }
}

/** The web sign-in opens a blank child and then calls location.replace(wa.me).
 * Bridge only that handoff; tokens, cookies and account data stay in the web view.
 * The native receiver independently validates both the sender and destination.
 */
export const WHATSAPP_BRIDGE = `
(function () {
  if (!['https://www.sor7ed.com', 'https://sor7ed.com'].includes(location.origin)) return;
  if (window.__sor7edWhatsAppBridge) return;
  window.__sor7edWhatsAppBridge = true;
  var originalOpen = window.open;
  window.open = function (url, target, features) {
    if (url === 'about:blank' && target === '_blank') {
      return { opener: null, close: function () {}, location: { replace: function (destination) {
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'sor7ed:whatsapp', url: destination}));
      } } };
    }
    return originalOpen.call(window, url, target, features);
  };
})(); true;
`;
