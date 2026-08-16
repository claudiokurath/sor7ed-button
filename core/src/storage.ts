// Local-disk implementation for development. Swap the body of uploadImage
// for an S3/R2 PutObject call and update publicUrl to your CDN origin when
// deploying — nothing outside this file needs to change.
//
// UPLOAD_DIR is anchored to this file's own location (repo-root/uploads),
// not process.cwd(). enrichSavedItem — and therefore uploadImage — runs
// inside the worker process, while the static file server serving these
// images back out lives in the api process; each has a different cwd
// (worker/ vs api/), so a cwd-relative path would have the worker write
// files the api process would never find.
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "uploads");
await fs.mkdir(UPLOAD_DIR, { recursive: true });

export async function uploadImage(buffer: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const filename = `${crypto.randomBytes(8).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return publicUrl(filename);
}

// API_BASE_URL, not BASE_URL: this builds a URL served by the api process
// itself (/uploads/*), whereas BASE_URL elsewhere in the codebase (e.g.
// whatsapp/service.ts) refers to the *web* app's public origin, used for
// /s/<shortId> card links. Conflating the two would point uploaded-image
// URLs at the Next.js app, which has no /uploads/ route.
export function publicUrl(filename: string): string {
  const base = process.env["API_BASE_URL"] ?? "http://localhost:3001";
  return `${base}/uploads/${filename}`;
}
