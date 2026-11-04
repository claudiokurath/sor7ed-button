import type { Draft } from './draft';

/** A URL fragment alone cannot authorize automatic delivery. */
export function hasExtensionApproval(storage: Storage, draft: Draft, now = Date.now()): boolean {
  try {
    const value = JSON.parse(storage.getItem(`sor7ed:approved:${draft.flowId}`) || 'null');
    return value?.url === draft.url && typeof value.expiresAt === 'number' &&
      value.expiresAt > now && value.expiresAt <= now + 30 * 60_000;
  } catch { return false; }
}
