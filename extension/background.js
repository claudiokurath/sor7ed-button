// Production destination is fixed; there is no externally_connectable handler,
// injection on every page, all-sites host permission or session token.
const SAVE_ORIGIN = "https://www.sor7ed.com";
const saveWindows = new Map();
chrome.tabs.onUpdated.addListener((tabId, change) => {
  const save = saveWindows.get(tabId);
  if (!save || !change.url) return;
  try {
    const url = new URL(change.url);
    if (url.origin !== SAVE_ORIGIN || url.pathname !== '/save/extension' ||
        url.searchParams.get('flow') !== save.flowId || url.searchParams.get('delivery') !== 'accepted') return;
    saveWindows.delete(tabId);
    void chrome.windows.remove(save.windowId).catch(() => {});
  } catch { /* Ignore unrelated navigation. */ }
});
chrome.tabs.onRemoved.addListener(tabId => saveWindows.delete(tabId));
function allowed(raw) {
  try {
    const u = new URL(raw);
    return (
      ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
    );
  } catch {
    return false;
  }
}
export function capturePage() {
  const meta = (name) =>
    document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)
      ?.content;
  let image = meta("og:image");
  try {
    image = image ? new URL(image, location.href).href : undefined;
  } catch {
    image = undefined;
  }
  return {
    url: location.href,
    title: (meta("og:title") || document.title || location.hostname).slice(
      0,
      500,
    ),
    description: (meta("og:description") || meta("description") || "").slice(
      0,
      2000,
    ),
    imageUrl: image?.startsWith("https://") ? image : undefined,
  };
}
// Runs only inside the SOR7ED tab we just opened, using the narrow host grant.
// A website can forge a capture URL, but cannot write this first-party approval.
export function approveCapture(flowId, pageUrl, origin) {
  if (location.origin !== origin || location.pathname !== '/save/extension') return false;
  sessionStorage.setItem(`sor7ed:approved:${flowId}`, JSON.stringify({ url: pageUrl, expiresAt: Date.now() + 30 * 60_000 }));
  window.dispatchEvent(new Event('sor7ed:extension-save'));
  return true;
}
export async function saveTab(tab, linkUrl) {
  if (!allowed(linkUrl || tab.url))
    throw Error("Open a normal web page to save it.");
  let page = {
    url: linkUrl || tab.url,
    title: linkUrl ? new URL(linkUrl).hostname : tab.title || tab.url,
  };
  if (!linkUrl && tab.id) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: capturePage,
      });
      if (result?.result) page = result.result;
    } catch {
      /* Pages that block capture can still save their address. */
    }
  }
  const flowId = crypto.randomUUID();
  // A page capture never enters the query string or a server-side redirect.
  const url = `${SAVE_ORIGIN}/save/extension#${encodeURIComponent(JSON.stringify({ ...page, flowId }))}`;
  const popup = await chrome.windows.create({ url, type: "popup", width: 420, height: 560 });
  const targetId = popup?.tabs?.[0]?.id;
  if (!targetId) return;
  saveWindows.set(targetId, { flowId, windowId: popup.id });
  // The tab may still be navigating. Never inject into the source website or
  // authorize a capture based on a query/hash flag supplied by an arbitrary page.
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: targetId }, func: approveCapture, args: [flowId, page.url, SAVE_ORIGIN],
      });
      if (result?.result === true) return;
    } catch { /* Wait for our first-party save tab to become available. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sorted-save",
    title: "Save with SOR7ED",
    contexts: ["page", "link"],
  });
});
chrome.action.onClicked.addListener((tab) => {
  void saveTab(tab).catch(() => {
    void chrome.action.setBadgeText({ text: "!" });
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "sorted-save" && tab)
    void saveTab(tab, info.linkUrl).catch(() => {
      void chrome.action.setBadgeText({ text: "!" });
    });
});
