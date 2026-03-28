export interface ChunkOptions {
  maxTokens?: number;
  overlapTokens?: number;
  separators?: string[];
}

export interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
}

const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 50;
const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', ' '];

// Rough token count: ~4 chars per token for English text
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitBySeparator(text: string, separator: string): string[] {
  const parts = text.split(separator);
  // Re-attach separator to end of each part (except last)
  return parts
    .map((part, i) => (i < parts.length - 1 ? part + separator : part))
    .filter((part) => part.trim().length > 0);
}

function recursiveSplit(
  text: string,
  separators: string[],
  maxTokens: number,
): string[] {
  if (estimateTokens(text) <= maxTokens) {
    return [text];
  }

  for (const separator of separators) {
    if (!text.includes(separator)) continue;

    const parts = splitBySeparator(text, separator);
    const result: string[] = [];

    for (const part of parts) {
      if (estimateTokens(part) <= maxTokens) {
        result.push(part);
      } else {
        // Try next separator
        const remaining = separators.slice(separators.indexOf(separator) + 1);
        if (remaining.length > 0) {
          result.push(...recursiveSplit(part, remaining, maxTokens));
        } else {
          // Last resort: hard split by character count
          const maxChars = maxTokens * 4;
          for (let i = 0; i < part.length; i += maxChars) {
            result.push(part.slice(i, i + maxChars));
          }
        }
      }
    }

    return result;
  }

  // No separator found, hard split
  const maxChars = maxTokens * 4;
  const result: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    result.push(text.slice(i, i + maxChars));
  }
  return result;
}

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
      const overlapChars = overlapTokens * 4;
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
