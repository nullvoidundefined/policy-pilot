/** Shared web types for cited document chunks: the source passages the RAG pipeline returns and the UI renders as verifiable citations. */
export interface CitedChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  filename: string;
}
