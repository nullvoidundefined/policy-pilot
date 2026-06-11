/** OpenAI text-embedding-3-small wrapper, matching the server embedding service. */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) throw new Error('OPEN_AI_API_KEY is not set');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
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
