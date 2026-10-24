// Production destination is fixed; there is no externally_connectable handler,
// content-script injection on every page, host permission or session token.
const SAVE_ORIGIN = "https://www.sor7ed.com";
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
  await chrome.windows.create({ url, type: "popup", width: 540, height: 760 });
}
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sorted-save",
    title: "Save with Sorted",
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
