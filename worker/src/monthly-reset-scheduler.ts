import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { db } from "@sor7ed/core";
import { sql } from "drizzle-orm";

const connection = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
const resetQueue = new Queue("monthly-reset", { connection });

// Fires at 00:05 on the 1st of each month. Without this, the atomic
// check-and-increment in /api/saves (WHERE saves_this_month <
// monthly_save_limit) permanently locks every partner out one calendar
// month after launch, with no recovery path.
await resetQueue.add("reset-save-counts", {}, { repeat: { pattern: "5 0 1 * *" }, jobId: "monthly-reset-singleton" });

export const monthlyResetWorker = new Worker(
  "monthly-reset",
  async () => {
    await db.execute(sql`UPDATE partners SET saves_this_month = 0`);
  },
  { connection }
);
