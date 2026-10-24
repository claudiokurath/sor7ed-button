import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { widgetReturnUrl } from "../web/src/lib/widget-return.ts";

const code = readFileSync(new URL("../web/public/widget.js", import.meta.url), "utf8");
function fixture(options = {}) {
  const { mobile = false, blocked = false } = options;
  const crypto = Object.hasOwn(options, "crypto") ? options.crypto : webcrypto;
  class Element {
    children = []; attrs = {}; listeners = {}; style = { setProperty() {} }; textContent = "";
    appendChild(el) { this.children.push(el); return el; }
    setAttribute(k, v) { this.attrs[k] = v; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    removeAttribute(k) { delete this.attrs[k]; }
    addEventListener(k, fn) { this.listeners[k] = fn; }
    querySelector(selector) { const key = selector.slice(1, -1); for (const c of this.children) { if (key in c.attrs) return c; const nested = c.querySelector(selector); if (nested) return nested; } return null; }
  }
  const target = new Element();
  const script = new Element(); script.src = "https://www.sor7ed.com/widget.js"; script.nonce = "fixture-nonce"; script.attrs["data-api-key"] = "public-partner-key";
  const intervals = new Map(), timeouts = new Map(), events = new Map(); let id = 0;
  const assigned = [], opened = [];
  const popup = { closed: false, focus() {} };
  const location = { href: "https://publisher.test/article?chapter=2#section", origin: "https://publisher.test", assign: value => assigned.push(value) };
  const window = { location, screen: { width: 1440, height: 900 }, matchMedia: () => ({ matches: mobile }), open: (...args) => { opened.push(args); return blocked ? null : popup; }, addEventListener: (k, fn) => events.set(k, fn), removeEventListener: k => events.delete(k) };
  const document = { currentScript: script, title: "Useful article", readyState: "complete", head: new Element(), body: new Element(), createElement: () => new Element(), createElementNS: () => new Element(), querySelector: () => null, querySelectorAll: () => [target] };
  vm.runInNewContext(code, { window, document, crypto, URL, URLSearchParams, Uint8Array, Array, matchMedia: () => ({ matches: true }), setInterval: (fn, ms) => { const k = ++id; intervals.set(k, { fn, ms }); return k; }, clearInterval: k => intervals.delete(k), setTimeout: (fn, ms) => { const k = ++id; timeouts.set(k, { fn, ms }); return k; }, clearTimeout: k => timeouts.delete(k) });
  const root = target.children[0], button = root.children[1];
  return { root, button, assigned, opened, popup, events, intervals, timeouts, head: document.head, click: () => button.listeners.click() };
}

for (const options of [{ mobile: true }, { blocked: true }]) {
  const f = fixture(options); f.click();
  assert.equal(f.assigned.length, 1); assert.equal(f.opened.length, options.mobile ? 0 : 1);
  const url = new URL(f.assigned[0]); assert.equal(url.pathname, "/save"); assert.equal(url.searchParams.get("navigation"), "redirect");
  assert.equal(url.searchParams.get("returnTo"), "https://publisher.test/article?chapter=2#section");
  assert.match(url.searchParams.get("flowId"), /^[A-Za-z0-9_-]{16,100}$/); assert.equal(f.intervals.size, 0);
}
const desktop = fixture(); desktop.click(); assert.equal(desktop.assigned.length, 0); assert.equal(desktop.intervals.size, 1);
assert.equal(desktop.head.children[0].nonce, "fixture-nonce");
const flowId = new URL(desktop.opened[0][0]).searchParams.get("flowId");
desktop.events.get("message")({ origin: "https://attacker.test", source: desktop.popup, data: { source: "sor7ed-widget", type: "saved", flowId, deliveryStatus: "accepted" } });
assert.equal(desktop.intervals.size, 1, "untrusted origin cannot confirm a send");
desktop.click(); assert.equal(desktop.opened.length, 1, "second click reuses active popup");
const timeout = [...desktop.timeouts.values()].find(t => t.ms === 600000); assert.ok(timeout); timeout.fn();
assert.equal(desktop.intervals.size, 0); assert.equal(desktop.events.size, 0); assert.equal(desktop.button.getAttribute("aria-busy"), null);
const missing = fixture({ crypto: undefined }); missing.click(); assert.equal(missing.opened.length, 0); assert.match(missing.root.querySelector("[data-s7-live]").textContent, /cannot start a secure save/);
const legacy = fixture({ crypto: { getRandomValues: a => webcrypto.getRandomValues(a) } }); legacy.click(); assert.equal(legacy.opened.length, 1);
assert.equal(widgetReturnUrl("https://publisher.test/article#part", "https://publisher.test"), "https://publisher.test/article#part");
for (const raw of ["javascript:alert(1)", "https://attacker.test/", "https://user:password@publisher.test/", "/relative", "not-a-url"]) assert.equal(widgetReturnUrl(raw, "https://publisher.test"), null);
assert.equal(widgetReturnUrl("https://publisher.test/", "https://publisher.test/path"), null);
console.log("PASS mobile/blocked-popup navigation, stable flow, return-link validation, crypto compatibility, nonce, spoof rejection and ten-minute cleanup");
