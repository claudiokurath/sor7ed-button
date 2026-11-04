import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { hasExtensionApproval } from "../web/src/app/_consumer/extension-approval.ts";
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
// A capture URL alone cannot authorize sending; approval is first-party and bound to this URL.
assert.equal(hasExtensionApproval(storage, draft), false);
storage.setItem(`sor7ed:approved:${flow}`, JSON.stringify({ url: draft.url, expiresAt: Date.now()+60000 }));
assert.equal(hasExtensionApproval(storage, draft), true);
assert.equal(hasExtensionApproval(storage, { ...draft, url: 'https://different.example/' }), false);
assert.equal(hasExtensionApproval(storage, draft, Date.now()+120000), false);
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
assert.deepEqual(manifest.host_permissions, ['https://www.sor7ed.com/*']);
assert(!manifest.externally_connectable);
assert.deepEqual(manifest.permissions, [
  "activeTab",
  "scripting",
  "contextMenus",
]);
const opened = [];
let toolbar, menu, updated;
const closed = [];
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
    executeScript: async (options) => options.func.name === 'approveCapture' ? [{ result: true }] : [
      { result: { url: "https://example.com/page", title: "Captured title" } },
    ],
  },
  tabs: { onUpdated: { addListener: fn => { updated = fn; } }, onRemoved: { addListener() {} } },
  windows: { create: async (options) => { opened.push(options); return { id: 1000 + opened.length, tabs: [{ id: 100 + opened.length }] }; }, remove: async id => closed.push(id) },
};
const source = readFileSync("extension/background.js", "utf8").replaceAll(
  "export ",
  "",
);
const runtime = vm.createContext({ chrome, crypto: webcrypto, URL, setTimeout, location: { origin: 'https://outside.example', pathname: '/save/extension' }, sessionStorage: storage, window: { dispatchEvent() {} }, Event: class {} });
vm.runInContext(source, runtime);
assert.equal(vm.runInContext(`approveCapture('${flow}', 'https://example.com/page', 'https://www.sor7ed.com')`, runtime), false);
runtime.location.origin = 'https://www.sor7ed.com';
assert.equal(vm.runInContext(`approveCapture('${flow}', 'https://example.com/page', 'https://www.sor7ed.com')`, runtime), true);
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
const clickedFlow = JSON.parse(decodeURIComponent(url.hash.slice(1))).flowId;
updated(101, { url: `https://outside.example/save/extension?flow=${clickedFlow}&delivery=accepted` });
assert.deepEqual(closed, []);
updated(101, { url: `https://www.sor7ed.com/save/extension?flow=${clickedFlow}&delivery=accepted` });
assert.deepEqual(closed, [1001]);
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

// Login/reconnect must keep the original save window and sever the child opener.
const { openWhatsAppWindow } = await import('../web/src/lib/whatsapp-window.ts');
const destinations = [], calls = [];
const child = { opener: 'original', location: { replace: value => { assert.equal(child.opener, null); destinations.push(value); } }, close() {} };
const windows = { open: (...args) => { calls.push(args); return child; } };
assert.equal(openWhatsAppWindow(windows, 'https://wa.me/447000000000?text=SIGNIN-fixture'), true);
assert.equal(calls[0][0], 'about:blank');
assert.match(calls[0][2], /popup=yes/);
assert.deepEqual(destinations, ['https://wa.me/447000000000?text=SIGNIN-fixture']);
assert.equal(openWhatsAppWindow({ open: () => null }, 'https://wa.me/447000000000'), false);
assert.throws(() => openWhatsAppWindow(windows, 'https://outside.example/signin'));
assert.throws(() => openWhatsAppWindow(windows, 'javascript:alert(1)'));
console.log('PASS separate WhatsApp window, opener isolation, blocked-window feedback and destination validation');
