import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@sor7ed/core/src/schema.js';

const testUrl = process.env['SOR7ED_API_TEST_DATABASE_URL'];
if (testUrl) {
  const url = new URL(testUrl);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/sor7ed_api_tests') {
    throw new Error('API integration tests require the local disposable sor7ed_api_tests database');
  }
}
const pool = testUrl ? new pg.Pool({ connectionString: testUrl, max: 20 }) : null;
const send = vi.fn();
const enqueue = vi.fn();
vi.mock('@sor7ed/core/src/client.js', () => ({ db: pool ? drizzle(pool, { schema }) : null }));
vi.mock('@sor7ed/core', async () => ({
  ...await import('@sor7ed/core/src/save-actions.js'),
  ...await import('@sor7ed/core/src/whatsapp/client.js'),
  sendSaveCard: send, enqueueEnrichment: enqueue,
}));
const { saveRoutes } = await import('./saves.js');
const { WhatsAppSendError } = await import('@sor7ed/core/src/whatsapp/client.js');

describe.skipIf(!testUrl)('save API through real disposable Postgres', () => {
  let app: FastifyInstance;
  let userId: string;
  let partnerId: string;
  const apiKey = 'test-publishable-key';
  const body = () => ({ partnerApiKey: apiKey, url: 'https://partner.example/resource', title: 'Resource', idempotencyKey: 'flow-01234567890123456789' });
  const request = () => app.inject({ method: 'POST', url: '/api/saves', headers: { 'x-test-user': userId }, payload: body() });

  beforeAll(async () => {
    const exists = await pool!.query("SELECT to_regclass('public.users') AS users");
    if (exists.rows[0].users) throw new Error('API integration tests require an empty disposable database');
    const journal = JSON.parse(await readFile(new URL('../../../core/src/migrations/meta/_journal.json', import.meta.url), 'utf8')) as { entries: { tag: string }[] };
    for (const entry of journal.entries) {
      await pool!.query(await readFile(new URL(`../../../core/src/migrations/${entry.tag}.sql`, import.meta.url), 'utf8'));
    }
    app = Fastify();
    app.decorateRequest('userId', null);
    app.decorate('requireAuth', async (req, reply) => {
      const id = req.headers['x-test-user'];
      if (typeof id !== 'string') { await reply.code(401).send({ error: 'Please sign in.' }); return; }
      req.userId = id;
    });
    await app.register(saveRoutes);
    process.env['BASE_URL'] = 'https://sor7ed.test';
  });
  beforeEach(async () => {
    await pool!.query('TRUNCATE users, partners CASCADE');
    userId = randomUUID(); partnerId = randomUUID();
    await pool!.query('INSERT INTO users(id,whatsapp_number,whatsapp_verified) VALUES($1,$2,true)', [userId, '440000000000']);
    await pool!.query('INSERT INTO partners(id,name,api_key,allowed_domains) VALUES($1,$2,$3,$4)', [partnerId, 'Partner', apiKey, ['partner.example']]);
    send.mockReset().mockResolvedValue({ status: 'accepted', reason: null, messageId: 'wamid.test' });
    enqueue.mockReset().mockResolvedValue(undefined);
  });
  afterAll(async () => { await app?.close(); await pool?.end(); });

  it('24 concurrent HTTP requests create and send exactly one save, with persistent replay status', async () => {
    const responses = await Promise.all(Array.from({ length: 24 }, request));
    expect(responses.filter(r => r.statusCode === 201)).toHaveLength(1);
    expect(responses.filter(r => r.statusCode === 200)).toHaveLength(23);
    expect(new Set(responses.map(r => r.json().shortId)).size).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
    const rows = await pool!.query('SELECT delivery_status,whatsapp_message_id FROM saved_items');
    expect(rows.rows).toEqual([{ delivery_status: 'accepted', whatsapp_message_id: 'wamid.test' }]);
    const usage = await pool!.query('SELECT saves_this_month FROM partners WHERE id=$1', [partnerId]);
    expect(usage.rows[0].saves_this_month).toBe(1);
    expect((await request()).json().deliveryStatus).toBe('accepted');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('failed and uncertain sends stay saved and replays cannot send again', async () => {
    send.mockRejectedValue(new WhatsAppSendError('Test uncertain send', 'unknown'));
    const first = await request();
    expect(first.json().deliveryStatus).toBe('unknown');
    expect((await request()).json().deliveryStatus).toBe('unknown');
    expect(send).toHaveBeenCalledTimes(1);
    const status = await app.inject({ method: 'GET', url: `/api/saves/status/${first.json().shortId}`, headers: { 'x-test-user': userId } });
    expect(status.json().deliveryStatus).toBe('unknown');
  });

  it('another authenticated account cannot inspect the save status', async () => {
    const first = await request();
    const otherUser = randomUUID();
    await pool!.query('INSERT INTO users(id) VALUES($1)', [otherUser]);
    const status = await app.inject({ method: 'GET', url: `/api/saves/status/${first.json().shortId}`, headers: { 'x-test-user': otherUser } });
    expect(status.statusCode).toBe(404);
  });
});
