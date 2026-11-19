import { randomUUID } from 'node:crypto';
import { relaySignature } from '@sor7ed/core';
import { z } from 'zod';

const resource = z.object({
  title: z.string().min(1).max(500),
  url: z.string().url(),
  openUrl: z.string().url(),
  embedded: z.boolean(),
});
export async function resolvePlanetResource(slug: string, context: 'article' | 'tool') {
  const secret = process.env['WHATSAPP_RELAY_SECRET'];
  if (!secret) throw new Error('Resource connection unavailable');
  const body = JSON.stringify({ slug, context });
  const timestamp = String(Date.now());
  const id = randomUUID();
  const response = await fetch('https://www.planetsorted.com/api/button/resource', {
    method: 'POST', body, redirect: 'error',
    headers: {
      'content-type': 'application/json',
      'x-sor7ed-ts': timestamp, 'x-sor7ed-id': id,
      'x-sor7ed-signature': relaySignature(secret, 'resource', timestamp, id, body),
    }, signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('Resource unavailable');
  const result = resource.parse(await response.json());
  // Defence in depth: never turn this endpoint into a visitor-controlled URL proxy.
  for (const value of [result.url, result.openUrl]) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || !['www.planetsorted.com', 'www.sor7ed.com', 'gamma.app', 'gamma.site'].some(host => url.hostname === host || ((host === 'gamma.app' || host === 'gamma.site') && url.hostname.endsWith(`.${host}`)))) throw new Error('Invalid resource destination');
  }
  return result;
}
