# App 4: Document Q&A (RAG)

**Weeks 7-8 | Ships May 13**
**Repo:** `doc-qa-rag`

## Product Summary

Upload PDFs and documents. A background pipeline chunks them, generates embeddings, and stores vectors in pgvector. Users ask natural language questions and get grounded answers with source citations pointing to specific document sections.

## Hosting & Infrastructure

| Service      | Provider             | Notes                             |
| ------------ | -------------------- | --------------------------------- |
| Frontend     | Railway              | Next.js (Dockerfile.web)          |
| API Server   | Railway              | Express + TypeScript              |
| Worker       | Railway              | BullMQ document processing worker |
| Database     | Neon                 | PostgreSQL + pgvector extension   |
| File Storage | Cloudflare R2        | S3-compatible, free egress        |
| Queue        | Railway Redis        | BullMQ                            |
| Auth         | Custom session-based | Same pattern                      |
| LLM          | Anthropic Claude API | Completions + embeddings          |
| Embeddings   | Voyage AI or OpenAI  | Dedicated embedding model         |

**Neon + pgvector:** Neon supports the pgvector extension natively. Enable it with `CREATE EXTENSION vector;`. No separate vector DB needed for this scale.

**Cloudflare R2:** S3-compatible API, zero egress fees. Use the AWS SDK with R2's endpoint. This replaces MinIO for production.

## Project Setup

Start from **Next.js + Express template** pattern (see app-8 `agentic-travel-agent` for reference). Monorepo with pnpm workspaces.

Workspace packages: `apps/server/`, `apps/worker/`, `apps/client/web/`, `packages/common/`

## Core User Stories

1. As a user, I can upload PDF and text documents (up to 10MB each).
2. As a user, I can see processing status (uploaded, chunking, embedding, ready, failed).
3. As a user, I can ask questions about my documents and get streaming answers with citations.
4. As a user, I can click a citation to see the source chunk in context.
5. As a user, I can manage my document library (list, delete, re-process).

## Infrastructure

**Frontend:** Next.js on Railway (Dockerfile.web)
**API Server:** Express + TypeScript on Railway
**Auth:** Custom session-based (cookie + DB hash)
**Database:** Neon PostgreSQL + pgvector extension
**File Storage:** Cloudflare R2 (S3-compatible, zero egress fees)
**Queue:** Railway Redis + BullMQ

## System Design

```
Next.js Frontend (Railway)
  |
  +-- Upload form (multipart) --> POST /api/documents
  +-- Document list --> GET /api/documents
  +-- Q&A chat --> POST /api/qa (SSE streaming)
  +-- Citation viewer --> expand citation to see source chunk

Express API Server (Railway)
  |
  +-- Document upload
  |     +-- Multipart handling (multer, memory storage)
  |     +-- Upload to Cloudflare R2
  |     +-- Create document record
  |     +-- Enqueue processing job
  |
  +-- Q&A endpoint (SSE)
  |     +-- Generate embedding for the question
  |     +-- Vector similarity search in pgvector (top-k, user-scoped)
  |     +-- Assemble prompt: system + retrieved chunks + question
  |     +-- Stream response with citation markers
  |     +-- Persist Q&A exchange
  |
  +-- Document management (list, delete, re-process)
  +-- Conversation management (list threads, get messages)

BullMQ Worker (Railway)
  |
  +-- document-process queue
        +-- Download from R2
        +-- Extract text (pdf-parse for PDFs, raw for txt/md)
        +-- Chunk text (recursive splitter, ~500 tokens, 50-token overlap)
        +-- Generate embeddings (batch, via embedding API)
        +-- Store chunks + embeddings in pgvector
        +-- Update document status to "ready"

PostgreSQL + pgvector (Neon)
  +-- users
  +-- documents (id, user_id, filename, r2_key, mime_type, size_bytes,
                 status, total_chunks, error, created_at)
  +-- chunks (id, document_id, user_id, chunk_index, content, token_count,
              embedding vector(1536), created_at)
  +-- conversations (id, user_id, title, created_at)
  +-- messages (id, conversation_id, role, content, cited_chunk_ids[], created_at)

Cloudflare R2
  +-- documents/{user_id}/{document_id}/{filename}

Redis (Railway)
  +-- BullMQ queue: document-process
```

### AI Integration Detail

- **Chunking:** Recursive character text splitter, ~500 tokens per chunk, 50-token overlap. Preserve paragraph boundaries. Store position index for citation references.
- **Embeddings:** Use Voyage AI (voyage-3-large, 1024 dims) or OpenAI (text-embedding-3-small, 1536 dims). Batch embed chunks to minimize API calls.
- **Retrieval:** Embed the question, cosine similarity search (`<=>` in pgvector), top 5-8 chunks, filtered to user's documents only.
- **Prompt assembly:** System prompt: "Answer based only on provided context. Cite sources using [1], [2] markers. Say 'I don't have enough information' when context doesn't support an answer."
- **Streaming with citations:** SSE stream. Citations are inline markers. Frontend parses markers and renders as clickable badges.
- **pgvector indexing:** HNSW index on embedding column for fast ANN search. Rebuild periodically as corpus grows.

## Tasks

### POC (Days 1-3): Upload a doc, ask a question, get an answer

Deliver the full RAG loop end-to-end: a user uploads a PDF via the frontend, the file is stored in R2, a BullMQ worker extracts text, chunks it, generates embeddings, and stores vectors in pgvector. The user then asks a natural language question through a chat input, the API embeds the question, performs vector similarity search, assembles a grounded prompt with retrieved chunks, and streams a cited answer back to the browser. Deploy API, worker, and frontend on Railway.

- [ ] Scaffold from templates (API + worker + web)
- [ ] Enable pgvector extension on Neon
- [ ] PostgreSQL schema: documents, chunks + migrations
- [ ] R2 setup: bucket, credentials, AWS SDK config
- [ ] POST /documents: upload PDF, store in R2, create record
- [ ] Worker: download from R2, extract text, chunk, embed, store in pgvector
- [ ] POST /qa: embed question, vector search, assemble prompt, stream answer
- [ ] Frontend: upload form + basic chat input + streaming response
- [ ] Deploy: API, worker, and frontend on Railway

### Week 1 Remainder: Pipeline robustness

Deliver a robust document processing pipeline that tracks status through all stages (uploaded/chunking/embedding/ready/failed), supports PDF, plain text, and Markdown formats, uses a configurable chunking service with batch embedding to minimize API calls, and includes an HNSW index on pgvector for fast approximate nearest neighbor search. Add document management endpoints (list with status, delete with cascade through chunks + embeddings + R2 objects, re-process), and conversation persistence to save Q&A threads.

- [ ] Document status tracking through pipeline stages
- [ ] PDF text extraction (pdf-parse)
- [ ] Text file and Markdown support
- [ ] Chunking service with configurable parameters
- [ ] Batch embedding (minimize API calls)
- [ ] pgvector HNSW index
- [ ] Document list endpoint with status
- [ ] Document delete (cascade: chunks + embeddings + R2 object)
- [ ] Re-process endpoint
- [ ] Conversation persistence (save Q&A threads)

### Week 2: Frontend + Citations + Polish

Deliver a polished Next.js frontend with a drag-and-drop document upload showing progress and status badges, a document library view, a chat interface with a conversation sidebar for managing threads, streaming response display, and a citation system where inline [1], [2] markers render as clickable badges that expand to show the source chunk and link to the original document. Add search/filter for documents by name and type. Ship with integration tests covering the upload-to-retrieval pipeline and streaming accuracy, plus a README documenting the RAG architecture.

- [ ] Document upload UI with drag-and-drop, progress, status badges
- [ ] Document library view (list, status, metadata)
- [ ] Chat interface with conversation sidebar
- [ ] Streaming response display
- [ ] Citation badge rendering (clickable, inline)
- [ ] Citation expansion: show source chunk + link to document
- [ ] Conversation history (list threads, resume threads)
- [ ] Search/filter documents by name, type
- [ ] Integration tests: upload, chunking, retrieval accuracy, streaming
- [ ] README: RAG architecture, chunking strategy, retrieval flow, pgvector setup
- [ ] Final deploy

## Key Decisions to Document

- Chunking parameters: why ~500 tokens, why overlap, paragraph boundary handling
- Embedding model choice and dimension tradeoffs
- pgvector index type (HNSW vs IVFFlat) and rebuild strategy
- Retrieval: top-k value, similarity threshold, re-ranking approach
- Prompt design for grounded answers
- What happens when context doesn't contain the answer
- Cost per document: embedding generation + storage

## Claude Code Implementation Notes

POC: upload one PDF -> process -> ask one question -> get streaming answer with at least one citation. That's the full RAG loop. Everything else is polish.

The chunking service is reusable in App 7. Build it as an independent module in `packages/common/`.

```
packages/api/src/
  routes/       -- document.routes.ts, qa.routes.ts, conversation.routes.ts
  services/     -- r2.service.ts, embedding.service.ts, retrieval.service.ts
  prompts/      -- qa-system.ts

packages/worker/src/
  processors/   -- document-processor.ts
  services/     -- chunker.service.ts, text-extractor.service.ts

packages/web/
  app/
    documents/    -- upload + library
    chat/         -- Q&A interface
  components/
    DocumentUpload.tsx
    ChatMessage.tsx
    CitationBadge.tsx
    StreamingResponse.tsx

packages/common/
  types/          -- shared types
  chunker/        -- reusable chunking module
```
