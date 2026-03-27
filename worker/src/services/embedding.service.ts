import { logger } from "app/utils/logger.js";

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 100;

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.EMBEDDING_API_KEY;
  if (!apiKey) throw new Error("EMBEDDING_API_KEY is not set");

  const allEmbeddings: number[][] = [];

  // Process in batches to avoid API limits
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: batch,
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Embedding API error (${response.status}): ${errorBody}`);
    }

    const result = (await response.json()) as EmbeddingResponse;
    logger.info(
      { tokens: result.usage.total_tokens, batchSize: batch.length, batchIndex: Math.floor(i / BATCH_SIZE) },
      "Generated embedding batch",
    );

    allEmbeddings.push(...result.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}

export { EMBEDDING_DIMENSIONS };
