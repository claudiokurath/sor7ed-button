import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { captureDraft } from "../web/src/app/_consumer/draft.ts";
const memory = new Map();
const storage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, v),
  removeItem: (k) => memory.delete(k),
};
const flow = "b46086bd-6e72-4635-a484-606372130d55",
  raw = { flowId: flow, url: "https://example.com/page", title: "A page" };
const draft = captureDraft(
  storage,
  "",
  "#" + encodeURIComponent(JSON.stringify(raw)),
);
assert.equal(draft.idempotencyKey, `extension_${flow}`);
assert.deepEqual(captureDraft(storage, `?flow=${flow}`, ""), draft);
assert.deepEqual(
  captureDraft(storage, "", "#" + encodeURIComponent(JSON.stringify(raw))),
  draft,
);
assert.throws(() =>
  captureDraft(
    storage,
    "",
    "#" +
      encodeURIComponent(
        JSON.stringify({ ...raw, url: "javascript:alert(1)" }),
      ),
  ),
);
assert.throws(() =>
  captureDraft(
    storage,
    "",
    "#" +
      encodeURIComponent(
        JSON.stringify({ ...raw, url: "https://example.com/different" }),
      ),
  ),
);
storage.setItem(
  `sor7ed:draft:${flow}`,
  JSON.stringify({ ...draft, savedAt: Date.now() - 1900000 }),
);
assert.equal(captureDraft(storage, `?flow=${flow}`, ""), null);
const manifest = JSON.parse(readFileSync("extension/manifest.json"));
for (const size of [16, 32, 48, 128]) {
  const file = `icons/scribble-${size}.png`;
  assert.equal(manifest.icons[size], file);
  assert.equal(manifest.action.default_icon[size], file);
  const png = readFileSync(`extension/${file}`);
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}
assert(!manifest.host_permissions && !manifest.externally_connectable);
assert.deepEqual(manifest.permissions, [
  "activeTab",
  "scripting",
  "contextMenus",
]);
const opened = [];
let toolbar, menu;
const chrome = {
  action: {
    onClicked: { addListener: (fn) => (toolbar = fn) },
    setBadgeText: async () => {},
  },
  contextMenus: {
    onClicked: { addListener: (fn) => (menu = fn) },
    create() {},
  },
  runtime: { onInstalled: { addListener() {} } },
  scripting: {
    executeScript: async () => [
      { result: { url: "https://example.com/page", title: "Captured title" } },
    ],
  },
  windows: { create: async (options) => opened.push(options) },
};
const source = readFileSync("extension/background.js", "utf8").replaceAll(
  "export ",
  "",
);
vm.runInNewContext(source, { chrome, crypto: webcrypto, URL });
toolbar({ id: 1, url: raw.url });
await new Promise((r) => setTimeout(r, 30));
assert.equal(opened.length, 1);
const url = new URL(opened[0].url);
assert.equal(url.origin, "https://www.sor7ed.com");
assert.equal(url.search, "");
assert.equal(
  JSON.parse(decodeURIComponent(url.hash.slice(1))).title,
  "Captured title",
);
menu(
  { menuItemId: "sorted-save", linkUrl: "https://example.org/video" },
  { id: 1, url: raw.url },
);
await new Promise((r) => setTimeout(r, 30));
assert.equal(
  JSON.parse(decodeURIComponent(new URL(opened[1].url).hash.slice(1))).url,
  "https://example.org/video",
);
toolbar({ id: 1, url: "chrome://settings" });
await new Promise((r) => setTimeout(r, 30));
assert.equal(opened.length, 2);
console.log(
  "PASS extension capture, toolbar/context handler, fixed production origin, draft restoration, expiry and stable action identity (browser toolbar UI not exercised)",
);
