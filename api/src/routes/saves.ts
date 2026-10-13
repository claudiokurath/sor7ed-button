import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import {
  claimSaveAction, updateSaveDelivery, readOwnSaveDelivery, SaveActionError,
  enqueueEnrichment, sendSaveCard, WhatsAppSendError,
} from '@sor7ed/core';
import type { SaveResponse, SaveDeliveryStatus } from '@sor7ed/types';
import { saveBodySchema } from '../schemas/saves.js';
import { parseBody } from '../schemas/validate.js';

type DeliveryItem = {
  shortId: string;
  deliveryStatus: string;
  deliveryReason: string | null;
  deliveryUpdatedAt: Date;
};

function saveResponse(item: DeliveryItem): SaveResponse {
  // A process may disappear after sending but before recording acceptance.
  // An old pending state is uncertain; a replay must never resend it.
  const stale = item.deliveryStatus === 'pending'
    && Date.now() - item.deliveryUpdatedAt.getTime() > 120_000;
  return {
    shortId: item.shortId,
    cardUrl: `${process.env['BASE_URL']}/s/${item.shortId}`,
    saveStatus: 'saved',
    deliveryStatus: stale ? 'unknown' : item.deliveryStatus as SaveDeliveryStatus,
    deliveryReason: stale ? 'unconfirmed' : item.deliveryReason,
  };
}

export async function saveRoutes(app: FastifyInstance) {
  app.post('/api/saves', {
    preHandler: app.requireAuth,
    config: { rateLimit: {
      max: 60, timeWindow: '1 minute', hook: 'preHandler',
      keyGenerator: req => req.userId ?? req.ip,
    } },
  }, async (req, reply) => {
    const body = parseBody(saveBodySchema, req.body, reply);
    if (!body) return;

    let action;
    try {
      action = await claimSaveAction({
        partnerApiKey: body.partnerApiKey,
        url: body.url,
        title: body.title,
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
        userId: req.userId!,
        idempotencyKey: body.idempotencyKey ?? randomUUID(),
      });
    } catch (err) {
      if (err instanceof SaveActionError) {
        return reply.code(err.statusCode).send({ error: err.message });
      }
      app.log.error({ err }, 'Could not persist save action');
      return reply.code(503).send({ error: 'We could not save this item. Please try again.' });
    }

    reply.header('Cache-Control', 'private, no-store');
    // Replays never spend another quota unit, enqueue or send a second card.
    if (!action.created) return reply.code(200).send(saveResponse(action.item));

    const { item, user, partner } = action;
    void enqueueEnrichment(item.id)
      .catch(err => app.log.error({ err }, 'Failed to enqueue enrichment job'));

    let status: SaveDeliveryStatus = 'skipped';
    let reason: string | null = 'not_connected';
    let messageId: string | undefined;
    if (user.whatsappVerified && user.whatsappNumber) {
      try {
        const outcome = await sendSaveCard(
          req.userId!, user.whatsappNumber, item, partner.brandName ?? partner.name
        );
        status = outcome.status;
        reason = outcome.reason;
        if (outcome.status === 'accepted') messageId = outcome.messageId;
      } catch (err) {
        status = err instanceof WhatsAppSendError ? err.outcome : 'unknown';
        reason = status === 'failed' ? 'send_failed' : 'unconfirmed';
        app.log.warn({ saveId: item.id, status }, 'WhatsApp send was not confirmed');
      }
    }

    try {
      await updateSaveDelivery(item.id, status, reason, messageId);
    } catch (err) {
      app.log.error({ err, saveId: item.id }, 'Could not record save delivery outcome');
      // DB failure after provider acceptance must never trigger a resend.
    }
    return reply.code(201).send(saveResponse({
      ...item, deliveryStatus: status, deliveryReason: reason,
      deliveryUpdatedAt: new Date(),
    }));
  });

  app.get<{ Params: { shortId: string } }>('/api/saves/status/:shortId', {
    preHandler: app.requireAuth,
    config: { rateLimit: {
      max: 120, timeWindow: '1 minute', hook: 'preHandler',
      keyGenerator: req => req.userId ?? req.ip,
    } },
  }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    try {
      const item = await readOwnSaveDelivery(req.userId!, req.params.shortId);
      if (!item) return reply.code(404).send({ error: 'This saved item could not be found.' });
      return reply.send(saveResponse(item));
    } catch {
      app.log.warn('Could not look up save delivery status');
      return reply.code(503).send({ error: 'We could not check this message yet. Please try again.' });
    }
  });
}
