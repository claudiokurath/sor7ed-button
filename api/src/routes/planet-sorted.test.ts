import Fastify, { type FastifyInstance } from 'fastify';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  resolve: vi.fn(), claim: vi.fn(), send: vi.fn(), update: vi.fn(), select: vi.fn(),
  SaveActionError: class extends Error { constructor(public statusCode: number, message: string) { super(message); } },
  WhatsAppSendError: class extends Error { constructor(public outcome: 'failed' | 'unknown') { super(); } },
}));
vi.mock('../lib/planet-resource.js', () => ({ resolvePlanetResource: mock.resolve }));
vi.mock('@sor7ed/core', () => ({ db: { select: mock.select }, users: { id: 'id', whatsappVerified: 'verified' }, claimPersonalSave: mock.claim, sendSaveCard: mock.send, updateSaveDelivery: mock.update, SaveActionError: mock.SaveActionError, WhatsAppSendError: mock.WhatsAppSendError }));
import { planetSortedRoutes } from './planet-sorted.js';
describe('separate Button resource account', () => {
  let app: FastifyInstance;
  const item = { id: 'save-one', shortId: 'short-one', url: 'https://gamma.app/embed/exact', title: 'Protocol', deliveryStatus: 'pending', deliveryReason: null, deliveryUpdatedAt: new Date() };
  const payload = { slug: 'useful-protocol', context: 'article', idempotencyKey: 'resource-action-12345' };
  const headers = { 'x-user': 'member-one', origin: 'https://www.sor7ed.com' };
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env['WEB_ORIGIN'] = 'https://www.sor7ed.com';
    mock.resolve.mockResolvedValue({ title: item.title, url: item.url, openUrl: item.url, embedded: false });
    mock.claim.mockResolvedValue({ created: true, item, user: { whatsappVerified: true, whatsappNumber: '440000000000' } });
    mock.send.mockResolvedValue({ status: 'accepted', reason: null, messageId: 'wamid.fixture' });
    mock.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ verified: true }] }) }) });
    app = Fastify(); app.decorateRequest('userId', null);
    app.decorate('requireAuth', async (req, reply) => { if (!req.headers['x-user']) { await reply.code(401).send({ error: 'Sign in' }); return; } req.userId = String(req.headers['x-user']); });
    await app.register(planetSortedRoutes);
  });
  afterEach(async () => { await app.close(); });
  const save = () => app.inject({ method: 'POST', url: '/api/planet-sorted/saves', headers, payload });
  it('rejects anonymous and cross-origin mutations before resolving private resources', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/planet-sorted/saves', payload })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/planet-sorted/saves', headers: { ...headers, origin: 'https://evil.example' }, payload })).statusCode).toBe(403);
    expect(mock.resolve).not.toHaveBeenCalled(); expect(mock.send).not.toHaveBeenCalled();
  });
  it('uses server-resolved Notion destination and existing member library', async () => {
    const res = await save();
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ saveStatus: 'saved', deliveryStatus: 'accepted', shortId: item.shortId });
    expect(mock.claim).toHaveBeenCalledWith({ userId: 'member-one', idempotencyKey: payload.idempotencyKey, url: item.url, title: item.title });
    expect(mock.update).toHaveBeenCalledWith(item.id, 'accepted', null, 'wamid.fixture');
  });
  it('rejects visitor-supplied destinations and metadata', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/planet-sorted/saves', headers, payload: { ...payload, url: 'https://evil.example' } })).statusCode).toBe(400);
    expect(mock.claim).not.toHaveBeenCalled();
  });
  it('never resends a replay or a stale pending action', async () => {
    mock.claim.mockResolvedValue({ created: false, item: { ...item, deliveryUpdatedAt: new Date(Date.now() - 130000) }, user: {} });
    expect((await save()).json().deliveryStatus).toBe('unknown');
    expect(mock.send).not.toHaveBeenCalled(); expect(mock.update).not.toHaveBeenCalled();
  });
  it('preserves ambiguous provider outcomes and does not retry automatically', async () => {
    mock.send.mockRejectedValue(new Error('network timeout'));
    expect((await save()).json().deliveryStatus).toBe('unknown');
    expect(mock.send).toHaveBeenCalledTimes(1);
  });
  it('fails closed when current Notion publication cannot be resolved', async () => {
    mock.resolve.mockRejectedValue(new Error('unpublished'));
    expect((await save()).statusCode).toBe(503);
    expect(mock.claim).not.toHaveBeenCalled(); expect(mock.send).not.toHaveBeenCalled();
  });
  it('opening a resource requires a live verified account and never sends', async () => {
    const url = '/api/planet-sorted/resource?slug=useful-protocol&context=article';
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401);
    mock.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [] }) }) });
    expect((await app.inject({ method: 'GET', url, headers })).statusCode).toBe(401);
    mock.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ verified: true }] }) }) });
    const response = await app.inject({ method: 'GET', url, headers });
    expect(response.statusCode).toBe(200); expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mock.send).not.toHaveBeenCalled(); expect(mock.claim).not.toHaveBeenCalled();
  });
});
