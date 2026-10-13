import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ optedOut: vi.fn(), sessionOpen: vi.fn(), text: vi.fn(), template: vi.fn() }));
vi.mock('../queries.js', () => ({ isWhatsAppOptedOut: mock.optedOut, isWhatsAppSessionOpen: mock.sessionOpen }));
vi.mock('./client.js', () => ({ sendText: mock.text, sendTemplate: mock.template }));
import { sendSaveCard } from './service.js';

describe('save-card outcome and consent', () => {
  const item = { shortId: 'abc123def456', title: 'Resource', aiSummary: null, cachedImageUrl: null };
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

  it('closed conversation keeps the approved template and fallback header', async () => {
    mock.sessionOpen.mockResolvedValue(false);
    expect((await sendSaveCard('user', '440000000000', item, 'Partner')).status).toBe('accepted');
    expect(mock.text).not.toHaveBeenCalled();
    expect(mock.template.mock.calls[0]?.[1]).toBe('sor7ed_saved_card');
    expect(mock.template.mock.calls[0]?.[3][0].parameters[0].image.link).toBe('https://sor7ed.test/og-fallback.png');
  });

  it('a response without a message ID is uncertain, not a skipped opt-out or success', async () => {
    mock.text.mockResolvedValue(undefined);
    expect(await sendSaveCard('user', '440000000000', item, 'Partner')).toEqual({ status: 'unknown', reason: 'unconfirmed' });
  });
});
