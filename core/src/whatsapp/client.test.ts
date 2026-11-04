import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendText, WhatsAppSendError } from './client.js';
import { verifyRelay } from '../relay-auth.js';

describe('WhatsApp provider request outcome', () => {
  const request = vi.fn();
  beforeEach(() => {
    vi.stubEnv('META_WHATSAPP_TOKEN', 'test-token');
    vi.stubEnv('META_WHATSAPP_PHONE_ID', 'test-number-id');
    vi.stubGlobal('fetch', request);
    request.mockReset();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('returns an accepted ID and bounds the request with an abort signal', async () => {
    request.mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }), { status: 200 }));
    expect(await sendText('440000000000', 'Example')).toBe('wamid.test');
    expect(request.mock.calls[0]?.[1].signal).toBeInstanceOf(AbortSignal);
  });

  it('account navigation can suppress unrelated link preview images', async () => {
    request.mockResolvedValue(Response.json({ messages: [{ id: 'wamid.account' }] }));
    await sendText('440000000000', 'Your account: https://www.sor7ed.com/account', { previewUrl: false });
    expect(JSON.parse(request.mock.calls[0]![1].body).text.preview_url).toBe(false);
  });

  it('missing configuration cannot be mistaken for an attempted send', async () => {
    vi.stubEnv('META_WHATSAPP_TOKEN', '');
    await expect(sendText('440000000000', 'Example')).rejects.toMatchObject({ outcome: 'failed' });
    expect(request).not.toHaveBeenCalled();
  });

  it.each([400, 401, 429])('provider rejection %s is a failed attempt', async status => {
    request.mockResolvedValue(new Response('private provider detail', { status }));
    await expect(sendText('440000000000', 'Example')).rejects.toMatchObject({ outcome: 'failed', status });
  });

  it.each([408, 500, 503])('ambiguous response %s never authorises automatic retry', async status => {
    request.mockResolvedValue(new Response('', { status }));
    await expect(sendText('440000000000', 'Example')).rejects.toMatchObject({ outcome: 'unknown', status });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('network interruption has an uncertain outcome without a blind resend', async () => {
    request.mockRejectedValue(new DOMException('Timeout', 'TimeoutError'));
    await expect(sendText('440000000000', 'Example')).rejects.toBeInstanceOf(WhatsAppSendError);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('malformed success response remains uncertain', async () => {
    request.mockResolvedValue(new Response('not json', { status: 200 }));
    await expect(sendText('440000000000', 'Example')).rejects.toMatchObject({ outcome: 'unknown' });
  });
  it('relay mode signs the text request without copying Meta credentials', async () => {
    vi.stubEnv('WHATSAPP_TRANSPORT', 'relay');
    vi.stubEnv('WHATSAPP_RELAY_URL', 'https://www.planetsorted.com/api/button/whatsapp');
    vi.stubEnv('WHATSAPP_RELAY_SECRET', 'fixture-secret');
    vi.stubEnv('META_WHATSAPP_TOKEN', undefined); vi.stubEnv('META_WHATSAPP_PHONE_ID', undefined);
    request.mockResolvedValue(Response.json({ messages: [{ id: 'wamid.relay' }] }));
    expect(await sendText('440000000000', 'Example')).toBe('wamid.relay');
    const [url, options] = request.mock.calls[0]!;
    expect(url).toBe('https://www.planetsorted.com/api/button/whatsapp');
    expect(options.headers.Authorization).toBeUndefined();
    expect(verifyRelay('fixture-secret', 'outbound', options.headers['x-sor7ed-ts'], options.headers['x-sor7ed-id'], options.body, options.headers['x-sor7ed-signature'])).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
