// Single shared helper so every route validates + reports errors the same
// way, rather than each route hand-rolling its own zod .parse()/try-catch.
// Returns null (and has already sent the 400) on failure — callers should
// `if (!body) return;` immediately after calling this.
import type { FastifyReply } from "fastify";
import type { ZodTypeAny, output } from "zod";

export function parseBody<Schema extends ZodTypeAny>(schema: Schema, body: unknown, reply: FastifyReply): output<Schema> | null {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  // .flatten().fieldErrors gives a { field: [messages] } shape — useful
  // enough for a partner integrating the API to self-diagnose, without
  // leaking zod's own internal issue-object structure verbatim.
  reply.code(400).send({ error: "Invalid request body", details: result.error.flatten().fieldErrors });
  return null;
}
