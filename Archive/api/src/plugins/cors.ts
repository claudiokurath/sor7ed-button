import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

export async function registerCors(app: FastifyInstance): Promise<void> {
  await app.register(cors, {
    origin: [process.env["WEB_ORIGIN"] ?? "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  });
}
