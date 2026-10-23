import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import { attachDatabasePool } from "@vercel/functions";

const pool = new pg.Pool({
  connectionString: process.env["DATABASE_URL"],
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

if (process.env["VERCEL"]) attachDatabasePool(pool);

export const db = drizzle(pool, { schema, logger: process.env["NODE_ENV"] !== "production" });
