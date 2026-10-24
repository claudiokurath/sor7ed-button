/* Browser regression checks. Run the web app first, then:
 * SAVE_FLOW_WEB_ORIGIN=http://localhost:3045 node web/scripts/verify-save-flow.cjs
 * Requires Playwright + Chromium in the test environment. All API calls are mocked;
 * this script never sends WhatsApp messages or uses real credentials.
 */
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const { chromium } = require('playwright');

const web = process.env.SAVE_FLOW_WEB_ORIGIN || 'http://localhost:3045';
const api = process.env.SAVE_FLOW_API_ORIGIN || 'http://localhost:3001';
// A distinct loopback hostname avoids Chromium's private-network block
// when a synthetic public host tries to load the local widget script.
const host = process.env.SAVE_FLOW_PARTNER_ORIGIN || new URL(web).origin.replace('localhost', '127.0.0.1');
const browserPath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath());

const responseFor = (deliveryStatus) => ({ shortId: 'saved-item-123', cardUrl: `${web}/s/saved-item-123`, saveStatus: 'saved', deliveryStatus, deliveryReason: deliveryStatus === 'skipped' ? 'opted_out' : null });
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fixture(browser, { status = 'pending', verified = true, authStatus = 200, image = '', demo = false } = {}) {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const state = { status, verified, authStatus, meCalls: 0, connectCalls: [], saves: [], statusCalls: 0, activeMe: 0, maxMe: 0, saveFailures: 0, meDelay: 0, expired: false, loginUrls: [] };
  const cors = { 'access-control-allow-origin': web, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' };
  await context.route(`${api}/api/**`, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (path === '/api/auth/login') {
      state.loginUrls.push(request.url());
      return route.fulfill({ contentType: 'text/html', body: '<html><body>OAuth fixture: no real login performed</body></html>' });
    }
    if (path === '/api/auth/me') {
      state.meCalls++;
      state.activeMe++;
      state.maxMe = Math.max(state.maxMe, state.activeMe);
      await pause(state.meDelay);
      state.activeMe--;
      return route.fulfill({ status: state.authStatus, headers: cors, json: state.authStatus === 200 ? { id: 'fixture-user', email: 'fixture@example.test', whatsappVerified: state.verified } : { error: 'Fixture account check failed' } });
    }
    if (path === '/api/whatsapp/connect') {
      state.connectCalls.push(request.postDataJSON());
      return route.fulfill({ headers: cors, json: { url: `https://wa.me/441234567890?text=CONNECT-fixture-${state.connectCalls.length}`, expiresAt: new Date(Date.now() + (state.expired ? -1000 : 60_000)).toISOString() } });
    }
    if (path === '/api/saves' && request.method() === 'POST') {
      state.saves.push(request.postDataJSON());
      if (state.saveFailures > 0) { state.saveFailures--; return route.abort('failed'); }
      await pause(80);
      return route.fulfill({ headers: cors, json: responseFor(state.status) });
    }
    if (path === '/api/saves/status/saved-item-123') {
      state.statusCalls++;
      return route.fulfill({ headers: cors, json: responseFor(state.status) });
    }
    throw new Error(`Unexpected fixture API request: ${request.method()} ${path}`);
  });
  await context.route(`${host}/**`, route => route.fulfill({ contentType: 'text/html', body: `<html><head><title>Initial title</title></head><body><div data-sor7ed data-url="/article" data-title="Initial title" data-image="${image}"></div><script src="${web}/widget.js" ${demo ? 'data-demo="true"' : 'data-api-key="fixture-publishable-key"'}></script></body></html>` }));
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  const page = await context.newPage();
  await page.goto(`${host}/article`);
  await page.getByRole('button', { name: 'Save this piece — SOR7ED' }).waitFor();
  return { context, page, state };
}

async function openPopup(page) {
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Save this piece — SOR7ED' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  return popup;
}

async function main() {
  // This fixture intentionally embeds a loopback dev server across two
  // origins. Disable only the localhost permission prompt in Chromium;
  // normal same-origin/CORS and popup message checks remain enabled.
  const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox', '--disable-features=LocalNetworkAccessChecks'] });
  try {
    for (const [status, title] of [
      ['accepted', 'Message sent'], ['pending', 'Saved — sending to WhatsApp'],
      ['failed', 'Saved. WhatsApp sending failed.'], ['skipped', 'Saved in your library'],
      ['unknown', 'Saved. WhatsApp status is unconfirmed.'],
    ]) {
      const { context, page, state } = await fixture(browser, { status });
      const popup = await openPopup(page);
      await popup.getByText(title, { exact: true }).waitFor();
      assert.equal(state.saves.length, 1, `${status}: one save`);
      assert.equal(Object.hasOwn(state.saves[0], 'imageUrl'), false, 'missing image is omitted');
      assert.match(state.saves[0].idempotencyKey, /^[A-Za-z0-9_-]{16,100}$/);
      assert.equal(state.saves[0].idempotencyKey, new URL(popup.url()).searchParams.get('flowId'));
      assert.equal(new URL(popup.url()).searchParams.get('openerOrigin'), host);
      assert.equal((await popup.locator('body').innerText()).includes('Saved to your WhatsApp'), false);
      if (status === 'accepted') {
        await page.getByText('Message sent', { exact: true }).waitFor();
        await popup.waitForEvent('close');
      } else {
        await popup.getByRole('button', { name: 'Check send status' }).click();
        assert.equal(state.saves.length, 1, 'status check never sends another POST');
        await pause(100);
        assert.equal(state.statusCalls, 1);
        assert.equal(popup.isClosed(), false, 'unconfirmed outcomes remain visible');
        assert.equal(await page.locator('.s7-widget').evaluate(el => el.style.getPropertyValue('--s7-t')), '', 'no sent animation');
      }
      console.log(`PASS truthful ${status} feedback`);
      await context.close();
    }

    {
      const { context, page, state } = await fixture(browser, { verified: false });
      const popup = await openPopup(page);
      await popup.getByRole('link', { name: 'Connect WhatsApp', exact: true }).waitFor();
      state.meDelay = 120;
      await popup.evaluate(() => { for (let i = 0; i < 15; i++) { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); } });
      await pause(8500);
      assert.equal(state.connectCalls.length, 1, 'polling does not mint new tokens');
      assert.equal(state.maxMe, 1, 'overlapping focus and interval checks are single-flight');
      state.verified = true;
      state.status = 'accepted';
      await popup.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
      await popup.getByText('Message sent', { exact: true }).waitFor();
      assert.equal(state.saves.length, 1, 'verification triggers one save');
      console.log('PASS focus/poll concurrency and one CONNECT token');
      await context.close();
    }

    {
      const { context, page, state } = await fixture(browser, { verified: false });
      state.expired = true;
      const popup = await openPopup(page);
      await popup.getByRole('button', { name: 'Get a new connection link' }).waitFor();
      state.expired = false;
      await popup.getByRole('button', { name: 'Get a new connection link' }).click();
      await popup.getByRole('link', { name: 'Connect WhatsApp', exact: true }).waitFor();
      assert.deepEqual(state.connectCalls, [{ refresh: false }, { refresh: true }]);
      console.log('PASS expired token refresh is explicit');
      await context.close();
    }

    for (const authStatus of [401, 503]) {
      const { context, page, state } = await fixture(browser, { authStatus });
      const popup = await openPopup(page);
      if (authStatus === 401) await popup.getByRole('button', { name: 'Continue with WhatsApp' }).waitFor();
      else {
        await popup.getByRole('button', { name: 'Try account check again' }).waitFor();
        assert.equal(await popup.getByRole('button', { name: 'Continue with WhatsApp' }).count(), 0);
      }
      assert.equal(state.saves.length, 0);
      assert.equal(state.connectCalls.length, 0);
      console.log(`PASS auth ${authStatus} distinct feedback`);
      await context.close();
    }

    {
      const { context, page, state } = await fixture(browser);
      state.saveFailures = 1;
      const popup = await openPopup(page);
      await popup.getByRole('button', { name: 'Check this save again' }).waitFor();
      const firstKey = state.saves[0].idempotencyKey;
      await popup.getByRole('button', { name: 'Check this save again' }).click();
      await popup.getByText('Saved — sending to WhatsApp', { exact: true }).waitFor();
      assert.equal(state.saves.length, 2);
      assert.equal(state.saves[1].idempotencyKey, firstKey, 'lost-response retry uses same key');
      await popup.reload();
      await popup.getByText('Saved — sending to WhatsApp', { exact: true }).waitFor();
      assert.equal(state.saves[2].idempotencyKey, firstKey, 'reload uses same key');
      console.log('PASS retries and reload preserve action identity');
      await context.close();
    }

    {
      const { context, state } = await fixture(browser);
      const direct = await context.newPage();
      const query = new URLSearchParams({ apiKey: 'fixture-publishable-key', url: `${host}/article`, title: 'Direct title' });
      await direct.goto(`${web}/save?${query}`);
      await direct.getByText('Saved — sending to WhatsApp', { exact: true }).waitFor();
      const firstKey = state.saves[0].idempotencyKey;
      await direct.reload();
      await direct.getByText('Saved — sending to WhatsApp', { exact: true }).waitFor();
      assert.equal(state.saves[1].idempotencyKey, firstKey, 'direct reload preserves fallback action');
      query.set('title', 'Updated direct title');
      await direct.goto(`${web}/save?${query}`);
      await direct.getByText('Saved — sending to WhatsApp', { exact: true }).waitFor();
      assert.notEqual(state.saves[2].idempotencyKey, firstKey, 'new metadata creates a fresh direct-link action');
      console.log('PASS direct-link identity scoped to full normalized content');
      await context.close();
    }

    {
      const { context, state } = await fixture(browser, { authStatus: 401 });
      const direct = await context.newPage();
      const query = new URLSearchParams({ apiKey: 'fixture-publishable-key', url: `${host}/article`, title: 'OAuth title' });
      await direct.goto(`${web}/save?${query}`);
      await direct.getByRole('button', { name: 'Continue with WhatsApp' }).click();
      await direct.waitForURL('**/signin?next=*');
      const returnTo = new URL(new URL(direct.url()).searchParams.get('next'), web).href;
      const flowId = new URL(returnTo).searchParams.get('flowId');
      assert.match(flowId, /^[A-Za-z0-9_-]{16,100}$/);
      state.authStatus = 200;
      await direct.goto(returnTo);
      await direct.getByText('Saved — sending to WhatsApp', { exact: true }).waitFor();
      assert.equal(state.saves[0].idempotencyKey, flowId, 'WhatsApp sign-in return carries the action ID');
      console.log('PASS WhatsApp sign-in return preserves direct-link action identity');
      await context.close();
    }

    {
      const { context, page, state } = await fixture(browser, { image: '/cover.jpg' });
      await page.locator('[data-sor7ed]').evaluate(el => el.setAttribute('data-title', 'Current title'));
      const popup = await openPopup(page);
      await popup.getByRole('heading', { name: 'Current title' }).waitFor();
      await popup.getByText('Saved — sending to WhatsApp', { exact: true }).waitFor();
      assert.equal(state.saves[0].title, 'Current title', 'metadata read at click time');
      assert.equal(state.saves[0].imageUrl, `${host}/cover.jpg`, 'relative image resolved against host');
      const flowId = new URL(popup.url()).searchParams.get('flowId');
      const forged = { source: 'sor7ed-widget', type: 'saved', flowId, deliveryStatus: 'accepted' };
      await page.evaluate(forged => window.dispatchEvent(new MessageEvent('message', { origin: 'https://attacker.invalid', source: window, data: forged })), forged);
      await page.evaluate(({ web, forged }) => window.dispatchEvent(new MessageEvent('message', { origin: web, source: window, data: forged })), { web, forged });
      await popup.evaluate(({ host, forged }) => window.opener.postMessage({ ...forged, flowId: 'different-action-12345' }, host), { host, forged });
      await popup.evaluate(({ host, forged }) => window.opener.postMessage({ ...forged, demo: true }, host), { host, forged });
      await pause(100);
      assert.equal(await page.getByText('Message sent', { exact: true }).count(), 0, 'wrong source/flow/demo rejected');
      state.status = 'accepted';
      await popup.getByRole('button', { name: 'Check send status' }).click();
      await page.getByText('Message sent', { exact: true }).waitFor();
      assert.equal(state.saves.length, 1, 'status transition never resends');
      console.log('PASS current metadata, relative image, and authenticated popup feedback');
      await context.close();
    }

    {
      const { context, page, state } = await fixture(browser, { demo: true });
      const popup = await openPopup(page);
      await popup.getByRole('button', { name: 'Simulate: Save to WhatsApp' }).click();
      await page.getByText('Demo: message sent', { exact: true }).waitFor();
      assert.equal(state.saves.length, 0);
      assert.equal(state.meCalls, 0);
      console.log('PASS explicitly simulated demo messaging');
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
