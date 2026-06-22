/** Generates OpenAI embeddings for many texts, batching to respect API limits. */
import { logger } from '@repo/logger';

import {
  BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from './constants.js';

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

const EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) throw new Error('OPEN_AI_API_KEY is not set');

  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch(EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      {
        tokens: result.usage.total_tokens,
        batchSize: batch.length,
        batchIndex: Math.floor(i / BATCH_SIZE),
      },
      'Generated embedding batch',
    );

    allEmbeddings.push(...result.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}
