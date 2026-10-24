// One-off script — run manually with tsx from the repo root:
//   npx tsx core/src/scripts/backfill-embeddings.ts
// Re-enqueues every saved_items row with no embedding through the same
// enrichment queue new saves already go through, rather than building a
// second, bespoke embedding-only path.
import { db, savedItems, enqueueEnrichment } from "../index.js";
import { isNull } from "drizzle-orm";

const stale = await db.select({ id: savedItems.id }).from(savedItems).where(isNull(savedItems.embedding));
for (const item of stale) await enqueueEnrichment(item.id);
console.log(`Enqueued ${stale.length} items for re-enrichment.`);
process.exit(0);
