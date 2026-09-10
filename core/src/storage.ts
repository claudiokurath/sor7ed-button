// Two backends, selected at import time by whether R2_BUCKET is set:
//
// - R2/S3 (production): uploadImage does a real PutObject. Required
//   because enrichSavedItem runs in the worker process while the static
//   file server for local-disk uploads lives in the api process — on
//   separate Fly machines (or any two-process deploy), those are two
//   different disks. A worker-written file was silently invisible to the
//   api's /uploads/* route. This was flagged as a known gap in DEPLOY.md
//   ("Do not expect worker-written files to appear on api.sor7ed.com/
//   uploads/* until B or C") — this is option B, now the default rather
//   than a manual follow-up.
//
// - Local disk (dev fallback only): kept for zero-config `npm run dev`
//   without needing an R2 bucket. Refuses to run this path in production
//   (see the guard below) specifically to stop the split-brain bug from
//   silently reappearing in a future deploy that forgets to set R2_BUCKET.
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const bucket = process.env["R2_BUCKET"];
const usingR2 = Boolean(bucket);

if (!usingR2 && process.env["NODE_ENV"] === "production") {
  // Thrown at import time, not just logged — a production boot with no
  // R2_BUCKET set is exactly the split-brain-uploads bug reappearing, and
  // failing fast here is far cheaper than debugging silently-missing
  // images across two Fly machines after the fact.
  throw new Error(
    "R2_BUCKET is not set. Local-disk uploads are dev-only — api and worker " +
      "do not share a filesystem in production. Set R2_BUCKET, R2_ACCOUNT_ID, " +
      "R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_PUBLIC_URL."
  );
}

// R2's S3-compatible endpoint is account-scoped, not bucket-scoped:
// https://<account_id>.r2.cloudflarestorage.com — this works unmodified
// against real AWS S3 too (S3_ENDPOINT would just be unset, and the SDK
// falls back to its own AWS endpoint resolution), so this file also
// covers "swap to plain S3" with no code change, just different env vars.
const s3 = usingR2
  ? new S3Client({
      region: "auto",
      endpoint: process.env["R2_ENDPOINT"] ?? `https://${process.env["R2_ACCOUNT_ID"]}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env["R2_ACCESS_KEY_ID"] ?? "",
        secretAccessKey: process.env["R2_SECRET_ACCESS_KEY"] ?? "",
      },
    })
  : null;

// Local-disk path, anchored to this file's own location (repo-root/uploads)
// rather than process.cwd() — see the historical note this replaces above.
// Kept only as the dev-mode fallback.
const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "uploads");
if (!usingR2) await fs.mkdir(UPLOAD_DIR, { recursive: true });

export async function uploadImage(buffer: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const filename = `${crypto.randomBytes(8).toString("hex")}.${ext}`;

  if (usingR2 && s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: filename,
        Body: buffer,
        ContentType: mimeType,
        // 1 year — these are immutable, randomly-named objects (never
        // overwritten at the same key), so aggressive caching is safe.
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    return publicUrl(filename);
  }

  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return publicUrl(filename);
}

// R2_PUBLIC_URL is the bucket's public dev URL or a custom domain mapped
// to it in the Cloudflare dashboard — R2 objects aren't served from the
// S3-compatible API endpoint used above for writes. Falls back to the
// api process's own /uploads/* static route only in the local-disk case.
export function publicUrl(filename: string): string {
  if (usingR2) {
    const base = process.env["R2_PUBLIC_URL"];
    if (!base) throw new Error("R2_PUBLIC_URL is not set (required alongside R2_BUCKET)");
    return `${base.replace(/\/$/, "")}/${filename}`;
  }
  const base = process.env["API_BASE_URL"] ?? "http://localhost:3001";
  return `${base}/uploads/${filename}`;
}

// api/src/index.ts only registers the /uploads/* static route in the
// local-disk case — exported so it can decide that without duplicating
// the usingR2 check.
export const isUsingLocalDiskUploads = !usingR2;
export { UPLOAD_DIR };
