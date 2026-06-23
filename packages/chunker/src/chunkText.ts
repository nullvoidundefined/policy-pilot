/**
 * Primary chunker entry point: splits document text into token-bounded segments via
 * the separator hierarchy, then merges adjacent segments and applies character
 * overlap so each emitted chunk carries context from the previous one.
 */
import {
  CHARS_PER_TOKEN,
  DEFAULT_MAX_TOKENS,
  DEFAULT_OVERLAP_TOKENS,
  DEFAULT_SEPARATORS,
} from './constants.js';
import { estimateTokens } from './estimateTokens.js';
import { recursiveSplit } from './recursiveSplit.js';
import type { ChunkOptions, TextChunk } from './types.js';

export function chunkText(
  text: string,
  options: ChunkOptions = {},
): TextChunk[] {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const overlapTokens = options.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const separators = options.separators ?? DEFAULT_SEPARATORS;

  // Split into raw segments
  const rawSegments = recursiveSplit(text, separators, maxTokens);

  // Merge small segments and apply overlap
  const chunks: TextChunk[] = [];
  let currentContent = '';

  for (const segment of rawSegments) {
    const combined = currentContent + segment;
    if (estimateTokens(combined) > maxTokens && currentContent.length > 0) {
      // Flush current chunk
      chunks.push({
        content: currentContent.trim(),
        index: chunks.length,
        tokenCount: estimateTokens(currentContent.trim()),
      });

      // Apply overlap: take the last overlapTokens worth of chars
      const overlapChars = overlapTokens * CHARS_PER_TOKEN;
      const overlap = currentContent.slice(-overlapChars);
      currentContent = overlap + segment;
    } else {
      currentContent = combined;
    }
  }

  // Flush remaining
  if (currentContent.trim().length > 0) {
    chunks.push({
      content: currentContent.trim(),
      index: chunks.length,
      tokenCount: estimateTokens(currentContent.trim()),
    });
  }

  return chunks;
}
