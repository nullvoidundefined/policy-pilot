/** OpenAI embedding configuration shared across the embedding client functions. */
export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
export const BATCH_SIZE = 100;
