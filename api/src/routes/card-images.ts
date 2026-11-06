import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, savedItems, brandCardImage, renderSavedCardImage, validCardImageSignature } from '@sor7ed/core';

/** Signed image-only capabilities. Never expose the saved URL or account data. */
export async function cardImageRoutes(app: FastifyInstance) {
  app.get<{ Params: { shortId: string }; Querystring: { signature?: string } }>('/api/card-images/:shortId', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute', skipOnError: true, keyGenerator: req => `card-image:${(req.params as { shortId: string }).shortId}` } },
  }, async (req, reply) => {
    const { shortId } = req.params;
    if (shortId !== 'brand' && !validCardImageSignature(shortId, req.query.signature, process.env['JWT_SECRET'])) {
      return reply.code(403).send({ error: 'This image is not available.' });
    }
    let image: Buffer;
    if (shortId === 'brand') image = await brandCardImage();
    else {
      let source: string | null = null;
      try {
        const [item] = await db.select({ image: savedItems.imageUrl, cached: savedItems.cachedImageUrl })
          .from(savedItems).where(eq(savedItems.shortId, shortId)).limit(1);
        source = item?.image ?? item?.cached ?? null;
      } catch { /* A temporary lookup failure must not create a broken thumbnail. */ }
      image = await renderSavedCardImage(source);
    }
    return reply.header('Content-Type', 'image/jpeg').header('X-Content-Type-Options', 'nosniff')
      .header('X-Robots-Tag', 'noindex').header('Cache-Control', shortId === 'brand' ? 'public, max-age=86400' : 'private, max-age=300').send(image);
  });
}
