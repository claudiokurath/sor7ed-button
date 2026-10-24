import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "./client.js";
import { users, whatsappSigninChallenges as challenges } from "./schema.js";

const secret = () => {
  const value = process.env["SIGNIN_SECRET"] ?? process.env["JWT_SECRET"];
  if (!value) throw new Error("Sign-in secret unavailable");
  return value;
};
export function signinHash(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}
export async function createSigninChallenge() {
  const token = randomBytes(24).toString("hex").toUpperCase();
  const proof = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 600_000);
  const [row] = await db
    .insert(challenges)
    .values({
      tokenHash: signinHash(token),
      proofHash: signinHash(proof),
      expiresAt,
    })
    .returning({ id: challenges.id });
  if (!row) throw new Error("Challenge unavailable");
  // Bounded opportunistic expiry cleanup; no scheduler required.
  await db
    .execute(
      sql`DELETE FROM whatsapp_signin_challenges WHERE id IN (
    SELECT id FROM whatsapp_signin_challenges WHERE expires_at < now() - interval '1 day' LIMIT 100
  )`,
    )
    .catch(() => undefined);
  return { ...row, token, proof, expiresAt };
}

/** Called ONLY after raw Meta signature verification. A webhook replay cannot
 * issue another code or switch the phone attached to an existing challenge. */
export async function prepareSigninCode(token: string, phone: string) {
  if (!/^[A-F0-9]{48}$/.test(token) || !/^\d{7,15}$/.test(phone)) return null;
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const [row] = await db
    .update(challenges)
    .set({ phone, codeHash: signinHash(`${token}:${code}`) })
    .where(
      sql`${challenges.tokenHash} = ${signinHash(token)} AND ${challenges.codeHash} IS NULL
      AND ${challenges.consumedAt} IS NULL AND ${challenges.expiresAt} > now()`,
    )
    .returning({ id: challenges.id });
  return row ? code : null;
}

export async function consumeSigninChallenge(
  id: string,
  token: string,
  proof: string,
  code: string,
) {
  return db.transaction(async (tx) => {
    // Row lock serializes wrong attempts and simultaneous successful submits.
    const rows = await tx
      .select()
      .from(challenges)
      .where(eq(challenges.id, id))
      .for("update");
    const row = rows[0];
    if (
      !row ||
      row.consumedAt ||
      row.expiresAt.getTime() <= Date.now() ||
      row.attempts >= 5
    )
      return null;
    if (
      row.proofHash !== signinHash(proof) ||
      row.tokenHash !== signinHash(token)
    )
      return null;
    const candidate = signinHash(`${token}:${code}`);
    const valid =
      row.codeHash &&
      timingSafeEqual(Buffer.from(row.codeHash), Buffer.from(candidate));
    await tx
      .update(challenges)
      .set({ attempts: row.attempts + 1 })
      .where(eq(challenges.id, id));
    if (!valid || !row.phone) return null;
    const [user] = await tx
      .insert(users)
      .values({
        whatsappNumber: row.phone,
        whatsappVerified: true,
        lastInboundMessageAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.whatsappNumber,
        set: { whatsappVerified: true, lastInboundMessageAt: new Date() },
      })
      .returning({ id: users.id });
    await tx
      .update(challenges)
      .set({ consumedAt: new Date(), codeHash: null, phone: null })
      .where(eq(challenges.id, id));
    return user ?? null;
  });
}
