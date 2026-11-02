import Fastify, { type FastifyInstance } from 'fastify';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  claim: vi.fn(), update: vi.fn(), read: vi.fn(), enqueue: vi.fn(), send: vi.fn(),
  SaveActionError: class extends Error {
    constructor(public statusCode: number, message: string) { super(message); }
  },
  WhatsAppSendError: class extends Error {
    constructor(message: string, public outcome: 'failed' | 'unknown') { super(message); }
  },
}));
vi.mock('@sor7ed/core', () => ({
  claimSaveAction: mock.claim, updateSaveDelivery: mock.update, readOwnSaveDelivery: mock.read,
  enqueueEnrichment: mock.enqueue, sendSaveCard: mock.send,
  SaveActionError: mock.SaveActionError, WhatsAppSendError: mock.WhatsAppSendError,
}));
import { saveRoutes } from './saves.js';

describe('save and delivery API', () => {
  let app: FastifyInstance;
  const payload = {
    partnerApiKey: 'public-key', url: 'https://example.com/resource', title: 'Resource',
    idempotencyKey: 'flow-01234567890123456789',
  };
  const headers = { 'x-test-user': 'user-one' };
  const item = {
    id: 'item-one', shortId: 'abc123def456', title: 'Resource', url: 'https://example.com/resource',
    cachedImageUrl: null, aiSummary: null,
    deliveryStatus: 'pending', deliveryReason: null, deliveryUpdatedAt: new Date(),
  };
  const action = {
    created: true, item,
    user: { whatsappVerified: true, whatsappNumber: '440000000000' },
    partner: { id: 'partner-one', name: 'Partner', brandName: null },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mock.claim.mockResolvedValue(action);
    mock.enqueue.mockResolvedValue(undefined);
    mock.update.mockResolvedValue(undefined);
    mock.send.mockResolvedValue({ status: 'accepted', reason: null, messageId: 'wamid.test' });
    mock.read.mockResolvedValue(item);
    process.env['BASE_URL'] = 'https://sor7ed.test';
    app = Fastify();
    app.decorateRequest('userId', null);
    app.decorate('requireAuth', async (req, reply) => {
      const user = req.headers['x-test-user'];
      if (typeof user !== 'string') { await reply.code(401).send({ error: 'Please sign in.' }); return; }
      req.userId = user;
    });
    await app.register(saveRoutes);
  });
  afterEach(async () => { await app.close(); });

  const save = () => app.inject({ method: 'POST', url: '/api/saves', headers, payload });

  it('rejects anonymous saves and status lookups before touching data', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/saves', payload })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/saves/status/abc123def456' })).statusCode).toBe(401);
    expect(mock.claim).not.toHaveBeenCalled();
    expect(mock.read).not.toHaveBeenCalled();
  });

  it('records provider acceptance without pretending to know device delivery', async () => {
    const res = await save();
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      shortId: item.shortId, cardUrl: `https://sor7ed.test/s/${item.shortId}`,
      saveStatus: 'saved', deliveryStatus: 'accepted', deliveryReason: null,
    });
    expect(mock.update).toHaveBeenCalledWith(item.id, 'accepted', null, 'wamid.test');
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it.each(['failed', 'unknown'] as const)('keeps a saved item honest when sending is %s', async outcome => {
    mock.send.mockRejectedValue(new mock.WhatsAppSendError('provider detail', outcome));
    const res = await save();
    expect(res.statusCode).toBe(201);
    expect(res.json().saveStatus).toBe('saved');
    expect(res.json().deliveryStatus).toBe(outcome);
    expect(res.body).not.toContain('provider detail');
  });

  it('preserves opt-out without claiming a message was sent', async () => {
    mock.send.mockResolvedValue({ status: 'skipped', reason: 'opted_out' });
    const res = await save();
    expect(res.json().deliveryStatus).toBe('skipped');
    expect(res.json().deliveryReason).toBe('opted_out');
  });

  it('does not attempt sending for an unconnected account', async () => {
    mock.claim.mockResolvedValue({ ...action, user: { whatsappVerified: false, whatsappNumber: null } });
    const res = await save();
    expect(res.json().deliveryReason).toBe('not_connected');
    expect(mock.send).not.toHaveBeenCalled();
  });

  it('a concurrent replay sees pending and cannot enqueue or send twice', async () => {
    let resolveSend!: (value: unknown) => void;
    mock.send.mockImplementation(() => new Promise(resolve => { resolveSend = resolve; }));
    mock.claim.mockResolvedValueOnce(action).mockResolvedValueOnce({ ...action, created: false });
    const first = save();
    await vi.waitFor(() => expect(mock.send).toHaveBeenCalledTimes(1));
    const replay = await save();
    expect(replay.statusCode).toBe(200);
    expect(replay.json().deliveryStatus).toBe('pending');
    expect(mock.enqueue).toHaveBeenCalledTimes(1);
    resolveSend({ status: 'accepted', reason: null, messageId: 'wamid.test' });
    await first;
    expect(mock.send).toHaveBeenCalledTimes(1);
  });

  it.each([403, 409, 429])('returns the claim error %s without delivering', async status => {
    mock.claim.mockRejectedValue(new mock.SaveActionError(status, 'Please check this save.'));
    expect((await save()).statusCode).toBe(status);
    expect(mock.send).not.toHaveBeenCalled();
    expect(mock.enqueue).not.toHaveBeenCalled();
  });

  it('checks status for the authenticated owner, not a supplied user query', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/saves/status/abc123def456?userId=someone-else', headers });
    expect(res.statusCode).toBe(200);
    expect(mock.read).toHaveBeenCalledWith('user-one', 'abc123def456');
    mock.read.mockResolvedValue(null);
    expect((await app.inject({ method: 'GET', url: '/api/saves/status/other', headers })).statusCode).toBe(404);
  });

  it('old pending work becomes uncertain, never a new send', async () => {
    mock.read.mockResolvedValue({ ...item, deliveryUpdatedAt: new Date(Date.now() - 121_000) });
    const res = await app.inject({ method: 'GET', url: '/api/saves/status/abc123def456', headers });
    expect(res.json().deliveryStatus).toBe('unknown');
    expect(mock.send).not.toHaveBeenCalled();
  });

  it('status outages return a plain retry message without database details', async () => {
    mock.read.mockRejectedValue(new Error('private SQL connection details'));
    const res = await app.inject({ method: 'GET', url: '/api/saves/status/abc123def456', headers });
    expect(res.statusCode).toBe(503);
    expect(res.body).not.toContain('private SQL');
    expect(mock.send).not.toHaveBeenCalled();
  });

  it('an outcome write failure after acceptance does not turn into a failed send or resend', async () => {
    mock.update.mockRejectedValue(new Error('DB unavailable'));
    expect((await save()).json().deliveryStatus).toBe('accepted');
    expect(mock.send).toHaveBeenCalledTimes(1);
    expect(mock.update).toHaveBeenCalledTimes(1);
  });
});
