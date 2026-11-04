import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ optedOut: vi.fn(), sessionOpen: vi.fn(), text: vi.fn(), template: vi.fn() }));
vi.mock('../queries.js', () => ({ isWhatsAppOptedOut: mock.optedOut, isWhatsAppSessionOpen: mock.sessionOpen }));
vi.mock('./client.js', async (original) => ({ ...(await original<typeof import('./client.js')>()), sendText: mock.text, sendTemplate: mock.template }));
import { sendSaveCard } from './service.js';

describe('save-card outcome and consent', () => {
  const item = { shortId: 'abc123def456', url: 'https://example.com/article?source=reader#section', title: 'Resource', aiSummary: null, cachedImageUrl: null };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('BASE_URL', 'https://sor7ed.test');
    mock.optedOut.mockResolvedValue(false);
    mock.sessionOpen.mockResolvedValue(true);
    mock.text.mockResolvedValue('wamid.test');
    mock.template.mockResolvedValue('wamid.template');
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('opt-out returns skipped without sending anything', async () => {
    mock.optedOut.mockResolvedValue(true);
    expect(await sendSaveCard('user', '440000000000', item, 'Partner')).toEqual({ status: 'skipped', reason: 'opted_out' });
    expect(mock.text).not.toHaveBeenCalled();
    expect(mock.template).not.toHaveBeenCalled();
    expect(mock.sessionOpen).not.toHaveBeenCalled();
  });

  it('open conversation returns acceptance, never delivery', async () => {
    expect(await sendSaveCard('user', '440000000000', item, 'Partner')).toEqual({ status: 'accepted', reason: null, messageId: 'wamid.test' });
    expect(mock.template).not.toHaveBeenCalled();
  });

  it.each(['lean', 'full'])('sends only the original URL for native WhatsApp previews in %s mode', async (mode) => {
    vi.stubEnv('BUTTON_MODE', mode);
    await sendSaveCard('user', '440000000000', {
      ...item, title: 'Search the register', aiSummary: 'An extra summary that should stay out of the message.',
    }, 'Example publisher');
    expect(mock.text).toHaveBeenCalledWith('440000000000', item.url);
    expect(mock.text).toHaveBeenCalledTimes(1);
    expect(mock.template).not.toHaveBeenCalled();
  });

  it.each(['lean', 'full'])('requires an open conversation for direct links in %s mode', async (mode) => {
    vi.stubEnv('BUTTON_MODE', mode);
    mock.sessionOpen.mockResolvedValue(false);
    expect(await sendSaveCard('user', '440000000000', item, 'Partner')).toEqual({ status: 'skipped', reason: 'session_closed' });
    expect(mock.text).not.toHaveBeenCalled();
    expect(mock.template).not.toHaveBeenCalled();
  });

  it('a response without a message ID is uncertain, not a skipped opt-out or success', async () => {
    mock.text.mockResolvedValue(undefined);
    expect(await sendSaveCard('user', '440000000000', item, 'Partner')).toEqual({ status: 'unknown', reason: 'unconfirmed' });
  });

  it('does not substitute cached artwork or a short link for the source', async () => {
    await sendSaveCard('user', '440000000000', { ...item, cachedImageUrl: 'https://source.test/photo.jpg' }, 'Partner');
    expect(mock.text).toHaveBeenCalledWith('440000000000', item.url);
    expect(mock.template).not.toHaveBeenCalled();
  });

  it.each(['javascript:alert(1)', 'https://user:password@example.com/private'])('refuses an unsafe destination %s', async (url) => {
    await expect(sendSaveCard('user', '440000000000', { ...item, url }, 'Partner')).rejects.toMatchObject({ outcome: 'failed' });
    expect(mock.text).not.toHaveBeenCalled();
  });

  it('lean mode never sends a template when the window is closed', async () => {
    vi.stubEnv('BUTTON_MODE', 'lean');
    mock.sessionOpen.mockResolvedValue(false);
    expect(await sendSaveCard('user', '440000000000', item, 'Partner'))
      .toEqual({ status: 'skipped', reason: 'session_closed' });
    expect(mock.template).not.toHaveBeenCalled();
    expect(mock.text).not.toHaveBeenCalled();
  });

  it('lean mode automatically sends in an open window without advertising reminders', async () => {
    vi.stubEnv('BUTTON_MODE', 'lean');
    expect((await sendSaveCard('user', '440000000000', item, 'Partner')).status).toBe('accepted');
    expect(mock.text.mock.calls[0]?.[1]).not.toContain('REMIND');
    expect(mock.template).not.toHaveBeenCalled();
  });
});
