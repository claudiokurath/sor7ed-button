import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { getPendingReminders, sendReminder, db, savedItems } from "@sor7ed/core";
import { eq } from "drizzle-orm";

const connection = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const reminderQueue = new Queue("reminders", { connection });

// Registering with a fixed jobId makes this idempotent across worker
// restarts — re-registering the same repeatable job on every boot doesn't
// create duplicate schedules.
await reminderQueue.add("check-reminders", {}, { repeat: { pattern: "*/5 * * * *" }, jobId: "reminder-check-singleton" });

export const reminderWorker = new Worker(
  "reminders",
  async () => {
    const pending = await getPendingReminders();

    for (const item of pending) {
      if (!item.userWhatsappVerified || !item.userPhone) {
        // No verified number ever will exist for this row without a
        // separate reconnection event — retrying won't help, so mark it
        // sent to stop the noise rather than retrying forever.
        await db.update(savedItems).set({ reminderSent: true }).where(eq(savedItems.id, item.id));
        continue;
      }

      try {
        await sendReminder(item.userPhone, { title: item.title, shortId: item.shortId });
        await db.update(savedItems).set({ reminderSent: true }).where(eq(savedItems.id, item.id));
      } catch (err) {
        // Deliberately left unmarked — retried on the next tick. A
        // transient Meta outage self-heals; a permanently broken number
        // retries forever until a bounded-attempts counter is added,
        // which isn't worth solving before this ships.
        console.error(`Failed to send reminder for item ${item.id}:`, err);
      }
    }
  },
  { connection }
);
