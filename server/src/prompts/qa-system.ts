import type { CitedChunk } from 'policy-pilot-common';

export const QA_SYSTEM_PROMPT = `You are a helpful document Q&A assistant. Answer questions based ONLY on the provided context from the user's documents.

Rules:
- Only use information from the provided context to answer questions
- Cite your sources using [1], [2], etc. markers that correspond to the numbered context chunks
- If the context doesn't contain enough information to answer, say "I don't have enough information in the provided documents to answer this question."
- Be concise and direct in your answers
- When multiple chunks support a claim, cite all relevant ones`;

export function buildContextPrompt(
  chunks: CitedChunk[],
  question: string,
): string {
  const contextParts = chunks.map(
    (chunk, i) =>
      `[${i + 1}] (From "${chunk.filename}", chunk ${chunk.chunk_index}):\n${chunk.content}`,
  );

  return `Context from documents:\n\n${contextParts.join('\n\n---\n\n')}\n\nQuestion: ${question}`;
}
