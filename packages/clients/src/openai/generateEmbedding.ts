/** Generates a single OpenAI embedding; convenience wrapper over generateEmbeddings. */
import { generateEmbeddings } from './generateEmbeddings.js';

export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([text]);
  const embedding = embeddings[0];
  if (!embedding) throw new Error('No embedding returned');
  return embedding;
}
