/**
 * Public shapes for the chunker: the caller-supplied options and the chunk record
 * emitted for each token-bounded segment.
 */
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
