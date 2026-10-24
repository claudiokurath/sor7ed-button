import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendText, WhatsAppSendError } from './client.js';

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
});
