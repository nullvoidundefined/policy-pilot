/** OpenAI text-embedding-3-small wrapper, matching the server embedding service. */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const OPEN_AI_API_KEY_ENV = 'OPEN_AI_API_KEY';

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env[OPEN_AI_API_KEY_ENV];
  if (!apiKey) throw new Error(`${OPEN_AI_API_KEY_ENV} is not set`);

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: [text],
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding API error (${response.status}): ${body}`);
  }

  const result = (await response.json()) as EmbeddingResponse;
  const embedding = result.data[0]?.embedding;
  if (!embedding) throw new Error('No embedding returned');
  return embedding;
}
