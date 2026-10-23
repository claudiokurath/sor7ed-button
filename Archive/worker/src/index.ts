import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { enrichSavedItem, assertRequiredEnv } from "@sor7ed/core";
import { reminderWorker } from "./reminder-scheduler.js";
import { monthlyResetWorker } from "./monthly-reset-scheduler.js";

assertRequiredEnv("worker");

const connection = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const enrichmentWorker = new Worker(
  "enrichment",
  async (job) => {
    if (job.name === "enrich" && typeof job.data.itemId === "string") {
      await enrichSavedItem(job.data.itemId);
    }
  },
  { connection, concurrency: 3 }
);

enrichmentWorker.on("failed", (job, err) => console.error(`Enrichment job ${job?.id} failed:`, err));
enrichmentWorker.on("completed", (job) => console.log(`Enrichment job ${job?.id} completed`));

// Imported for their side effects — the repeatable job registration and
// the Worker instance both run at import time.
void reminderWorker;
void monthlyResetWorker;

console.log("SOR7ED BUTTON worker running (enrichment + reminders + monthly reset)");
