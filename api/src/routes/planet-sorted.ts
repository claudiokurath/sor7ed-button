import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, users, claimPersonalSave, sendSaveCard, updateSaveDelivery, SaveActionError, WhatsAppSendError } from '@sor7ed/core';
import { parseBody } from '../schemas/validate.js';
import { resolvePlanetResource } from '../lib/planet-resource.js';

const resourceSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,100}$/),
  context: z.enum(['article', 'tool']),
}).strict();
const saveSchema = resourceSchema.extend({ idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/) });

export async function planetSortedRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (_req, reply) => { reply.header('Cache-Control', 'private, no-store'); });
  // Read-only opening checks a live verified Button account. It never sends a message.
  app.get('/api/planet-sorted/resource', { preHandler: app.requireAuth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const query = parseBody(resourceSchema, req.query, reply);
    if (!query) return;
    const [user] = await db.select({ verified: users.whatsappVerified }).from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!user?.verified) return reply.code(401).send({ error: 'Sign in to your Button account to open this resource.' });
    try { return await resolvePlanetResource(query.slug, query.context); }
    catch { return reply.code(503).send({ error: 'This resource is not available right now. Please try later.' }); }
  });
  app.post('/api/planet-sorted/saves', {
    preHandler: [app.requireAuth, async (req, reply) => {
      if (req.headers.origin !== (process.env['WEB_ORIGIN'] ?? 'http://localhost:3000')) return reply.code(403).send({ error: 'Open your Button account to continue.' });
    }],
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const body = parseBody(saveSchema, req.body, reply);
    if (!body) return;
    try {
      // Use the existing personal library, atomic quota and action receipt. No
      // Planet Sorted account, matching-by-email, or second member record is created.
      const resource = await resolvePlanetResource(body.slug, body.context);
      const action = await claimPersonalSave({ userId: req.userId!, idempotencyKey: body.idempotencyKey, url: resource.url, title: resource.title });
      let status = action.item.deliveryStatus;
      let reason = action.item.deliveryReason;
      if (action.created) {
        status = 'skipped'; reason = 'not_connected';
        let messageId: string | undefined;
        if (action.user.whatsappVerified && action.user.whatsappNumber) {
          try {
            const outcome = await sendSaveCard(req.userId!, action.user.whatsappNumber, action.item, 'Planet Sorted');
            status = outcome.status; reason = outcome.reason;
            if (outcome.status === 'accepted') messageId = outcome.messageId;
          } catch (error) {
            status = error instanceof WhatsAppSendError ? error.outcome : 'unknown';
            reason = status === 'failed' ? 'send_failed' : 'unconfirmed';
          }
        }
        try { await updateSaveDelivery(action.item.id, status, reason, messageId); }
        catch { app.log.warn({ saveId: action.item.id }, 'Resource send outcome not persisted'); }
      } else if (status === 'pending' && action.item.deliveryUpdatedAt.getTime() < Date.now() - 120000) status = 'unknown';
      return reply.code(action.created ? 201 : 200).send({ shortId: action.item.shortId, cardUrl: `${process.env['BASE_URL'] ?? 'https://www.sor7ed.com'}/s/${action.item.shortId}`, saveStatus: 'saved', deliveryStatus: status, deliveryReason: reason });
    } catch (error) {
      if (error instanceof SaveActionError) return reply.code(error.statusCode).send({ error: error.message });
      return reply.code(503).send({ error: 'Could not confirm this resource request. Check the same action again.' });
    }
  });
}
