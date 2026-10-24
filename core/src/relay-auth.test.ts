import { describe, expect, it } from 'vitest';
import { relaySignature, verifyRelay } from './relay-auth.js';
describe('shared WhatsApp relay authentication', () => {
  it('binds purpose, body and action with a five-minute window', () => {
    const secret = 'fixture-secret', time = String(Date.now()), id = 'a'.repeat(64), body = '{"message":"fixture"}';
    const signature = relaySignature(secret, 'inbound', time, id, body);
    expect(verifyRelay(secret, 'inbound', time, id, body, signature)).toBe(true);
    expect(verifyRelay(secret, 'outbound', time, id, body, signature)).toBe(false);
    expect(verifyRelay(secret, 'inbound', time, id, body + ' ', signature)).toBe(false);
    expect(verifyRelay(secret, 'inbound', time, id, body, signature, Number(time) + 300001)).toBe(false);
    expect(verifyRelay(undefined, 'inbound', time, id, body, signature)).toBe(false);
  });
});
