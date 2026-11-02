import { createHmac, timingSafeEqual } from "node:crypto";
export function validClickProof(
  shortId: string,
  time: unknown,
  visitor: unknown,
  signature: unknown,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (
    !secret ||
    typeof time !== "string" ||
    !/^\d{13}$/.test(time) ||
    typeof visitor !== "string" ||
    !/^[a-f0-9]{64}$/.test(visitor) ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const age = now - Number(time);
  if (age < -30_000 || age > 300_000) return false;
  const expected = createHmac("sha256", secret)
    .update(`${shortId}.${time}.${visitor}`)
    .digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
