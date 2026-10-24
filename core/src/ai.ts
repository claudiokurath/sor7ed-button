import { isLeanMode } from "./mode.js";

export async function callOpenAi(prompt: string, maxTokens: number): Promise<string | null> {
  if (isLeanMode()) return null;
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

// text-embedding-3-small's default output is already 1536 dimensions,
// matching the schema's vector(1536) column and its HNSW index — but
// requesting it explicitly means a future model swap can't silently
// produce a mismatched vector size without a visible code change.
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (isLeanMode()) return null;
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text, dimensions: 1536 }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Array<{ embedding: number[] }> };
    return json.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}
