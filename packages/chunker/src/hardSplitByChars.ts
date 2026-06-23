/**
 * Last-resort fallback that slices text into fixed-size character windows when no
 * separator can break it under the token limit; shared by both recursiveSplit
 * fallback paths so the windowing stays identical.
 */
import { CHARS_PER_TOKEN } from './constants.js';

export function hardSplitByChars(text: string, maxTokens: number): string[] {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const segments: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    segments.push(text.slice(i, i + maxChars));
  }
  return segments;
}
