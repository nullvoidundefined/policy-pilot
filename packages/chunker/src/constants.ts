/**
 * Chunker tuning constants: the char-per-token heuristic and the default token,
 * overlap, and separator settings chunkText falls back to when a caller omits them.
 */
export const CHARS_PER_TOKEN = 4;
export const DEFAULT_MAX_TOKENS = 500;
export const DEFAULT_OVERLAP_TOKENS = 50;
export const DEFAULT_SEPARATORS: string[] = ['\n\n', '\n', '. ', ' '];
