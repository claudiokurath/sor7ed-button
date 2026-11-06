import { createHmac, timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';
import { fetchPublicImage } from './public-image-fetch.js';
import { CARD_BRAND_MARK } from './brand-mark.js';

const ID = /^[a-zA-Z0-9_-]{8,40}$/;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_PIXELS = 16_000_000;
let brand: Promise<Buffer> | undefined;

function signature(shortId: string, secret: string): string {
  return createHmac('sha256', secret).update(`sor7ed-card-image-v1\n${shortId}`).digest('hex');
}
export function validCardImageSignature(shortId: string, value: string | undefined, secret: string | undefined): boolean {
  return !!secret && ID.test(shortId) && typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) &&
    timingSafeEqual(Buffer.from(signature(shortId, secret), 'hex'), Buffer.from(value, 'hex'));
}
export function savedCardImageUrl(shortId: string): string {
  const secret = process.env['JWT_SECRET'];
  const base = new URL(process.env['API_BASE_URL'] || '');
  if (!secret || !ID.test(shortId) || base.protocol !== 'https:' || base.username || base.password) throw new Error('Card images are not configured.');
  const url = new URL(`/api/card-images/${shortId}`, base);
  url.searchParams.set('signature', signature(shortId, secret));
  return url.href;
}

async function canvas(image: Buffer): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 630, channels: 3, background: '#000000' } })
    .composite([{ input: image, gravity: 'centre' }]).jpeg({ quality: 88 }).toBuffer();
}
export function brandCardImage(): Promise<Buffer> {
  brand ??= sharp(Buffer.from(CARD_BRAND_MARK), { density: 288 }).resize(400, 400).png().toBuffer().then(canvas);
  return brand;
}

async function boundedImage(response: Response): Promise<Buffer> {
  if (!response.ok || !/^image\/(jpeg|png|webp)(?:;|$)/i.test(response.headers.get('content-type') || '') ||
    Number(response.headers.get('content-length') || 0) > MAX_BYTES || !response.body) {
    await response.body?.cancel();
    throw new Error('No suitable image');
  }
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('Image too large');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}

async function sourceCardImage(source: string | null | undefined, signal: AbortSignal): Promise<Buffer> {
  const url = new URL(source || '');
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('No public image');
  // The image fetch pins the TLS connection to approved public DNS results.
  const bytes = await boundedImage(await fetchPublicImage(url.href, { signal }));
  const raster = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
    bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
    (bytes.subarray(0,4).toString('ascii') === 'RIFF' && bytes.subarray(8,12).toString('ascii') === 'WEBP');
  if (!raster) throw new Error('Not a supported raster image');
  const image = sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: 'warning' });
  const meta = await image.metadata();
  if (!['jpeg','png','webp'].includes(meta.format || '') || !meta.width || !meta.height || meta.width < 600 || meta.height < 315 ||
    (meta.pages || 1) > 1 || meta.width / meta.height > 4 || meta.height / meta.width > 4) throw new Error('Image is too small or unsuitable');
  // Fit inside the frame and pad; never stretch, crop or upscale a small logo.
  const fitted = await image.rotate().resize(1200, 630, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  return canvas(fitted);
}

/** Public OG media only: no cookies, page screenshots or authenticated page fetches. */
export async function renderSavedCardImage(source: string | null | undefined): Promise<Buffer> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Bound DNS resolution as well as transfer/decoding, so a slow site cannot
    // prevent Meta receiving the branded fallback promptly.
    return await Promise.race([
      sourceCardImage(source, controller.signal),
      new Promise<Buffer>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Image timed out')); }, 4000);
      }),
    ]);
  } catch { return brandCardImage(); }
  finally { if (timer) clearTimeout(timer); }
}
