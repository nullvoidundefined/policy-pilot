/**
 * Rough token estimate for English text via the ~4-chars-per-token heuristic; the
 * chunker uses it to keep raw segments and merged chunks within the token budget.
 */
import { CHARS_PER_TOKEN } from './constants.js';

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
