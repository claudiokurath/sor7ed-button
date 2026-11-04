import Fastify from 'fastify';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
const relaySignature = (secret: string, purpose: string, time: string, id: string, body: string) => createHmac('sha256', secret).update(`${purpose}\n${time}\n${id}\n${body}`).digest('hex');
const f = vi.hoisted(() => ({ sendText: vi.fn(), updateLastInbound: vi.fn(), insert: vi.fn(), select: vi.fn(), optOut: vi.fn(), claims: new Set<string>() }));
vi.mock('@sor7ed/core', async () => {
  const { verifyRelay } = await vi.importActual<{ verifyRelay: (...args: unknown[]) => boolean }>('@sor7ed/core/src/relay-auth.js');
  return ({
  db: { insert: f.insert, select: f.select }, users: {}, savedItems: {}, buttonRateLimits: { table: 'receipts' },
  updateLastInbound: f.updateLastInbound, sendText: f.sendText, setWhatsAppOptOut: f.optOut,
  verifyRelay,
  verifyConnectionRequest: vi.fn(), getRecentSaves: vi.fn(), searchSavedItems: vi.fn(),
  resolveItemFromQuotedMessage: vi.fn(), isLeanMode: () => true, prepareSigninCode: vi.fn(),
});
});
import { webhookRoutes } from './webhook.js';
const secret = 'fixture-relay-secret';
beforeEach(() => {
  vi.clearAllMocks(); f.claims.clear();
  vi.stubEnv('WHATSAPP_TRANSPORT', 'relay'); vi.stubEnv('WHATSAPP_RELAY_SECRET', secret); vi.stubEnv('VERCEL', '');
  f.insert.mockImplementation(() => ({ values: (row: { keyHash: string }) => ({ onConflictDoNothing: () => ({ returning: async () => {
    if (f.claims.has(row.keyHash)) return [];
    f.claims.add(row.keyHash); return [{ keyHash: row.keyHash }];
  } }) }) }));
});
afterEach(() => vi.unstubAllEnvs());
async function fixture() {
  const app = Fastify(); app.decorateRequest('rawBody', undefined);
  app.addContentTypeParser<Buffer>('application/json', { parseAs: 'buffer' }, (req, body, done) => { req.rawBody = body; done(null, JSON.parse(body.toString())); });
  await webhookRoutes(app);
  const send = (text = 'Hello', signatureValid = true, id = 'fixture_inbound_12345678', mode = 'command') => {
    const body = JSON.stringify({ mode, message: { id: 'wamid.fixture', from: '447000000000', type: 'text', text: { body: text } } });
    const time = String(Date.now());
    return app.inject({ method: 'POST', url: '/webhook/relay', payload: body, headers: {
      'content-type': 'application/json', 'x-sor7ed-id': id, 'x-sor7ed-ts': time,
      'x-sor7ed-signature': signatureValid ? relaySignature(secret, 'inbound', time, id, body) : 'invalid',
    } });
  };
  return { app, send };
}
it('signed greeting replies only with the Button account, once, without creating a customer', async () => {
  const { app, send } = await fixture();
  try {
    expect((await send()).statusCode).toBe(200);
    await vi.waitFor(() => expect(f.sendText).toHaveBeenCalledOnce());
    expect(f.sendText.mock.calls[0]![1]).toContain('https://www.sor7ed.com/account');
    expect(f.sendText.mock.calls[0]![1]).not.toMatch(/planet/i);
    expect(f.sendText.mock.calls[0]![2]).toEqual({ previewUrl: false });
    expect(f.select).not.toHaveBeenCalled();
    expect(f.insert.mock.calls[0]![0]).toEqual({ table: 'receipts' });
    expect((await send()).json().duplicate).toBe(true);
    expect(f.sendText).toHaveBeenCalledOnce();
  } finally { await app.close(); }
});
it('invalid relay signature cannot trigger a greeting or update the session', async () => {
  const { app, send } = await fixture();
  try {
    expect((await send('Hello', false)).statusCode).toBe(401);
    expect(f.sendText).not.toHaveBeenCalled(); expect(f.updateLastInbound).not.toHaveBeenCalled();
  } finally { await app.close(); }
});
it('consent session events still update opt-outs without a second acknowledgement', async () => {
  const { app, send } = await fixture();
  try {
    await send('STOP', true, 'fixture_consent_12345678', 'session');
    await vi.waitFor(() => expect(f.optOut).toHaveBeenCalledWith('447000000000', true));
    expect(f.sendText).not.toHaveBeenCalled();
  } finally { await app.close(); }
});
