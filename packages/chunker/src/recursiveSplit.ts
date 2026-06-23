/**
 * Recursively splits text down the separator hierarchy until each segment fits the
 * token budget, hard-splitting by characters when no separator applies; produces
 * the raw segments chunkText then merges with overlap.
 */
import { estimateTokens } from './estimateTokens.js';
import { hardSplitByChars } from './hardSplitByChars.js';
import { splitBySeparator } from './splitBySeparator.js';

export function recursiveSplit(
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
    const segments: string[] = [];

    for (const part of parts) {
      if (estimateTokens(part) <= maxTokens) {
        segments.push(part);
      } else {
        // Try next separator
        const remaining = separators.slice(separators.indexOf(separator) + 1);
        if (remaining.length > 0) {
          segments.push(...recursiveSplit(part, remaining, maxTokens));
        } else {
          // Last resort: hard split by character count
          segments.push(...hardSplitByChars(part, maxTokens));
        }
      }
    }

    return segments;
  }

  // No separator found, hard split
  return hardSplitByChars(text, maxTokens);
}
