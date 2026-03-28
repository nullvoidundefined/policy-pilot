# App 4: Document Q&A (RAG) — Quiz

Test your understanding of the RAG architecture, implementation details, and design decisions.

---

## Section 1: RAG Pipeline Fundamentals

**Q1.** What are the 5 stages of the RAG pipeline in this app, in order?

<details>
<summary>Answer</summary>

1. **Upload** — PDF/text uploaded via multer, stored in Cloudflare R2
2. **Chunk** — Recursive text splitter breaks document into ~500-token chunks with 50-token overlap
3. **Embed** — OpenAI text-embedding-3-small generates 1536-dimension vectors for each chunk
4. **Store** — Chunks + embeddings stored in PostgreSQL with pgvector extension
5. **Retrieve & Answer** — Question embedded → cosine similarity search → top chunks assembled into prompt → Claude streams answer with citation markers

</details>

**Q2.** Why do we use overlapping chunks (50 tokens) instead of hard boundaries?

<details>
<summary>Answer</summary>

Overlap ensures that information spanning chunk boundaries isn't lost. If a key fact sits at the edge of two chunks, the overlap captures it in both, improving retrieval accuracy. Without overlap, the splitter could cut a sentence in half, making neither chunk independently useful.

</details>

**Q3.** What is the difference between IVFFlat and HNSW indexes in pgvector, and which does this app use?

<details>
<summary>Answer</summary>

- **IVFFlat** — Inverted file index. Requires training on existing data. Faster to build but less accurate for small datasets. Must be rebuilt after large inserts.
- **HNSW** — Hierarchical Navigable Small World graph. No training step, works well at any size, better recall. Slower to build but faster and more accurate at query time.

This app uses **HNSW** with parameters `m=16, ef_construction=64` and the `vector_cosine_ops` operator class.

</details>

**Q4.** Why does the system prompt instruct Claude to say "I don't have enough information" rather than hallucinating?

<details>
<summary>Answer</summary>

RAG's core value proposition is **grounded answers** — responses backed by actual document content. If the model fabricates information not in the retrieved chunks, it defeats the purpose. The instruction to decline answering when context is insufficient prevents confabulation and maintains user trust in citations.

</details>

---

## Section 2: Architecture & Infrastructure

**Q5.** Why is document processing handled by a separate BullMQ worker instead of inline in the API?

<details>
<summary>Answer</summary>

Document processing (text extraction + chunking + embedding) is CPU/IO-intensive and can take seconds to minutes per document. Running it inline would block the API server, causing timeouts and degraded response times for all users. The worker processes jobs asynchronously with concurrency=2, retries on failure (3 attempts, exponential backoff), and updates document status so the frontend can poll for progress.

</details>

**Q6.** What document status values exist and what does each mean?

<details>
<summary>Answer</summary>

- `uploaded` — File stored in R2, processing job enqueued
- `chunking` — Worker is extracting text and splitting into chunks
- `embedding` — Worker is generating vector embeddings for chunks
- `ready` — All chunks embedded and stored, document is queryable
- `failed` — Processing failed after all retries

</details>

**Q7.** Why use Cloudflare R2 instead of storing files directly in PostgreSQL?

<details>
<summary>Answer</summary>

- PostgreSQL isn't optimized for large binary objects (BLOBs over a few MB cause performance issues)
- R2 provides S3-compatible API with zero egress fees
- Separating file storage from metadata keeps the database lean and fast
- R2 supports presigned URLs for direct browser downloads without proxying through the API

</details>

**Q8.** Explain the auth flow: how does session-based authentication work in this app?

<details>
<summary>Answer</summary>

1. User registers/logs in → server generates a random token
2. Raw token is set as an HTTP-only cookie (`sid`)
3. SHA-256 hash of the token is stored in the `sessions` table with user_id and expiry (7 days)
4. On each request, `loadSession` middleware reads the cookie, hashes it, looks up the session in DB
5. If valid and not expired, `req.user` is populated
6. `requireAuth` middleware rejects requests without a valid session

This avoids storing raw tokens in the database — even if the sessions table is compromised, the tokens can't be reconstructed.

</details>

---

## Section 3: Embedding & Retrieval

**Q9.** What embedding model does this app use and what are its dimensions?

<details>
<summary>Answer</summary>

OpenAI `text-embedding-3-small` producing 1536-dimensional vectors. This was chosen over Voyage AI for simplicity and broad compatibility. The dimension count must match the `vector(1536)` column definition in pgvector.

</details>

**Q10.** Walk through what happens when a user asks a question in the chat.

<details>
<summary>Answer</summary>

1. Frontend sends POST to `/api/qa` with SSE streaming
2. Server gets or creates a conversation record
3. User's question is saved as a message
4. Question text is embedded via OpenAI API (same model as document chunks)
5. pgvector cosine similarity search (`<=>` operator) finds top-k most similar chunks, filtered to user's documents only
6. Server sends a `citations` SSE event with the matched chunks' metadata
7. System prompt + numbered chunk contexts + question are assembled into a Claude API call
8. Claude's response streams back as SSE `delta` events
9. Server parses `[1]`, `[2]` markers from the response to extract cited chunk IDs
10. Assistant message with content and cited_chunk_ids is persisted

</details>

**Q11.** Why is the vector search scoped to `user_id` and not just searching all chunks?

<details>
<summary>Answer</summary>

Multi-tenancy isolation. Each user's documents are private. Without user scoping, a vector search could return chunks from another user's documents, leaking private information. The WHERE clause `user_id = $1` ensures retrieval is always scoped to the requesting user's data.

</details>

**Q12.** What is cosine similarity and why use it over Euclidean distance for text embeddings?

<details>
<summary>Answer</summary>

Cosine similarity measures the angle between two vectors, ignoring magnitude. Text embeddings from models like text-embedding-3-small are normalized, so cosine similarity effectively measures semantic relatedness. Euclidean distance is affected by vector magnitude, which can vary with text length and doesn't correlate with semantic meaning. pgvector's `<=>` operator computes cosine distance (1 - cosine similarity).

</details>

---

## Section 4: Streaming & Citations

**Q13.** How does SSE (Server-Sent Events) streaming work in this app?

<details>
<summary>Answer</summary>

1. Server sets headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
2. Response is not closed — data is written incrementally
3. Each event follows the SSE format: `data: {JSON}\n\n`
4. Event types: `citations` (chunk metadata), `delta` (token chunks), `done` (completion), `error`
5. Frontend uses `streamPost()` which reads the response body as a stream, parsing SSE lines
6. Connection closes when the server sends the `done` event or on error

</details>

**Q14.** How are citation markers (`[1]`, `[2]`) generated and rendered?

<details>
<summary>Answer</summary>

**Generation:** The system prompt instructs Claude to cite sources using `[1]`, `[2]` markers referencing the numbered context chunks. The prompt assembly function numbers each retrieved chunk.

**Parsing:** After streaming completes, the server uses a regex to extract all `[N]` markers from the response, mapping them to chunk IDs.

**Rendering:** The frontend parses the streamed text, replacing `[N]` markers with clickable `CitationBadge` components. Clicking a badge expands it to show the source chunk's content and document reference.

</details>

**Q15.** Why use SSE instead of WebSockets for the Q&A streaming?

<details>
<summary>Answer</summary>

- SSE is simpler: unidirectional (server→client), built on HTTP, works through proxies/CDNs
- Q&A is request/response — the client sends one question, the server streams one answer
- No need for bidirectional communication
- SSE auto-reconnects on failure
- WebSockets add complexity (connection management, heartbeats) that isn't needed here

</details>

---

## Section 5: Code Architecture

**Q16.** What is the purpose of the `common` package and what does it export?

<details>
<summary>Answer</summary>

The `common` package contains code shared between server, worker, and potentially the frontend:
- **Types** (`./types`): Document, Chunk, Conversation, Message, QAStreamEvent, DocumentProcessJob, CitedChunk
- **Chunker** (`./chunker`): The `chunkText()` function — a recursive text splitter that's reusable in apps 5 and 7

It's built as an ES module with TypeScript declarations and declaration maps for cross-package type safety.

</details>

**Q17.** Why does the worker use a separate embedding service instead of importing the server's?

<details>
<summary>Answer</summary>

The worker runs as a separate process (separate Docker container on Railway). It can't import the server's modules at runtime. Both implement the same OpenAI embedding API call, but the worker's version includes batch processing (BATCH_SIZE=100) optimized for bulk chunk embedding, while the server's version handles single question embeddings.

</details>

**Q18.** Explain the monorepo structure and why pnpm workspaces are used.

<details>
<summary>Answer</summary>

```
document-qa-rag/
├── common/      — shared types + chunker (doc-qa-rag-common)
├── server/      — Express API (doc-qa-rag-server)
├── worker/      — BullMQ processor (doc-qa-rag-worker)
└── web-client/  — Next.js frontend (doc-qa-rag-web)
```

pnpm workspaces enable:
- **Shared dependencies** — deduplicated in a single node_modules
- **Cross-package imports** — `workspace:*` protocol for internal deps
- **Independent builds** — each package has its own tsconfig and build script
- **Selective installs** — Dockerfiles use `--filter` to install only needed packages

</details>

---

## Section 6: Deployment & Operations

**Q19.** How do the Dockerfiles use multi-stage builds and why?

<details>
<summary>Answer</summary>

Each Dockerfile has two stages:
1. **`base`** — Installs all dependencies (including devDependencies), builds common + target package
2. **`production`** — Installs only production dependencies, copies built artifacts from base

This reduces the final image size by excluding TypeScript, build tools, and devDependencies. The production image contains only the compiled JavaScript and runtime dependencies.

</details>

**Q20.** What happens if the document processing worker crashes mid-job?

<details>
<summary>Answer</summary>

BullMQ handles this automatically:
- The job remains in the queue with "active" status
- After the worker restarts, BullMQ's stalled job detection picks it up
- The job retries up to 3 times with exponential backoff
- If all retries fail, the document status is set to `failed`
- Railway's `restartPolicyType: ON_FAILURE` ensures the worker container restarts

</details>

**Q21.** Why does the migration use `$pga$` quoting for enum defaults?

<details>
<summary>Answer</summary>

node-pg-migrate wraps default values in its own quoting. If you write `default: "'uploaded'"`, it becomes `$pga$'uploaded'$pga$` — double-quoted and invalid. Using `default: "uploaded"` (no quotes) lets node-pg-migrate handle the quoting correctly, producing `$pga$uploaded$pga$` which PostgreSQL interprets as the enum value `uploaded`.

</details>

---

## Section 7: Design Decisions

**Q22.** Why ~500 tokens per chunk instead of larger or smaller?

<details>
<summary>Answer</summary>

- **Too small** (< 200 tokens): Chunks lack context, retrieval returns fragments that don't make sense alone
- **Too large** (> 1000 tokens): Chunks are too broad, diluting relevance. Also consume more of Claude's context window per retrieved chunk
- **~500 tokens**: Good balance — enough context to be self-contained, small enough that 5-8 retrieved chunks fit comfortably in a prompt while staying focused on specific topics

</details>

**Q23.** What are the tradeoffs of storing embeddings in PostgreSQL (pgvector) vs. a dedicated vector database?

<details>
<summary>Answer</summary>

**pgvector advantages:**
- Single database for all data — simpler ops, transactional consistency
- No additional service to manage/pay for
- Neon supports it natively
- SQL joins between chunks and documents/users

**pgvector disadvantages:**
- Slower at very large scale (millions of vectors) compared to purpose-built DBs like Pinecone/Weaviate
- HNSW index build time grows with dataset size
- No built-in sharding or distributed search

For this app's scale (thousands to tens of thousands of chunks per user), pgvector is more than sufficient.

</details>

**Q24.** Why use session-based auth instead of JWTs?

<details>
<summary>Answer</summary>

- **Revocability**: Sessions can be immediately invalidated by deleting the DB record. JWTs remain valid until expiry.
- **No token size bloat**: Session cookie is a simple random string vs. a JWT payload that grows with claims.
- **Server-side control**: Can query active sessions, enforce single-session policies, etc.
- **Security**: SHA-256 hashing of stored tokens means a DB breach doesn't expose session tokens.
- **Tradeoff**: Requires a DB lookup per request (mitigated by fast indexed queries on the hash column).

</details>

**Q25.** If you needed to support 100x more documents per user, what would you change?

<details>
<summary>Answer</summary>

1. **Partitioning**: Partition the chunks table by user_id for faster scoped queries
2. **Embedding model**: Consider lower-dimensional models (e.g., 512 dims) to reduce storage and index size
3. **Retrieval**: Add a re-ranking step (cross-encoder) after initial vector search to improve precision at higher recall
4. **Caching**: Cache frequently asked question embeddings and their top-k results in Redis
5. **Async indexing**: Defer HNSW index updates to off-peak hours
6. **Consider dedicated vector DB**: At millions of vectors, Pinecone/Qdrant offer better performance with managed scaling

</details>
