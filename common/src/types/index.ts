// Document statuses
export type DocumentStatus =
  | 'uploaded'
  | 'chunking'
  | 'embedding'
  | 'ready'
  | 'failed';

// Database row types
export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  filename: string;
  r2_key: string;
  mime_type: string;
  size_bytes: number;
  status: DocumentStatus;
  total_chunks: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: string;
  document_id: string;
  user_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  created_at: string;
  // embedding stored in pgvector, not returned in queries unless needed
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  cited_chunk_ids: string[];
  created_at: string;
}

// API types
export interface DocumentUploadResponse {
  document: Document;
}

export interface DocumentListResponse {
  documents: Document[];
}

export interface QARequest {
  question: string;
  conversation_id?: string;
  document_ids?: string[];
}

export interface CitedChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  filename: string;
}

// SSE event types
export interface QATokenEvent {
  type: 'token';
  token: string;
}

export interface QACitationsEvent {
  type: 'citations';
  citations: CitedChunk[];
}

export interface QADoneEvent {
  type: 'done';
  conversation_id: string;
  message_id: string;
}

export interface QAErrorEvent {
  type: 'error';
  message: string;
}

export type QAStreamEvent =
  | QATokenEvent
  | QACitationsEvent
  | QADoneEvent
  | QAErrorEvent;

// Worker job types
export interface DocumentProcessJob {
  documentId: string;
  userId: string;
  r2Key: string;
  mimeType: string;
}
