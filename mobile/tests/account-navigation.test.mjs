import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { ACCOUNT_URL, navigationTarget, whatsappTarget, WHATSAPP_BRIDGE } from '../lib/account-navigation.ts';

test('only SOR7ED HTTPS origins can remain in the account cookie context', () => {
  assert.equal(navigationTarget(ACCOUNT_URL), 'account');
  assert.equal(navigationTarget('https://api.sor7ed.com/api/auth/login'), 'account');
  for (const url of ['https://example.org/article', 'https://sor7ed.com.evil.org', 'https://accounts.google.com/']) {
    assert.equal(navigationTarget(url), 'external');
  }
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'http://www.sor7ed.com/account', 'https://user:pass@www.sor7ed.com', 'https://www.sor7ed.com:8443', 'intent://anything', 'not a URL']) {
    assert.equal(navigationTarget(url), 'blocked');
  }
});

test('WhatsApp bridge destinations must be public wa.me number links', () => {
  assert.equal(whatsappTarget('https://wa.me/447700900123?text=SIGNIN-test'), 'https://wa.me/447700900123?text=SIGNIN-test');
  for (const url of ['https://evil.org/447700900123', 'whatsapp://send', 'https://wa.me.evil.org/447700900123', 'https://wa.me/not-a-number', 'https://user@wa.me/447700900123', 'http://wa.me/447700900123', 'https://wa.me/123']) {
    assert.equal(whatsappTarget(url), null);
  }
});

test('existing blank-window sign-in handoff reaches native without replacing the account page', () => {
  const messages = [];
  let fallbackCalls = 0;
  const context = {
    location: { origin: 'https://www.sor7ed.com' },
    window: { open() { fallbackCalls++; return null; }, ReactNativeWebView: { postMessage: (message) => messages.push(JSON.parse(message)) } },
  };
  vm.runInNewContext(WHATSAPP_BRIDGE, context);
  vm.runInNewContext(WHATSAPP_BRIDGE, context); // safe if injected twice
  const child = context.window.open('about:blank', '_blank', 'popup=yes');
  child.opener = null;
  child.location.replace('https://wa.me/447700900123?text=SIGNIN-test');
  assert.deepEqual(messages, [{ type: 'sor7ed:whatsapp', url: 'https://wa.me/447700900123?text=SIGNIN-test' }]);
  context.window.open('https://example.org', '_blank');
  assert.equal(fallbackCalls, 1);
  assert.equal(context.location.origin, 'https://www.sor7ed.com');
});

test('bridge never installs on a third-party document', () => {
  const original = () => null;
  const context = { location: { origin: 'https://example.org' }, window: { open: original } };
  vm.runInNewContext(WHATSAPP_BRIDGE, context);
  assert.equal(context.window.open, original);
});
