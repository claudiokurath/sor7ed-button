import { createHmac, timingSafeEqual } from 'node:crypto';

export function relaySignature(secret: string, purpose: string, timestamp: string, id: string, body: string) {
  return createHmac('sha256', secret).update(`${purpose}\n${timestamp}\n${id}\n${body}`).digest('hex');
}
export function verifyRelay(secret: string | undefined, purpose: string, timestamp: string | undefined, id: string | undefined, body: string, signature: string | undefined, now = Date.now()) {
  if (!secret || !timestamp || !/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300_000 || !id || !/^[a-zA-Z0-9_-]{16,100}$/.test(id) || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(relaySignature(secret, purpose, timestamp, id, body)), Buffer.from(signature));
}
