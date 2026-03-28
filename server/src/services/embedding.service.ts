import { logger } from 'app/utils/logs/logger.js';

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) throw new Error('OPEN_AI_API_KEY is not set');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
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
    { tokens: result.usage.total_tokens, count: texts.length },
    'Generated embeddings',
  );

  return result.data.map((d) => d.embedding);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([text]);
  const embedding = embeddings[0];
  if (!embedding) throw new Error('No embedding returned');
  return embedding;
}

export { EMBEDDING_DIMENSIONS };
