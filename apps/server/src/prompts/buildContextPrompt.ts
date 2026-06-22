/** Assembles the numbered-context user prompt from retrieved chunks for the QA completion. */
import type { CitedChunk } from '@repo/types';

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
