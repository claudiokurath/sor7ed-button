// Every step here is independently nullable and never throws upward: if
// Open Graph scraping fails, the save still exists with whatever the
// widget already supplied; if the image fetch fails, cachedImageUrl stays
// null and the template's fallback image is used; if OpenAI is
// unreachable, aiSummary/aiTags stay null.
//
// The OG scrape here is a regex-based fallback pass, not the primary data
// source — the widget already pulls title, description, image, and URL
// directly from the page's DOM before the user reaches the save page;
// this mainly backfills cases where a partner's widget integration is minimal.
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { savedItems } from "./schema.js";
import { uploadImage } from "./storage.js";
import { callOpenAi, generateEmbedding } from "./ai.js";

interface OgData {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

async function scrapeOg(url: string): Promise<OgData> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SOR7EDBot/1.0 (+https://sor7ed.com/bot)" },
      signal: AbortSignal.timeout(8_000),
    });
    const html = await res.text();
    const og = (prop: string): string | null =>
      html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, "i"))?.[1] ??
      null;
    return { title: og("title"), description: og("description"), imageUrl: og("image") };
  } catch {
    return { title: null, description: null, imageUrl: null };
  }
}

async function fetchAndResizeImage(imageUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    // 1200×630 is the canonical OG image size; "cover" avoids letterboxing.
    // 85% JPEG quality keeps the file comfortably under WhatsApp's
    // documented 5MB media-size limit for images sent via the API.
    return await sharp(buffer).resize(1200, 630, { fit: "cover", position: "centre" }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    return null;
  }
}

async function generateSummary(title: string, description: string | null): Promise<string | null> {
  return callOpenAi(
    `Write one sentence (max 20 words) summarising what this saved item is about.\nTitle: ${title}\nDescription: ${description ?? "none"}`,
    60
  );
}

async function generateTags(title: string, description: string | null): Promise<string[]> {
  const raw = await callOpenAi(
    `Return 3-5 lowercase tags for this content as a JSON array of strings, no explanation.\nTitle: ${title}\nDescription: ${description ?? "none"}`,
    30
  );
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export async function enrichSavedItem(itemId: string): Promise<void> {
  const [item] = await db.select().from(savedItems).where(eq(savedItems.id, itemId)).limit(1);
  if (!item) return;

  const og = await scrapeOg(item.url);
  const imageSource = og.imageUrl ?? item.imageUrl;
  let cachedImageUrl: string | null = null;
  if (imageSource) {
    const resized = await fetchAndResizeImage(imageSource);
    if (resized) cachedImageUrl = await uploadImage(resized, "image/jpeg");
  }

  const effectiveDescription = og.description ?? item.description;
  const [aiSummary, aiTags] = await Promise.all([
    generateSummary(item.title, effectiveDescription),
    generateTags(item.title, effectiveDescription),
  ]);

  // Embedding runs after the summary so it benefits from that extra
  // distillation, rather than working from raw title/description alone.
  const embeddingInput = [item.title, effectiveDescription, aiSummary].filter(Boolean).join(" ");
  const embedding = embeddingInput ? await generateEmbedding(embeddingInput) : null;

  await db
    .update(savedItems)
    .set({
      description: effectiveDescription ?? item.description,
      cachedImageUrl,
      aiSummary,
      aiTags,
      // A plain JS number[] is fine here — Drizzle's vector() column type
      // handles array-to-pgvector serialization automatically inside a
      // typed .set() call; the manual JSON.stringify + ::vector cast in
      // searchSavedItems below is only needed for raw SQL templates.
      //
      // Omitting the key entirely on failure (rather than setting it to
      // null) matters: Drizzle only writes keys present in the object, so
      // a transient OpenAI failure on re-enrichment leaves a previously-
      // good embedding untouched instead of overwriting it with NULL.
      // (Explicitly assigning `undefined` doesn't work here — under this
      // project's exactOptionalPropertyTypes: true, an optional property
      // means "present or absent," not "present with value undefined.")
      ...(embedding ? { embedding } : {}),
    })
    .where(eq(savedItems.id, itemId));
}
