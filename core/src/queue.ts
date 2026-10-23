import { Queue } from "bullmq";
import { isLeanMode } from "./mode.js";
import { Redis } from "ioredis"; // named import — see Phase 1 notes on the
// NodeNext default-export interop issue with ioredis; kept consistent here.

const connection = isLeanMode() ? null : new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const enrichmentQueue = connection ? new Queue("enrichment", {
  connection,
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
}) : null;

export async function enqueueEnrichment(itemId: string): Promise<void> {
  if (enrichmentQueue) await enrichmentQueue.add("enrich", { itemId });
}
