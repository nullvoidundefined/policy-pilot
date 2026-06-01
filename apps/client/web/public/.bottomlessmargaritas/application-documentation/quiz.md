# Document Q&A RAG — Quiz

**1. What are the five stages of the RAG pipeline in this app, in order?**

- A) Upload, Embed, Chunk, Store, Retrieve
- B) Chunk, Upload, Embed, Retrieve, Store
- **C) Upload, Chunk, Embed, Store, Retrieve & Answer**
- D) Upload, Store, Chunk, Embed, Retrieve

? What is the correct sequence from file upload to streaming answer?

> The pipeline is: Upload (PDF to R2) → Chunk (recursive text splitter) → Embed (OpenAI text-embedding-3-small) → Store (pgvector) → Retrieve & Answer (cosine similarity search → Claude streams answer with citations).

**2. Why does the chunker use 50-token overlap between chunks?**

- A) To reduce the total number of chunks
- **B) To preserve information that spans chunk boundaries**
- C) To increase embedding accuracy
- D) To make chunks uniform in size

? What problem does overlapping solve in recursive text splitting?

> Overlap ensures that information sitting at the edge of two chunks isn't lost. Without overlap, the splitter could cut a sentence in half, making neither chunk independently useful for retrieval.

**3. Which vector index type does this app use for pgvector?**

- A) IVFFlat with 100 lists
- B) GiST with cosine distance
- **C) HNSW with m=16 and ef_construction=64**
- D) B-tree with vector_cosine_ops

? What index type is created on the chunks embedding column?

> The app uses HNSW (Hierarchical Navigable Small World) with m=16 and ef_construction=64. HNSW requires no training step, works well at any dataset size, and offers better recall than IVFFlat.

**4. What does the system prompt instruct Claude to do when retrieved context is insufficient?**

- A) Generate a best guess based on general knowledge
- B) Ask the user to rephrase their question
- **C) Say "I don't have enough information" rather than hallucinating**
- D) Return an empty response with no citations

? How does the prompt prevent confabulation?

> RAG's value is grounded answers backed by document content. The system prompt explicitly tells Claude to say "I don't have enough information" when context is insufficient, preventing fabricated answers and maintaining trust in citations.

**5. Why is document processing handled by a BullMQ worker instead of inline in the API?**

- A) BullMQ is faster than Express for file operations
- **B) Processing is CPU/IO-intensive and would block the API server**
- C) Express cannot handle file uploads larger than 1MB
- D) Workers have access to more memory than the API process

? Why not process documents synchronously in the upload handler?

> Document processing (text extraction + chunking + embedding) can take seconds to minutes per document. Running it inline would block the API, causing timeouts for all users. The worker processes jobs asynchronously with concurrency control and retries.

**6. What are the five document status values and their order?**

- A) pending, processing, embedding, complete, error
- B) new, extracting, vectorizing, indexed, failed
- **C) uploaded, chunking, embedding, ready, failed**
- D) queued, parsing, encoding, available, failed

? What status enum values does the documents table use?

> The statuses are: uploaded (file in R2, job queued), chunking (extracting text and splitting), embedding (generating vectors), ready (queryable), and failed (all retries exhausted).

**7. Why use Cloudflare R2 instead of storing files in PostgreSQL?**

- A) PostgreSQL doesn't support binary data
- B) R2 is faster for all read operations
- **C) PostgreSQL isn't optimized for large BLOBs, and R2 has zero egress fees**
- D) R2 provides automatic text extraction

? What are the advantages of object storage over database BLOBs?

> PostgreSQL performs poorly with BLOBs over a few MB. R2 provides an S3-compatible API with zero egress fees, keeps the database lean, and supports presigned URLs for direct browser downloads.

**8. How does session-based authentication work in this app?**

- A) JWT tokens stored in localStorage
- **B) Random token in HTTP-only cookie, SHA-256 hash stored in sessions table**
- C) Supabase Auth with RLS policies
- D) OAuth2 with refresh tokens

? How are session tokens stored and validated?

> On login, a random token is generated. The raw token goes into an HTTP-only cookie (sid). A SHA-256 hash is stored in the sessions table. On each request, the cookie is hashed and looked up in the DB. Even if the sessions table is compromised, raw tokens can't be reconstructed.

**9. What embedding model does this app use and how many dimensions does it produce?**

- A) Voyage AI voyage-large-2 with 1024 dimensions
- B) OpenAI text-embedding-ada-002 with 1536 dimensions
- **C) OpenAI text-embedding-3-small with 1536 dimensions**
- D) OpenAI text-embedding-3-large with 3072 dimensions

? Which model and dimension count is configured for embeddings?

> The app uses OpenAI text-embedding-3-small producing 1536-dimensional vectors. The dimension count must match the vector(1536) column definition in pgvector.

**10. What happens when a user asks a question in the chat?**

- A) The question is sent to Claude directly without any document context
- B) All document chunks are included in the prompt
- **C) The question is embedded, top-k similar chunks are retrieved, then assembled into a Claude prompt that streams the answer**
- D) A pre-built index returns cached answers

? Walk through the Q&A flow from question to streamed answer.

> The question is embedded via OpenAI, pgvector cosine similarity finds top-k chunks scoped to the user, a citations SSE event is sent, the system prompt + chunks + question go to Claude, and the response streams back as token events with citation markers.

**11. Why is vector search scoped to the requesting user's documents?**

- A) To improve search performance
- B) To reduce embedding API costs
- **C) Multi-tenancy isolation — without user scoping, queries could return other users' private data**
- D) pgvector requires a user_id filter

? What security concern does the WHERE user_id clause address?

> Each user's documents are private. Without user scoping, a vector search could return chunks from another user's documents, leaking private information. The WHERE clause ensures retrieval is always scoped to the requesting user.

**12. Why use cosine similarity instead of Euclidean distance for text embeddings?**

- A) Cosine similarity is faster to compute
- B) pgvector only supports cosine distance
- **C) Cosine similarity measures angle between vectors, ignoring magnitude, which better captures semantic relatedness**
- D) Euclidean distance requires normalized vectors

? What mathematical property makes cosine similarity better for embeddings?

> Cosine similarity measures the angle between vectors, ignoring magnitude. Text embeddings are normalized, so cosine similarity measures semantic relatedness. Euclidean distance is affected by magnitude, which varies with text length and doesn't correlate with meaning.

**13. How does SSE streaming work in this app's Q&A endpoint?**

- A) WebSocket connection with bidirectional messaging
- B) Long polling with 5-second intervals
- **C) Server sets text/event-stream headers and writes data: {JSON} events incrementally**
- D) gRPC streaming with protobuf encoding

? How are tokens delivered to the frontend during streaming?

> The server sets Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive. Data is written incrementally as data: {JSON}\n\n events. Event types include citations, token, done, and error.

**14. How are citation markers generated and rendered?**

- A) Claude generates HTML links that the frontend renders directly
- **B) The system prompt tells Claude to use [1], [2] markers; the server extracts them via regex; the frontend renders them as clickable badges**
- C) Citations are pre-computed before sending to Claude
- D) The frontend matches keywords against chunk content

? What is the end-to-end citation flow from prompt to UI?

> The prompt assembly numbers each chunk. Claude cites them as [1], [2]. The server uses regex /\[(\d+)\]/g to extract markers and map to chunk IDs. The frontend renders markers as clickable CitationBadge components showing source content.

**15. Why use SSE instead of WebSockets for Q&A streaming?**

- A) SSE supports bidirectional communication
- **B) SSE is simpler, unidirectional, built on HTTP, and Q&A is request/response — no bidirectional need**
- C) WebSockets don't support streaming
- D) SSE has better browser support

? What makes SSE the right fit for this use case?

> Q&A is request/response: the client sends one question, the server streams one answer. SSE is simpler (unidirectional, HTTP-based), works through proxies/CDNs, auto-reconnects on failure, and doesn't require WebSocket connection management overhead.

**16. What does the common package export and why?**

- A) Database models shared between server and worker
- **B) Types (Document, Chunk, etc.) and a chunker function reusable across packages and future apps**
- C) Authentication middleware used by all services
- D) Shared React components for the frontend

? What code lives in the common package?

> The common package exports shared types (Document, Chunk, Conversation, Message, QAStreamEvent, DocumentProcessJob, CitedChunk) and the chunkText() recursive text splitter. The chunker is reusable in apps 5 and 7.

**17. Why does the worker have its own embedding service instead of importing the server's?**

- A) The worker uses a different embedding model
- **B) The worker runs as a separate process/container and can't import server modules; its version is optimized for batch processing**
- C) The server's embedding service is synchronous
- D) Import cycles prevent sharing the service

? Why duplicate the embedding service across server and worker?

> The worker runs as a separate Docker container on Railway. It can't import server modules at runtime. Both call the same OpenAI API, but the worker's version uses batch processing (BATCH_SIZE=100) for bulk chunk embedding, while the server handles single question embeddings.

**18. How do the Dockerfiles use multi-stage builds?**

- A) Single stage with all dependencies
- **B) Base stage installs all deps and builds; production stage copies only compiled output with production deps**
- C) Three stages: install, build, test
- D) Base stage runs tests; production stage builds

? What is the purpose of multi-stage Docker builds here?

> Each Dockerfile has two stages: base (installs all dependencies including devDependencies, builds common + target package) and production (installs only production dependencies, copies built artifacts). This reduces image size by excluding TypeScript and build tools.

**19. What happens if the document processing worker crashes mid-job?**

- A) The document is permanently stuck in processing status
- B) The user must re-upload the document
- **C) BullMQ's stalled job detection retries it up to 3 times with exponential backoff**
- D) The API server takes over processing

? How does the system recover from worker failures?

> BullMQ detects stalled jobs when the worker restarts. The job retries up to 3 times with exponential backoff (5000ms initial delay). If all retries fail, document status is set to failed. Railway's ON_FAILURE restart policy ensures the container recovers.

**20. Why ~500 tokens per chunk instead of larger or smaller?**

- A) 500 is the maximum token count for text-embedding-3-small
- B) Larger chunks are cheaper to embed
- **C) ~500 tokens balances self-contained context with focused relevance, fitting 5-8 chunks in a prompt**
- D) pgvector has a 500-token limit per row

? What are the tradeoffs of chunk size?

> Too small (< 200 tokens): fragments lack context. Too large (> 1000 tokens): diluted relevance, consuming too much of Claude's context window. ~500 tokens is enough to be self-contained while staying focused, allowing 5-8 retrieved chunks per prompt.

**21. What are the tradeoffs of pgvector vs. a dedicated vector database?**

- A) pgvector is always faster than dedicated vector DBs
- **B) pgvector offers simpler ops and SQL joins but is slower at millions of vectors compared to Pinecone/Weaviate**
- C) Dedicated vector DBs support SQL queries
- D) pgvector requires a separate service to manage

? When would you outgrow pgvector?

> pgvector advantages: single database, transactional consistency, SQL joins, Neon support. Disadvantages: slower at very large scale (millions of vectors), no built-in sharding. For this app's scale (thousands to tens of thousands of chunks per user), pgvector is sufficient.

**22. Why use session-based auth instead of JWTs?**

- **A) Sessions can be immediately revoked by deleting the DB record; JWTs remain valid until expiry**
- B) JWTs are less secure than sessions
- C) Sessions don't require cookies
- D) JWTs can't store user information

? What is the key advantage of server-side sessions over JWTs?

> Revocability: sessions can be immediately invalidated by deleting the DB record. JWTs remain valid until expiry. Sessions also avoid token size bloat, enable server-side control (single-session policies), and the SHA-256 hashing protects against DB breaches.

**23. What LLM model does the app use for generating conversation titles?**

- A) claude-sonnet-4-20250514
- **B) claude-haiku-4-5-20251001**
- C) gpt-4-turbo
- D) claude-3-opus

? Why use a different model for titles than for Q&A answers?

> Conversation titles use claude-haiku-4-5-20251001 (max_tokens: 30) because title generation is a simple task that doesn't need the full power of Sonnet. Using Haiku reduces cost and latency for this lightweight operation.

**24. What LLM model does the app use for the main Q&A responses?**

- A) claude-haiku-4-5-20251001
- B) claude-3-opus
- **C) claude-sonnet-4-20250514**
- D) gpt-4-turbo

? Which model is configured in the QA handler for answering questions?

> The QA handler uses claude-sonnet-4-20250514 with max_tokens: 2048. Sonnet provides a good balance of quality and speed for grounded Q&A responses that require understanding context and generating accurate citations.

**25. How many chunks does the retrieval service return by default for a question?**

- A) 3 chunks
- B) 5 chunks
- **C) 6 chunks**
- D) 10 chunks

? What is the default top-k value in searchChunks?

> The QA handler calls searchChunks with k=6, retrieving the 6 most similar chunks by cosine distance. This provides enough context for comprehensive answers while staying within reasonable prompt size limits.

**26. What regex pattern does the server use to extract citation markers from Claude's response?**

- A) /\[cite:(\d+)\]/g
- **B) /\[(\d+)\]/g**
- C) /\{(\d+)\}/g
- D) /\[ref-(\d+)\]/g

? How are numbered citation markers parsed from the streamed response?

> The server uses the regex /\[(\d+)\]/g to find all [N] markers in Claude's response. The captured numbers are 1-indexed (matching the prompt's chunk numbering) and mapped to 0-indexed chunk positions to extract cited chunk IDs.

**27. What is the character-to-token estimation ratio used by the chunker?**

- A) 1 character = 1 token
- B) 2 characters per token
- **C) 4 characters per token**
- D) 8 characters per token

? How does the chunker estimate token count without a tokenizer?

> The chunker uses a rough heuristic of ~4 characters per 1 token (tokenCount = Math.ceil(text.length / 4)). This avoids importing a tokenizer library while providing a reasonable approximation for English text splitting.

**28. What separator hierarchy does the recursive text splitter use?**

- A) Sentence boundaries only
- B) Paragraph breaks, then word boundaries
- **C) Double newline, single newline, period+space, then space**
- D) Regex word boundaries at token positions

? In what order does the chunker try to split text?

> The chunker uses separators in order: ['\n\n', '\n', '. ', ' ']. It tries the most meaningful boundary first (paragraph break) and falls back to less meaningful ones. If no separator works, it hard-splits by character at maxTokens \* 4.

**29. What happens if a document contains zero extractable text?**

- A) An empty chunk is stored in the database
- B) The document status is set to ready with zero chunks
- **C) The processor throws an error and the document is marked as failed**
- D) A placeholder chunk is created

? How does the worker handle empty text extraction?

> The document processor checks text.trim().length === 0 after extraction. If the document has no text content, it throws an error. The error is caught, and the document status is updated to failed with the error message.

**30. What rate limits are configured for general, auth, and chat endpoints?**

- A) 50/100/200 requests per 15 minutes
- **B) 100/20/30 requests per 15 minutes**
- C) 200/50/100 requests per 15 minutes
- D) 100/50/50 requests per 15 minutes

? What are the three rate limiter configurations?

> General: 100 requests per 15 minutes. Auth: 20 requests per 15 minutes (to prevent brute force). Chat: 30 requests per 15 minutes (to limit LLM API costs). Each uses express-rate-limit with standardHeaders: true.

**31. What is the CSRF protection pattern used in this app?**

- A) Synchronizer token stored in the session
- **B) Double-submit cookie pattern via the csrf-csrf library**
- C) Custom header check only (X-Requested-With)
- D) Origin header validation

? How does CSRF protection work here?

> The app uses the double-submit cookie pattern from the csrf-csrf library. A secret is stored in the \_\_csrf cookie, a token is generated from the session cookie + secret, and the client sends the token in the X-CSRF-Token header. The server validates that they match.

**32. How long is the CORS preflight cache max-age?**

- A) 300 seconds (5 minutes)
- B) 3600 seconds (1 hour)
- **C) 7200 seconds (2 hours)**
- D) 86400 seconds (24 hours)

? How long do browsers cache preflight OPTIONS responses?

> The CORS config sets maxAge: 7200 (2 hours). This means browsers cache preflight responses for 2 hours, reducing the number of OPTIONS requests for cross-origin API calls from the Vercel frontend to the Railway backend.

**33. What are the PostgreSQL connection pool settings?**

- A) max: 5, idle timeout: 10s, connection timeout: 3s
- **B) max: 10, idle timeout: 30s, connection timeout: 5s**
- C) max: 20, idle timeout: 60s, connection timeout: 10s
- D) max: 10, idle timeout: 60s, connection timeout: 30s

? What are the pool size and timeout configurations?

> The pool is configured with max: 10 connections, idleTimeoutMillis: 30000 (30s), and connectionTimeoutMillis: 5000 (5s). There's also a statement_timeout of 10000ms (10s) at the SQL level to prevent runaway queries.

**34. What is the R2 storage key structure for uploaded documents?**

- A) {filename}
- B) {user_id}/{filename}
- **C) documents/{user_id}/{uuid}/{original_filename}**
- D) uploads/{uuid}.{extension}

? How are document files organized in Cloudflare R2?

> Files are stored as documents/{user_id}/{crypto.randomUUID()}/{file.originalname}. The UUID prevents filename collisions, the user_id provides logical grouping, and the original filename is preserved for download.

**35. What is the maximum file upload size?**

- A) 5MB
- **B) 10MB**
- C) 25MB
- D) 50MB

? What file size limit is enforced on both the multer middleware and the handler?

> Both multer (limits: { fileSize: 10 _ 1024 _ 1024 }) and the upload handler (const maxSize = 10 _ 1024 _ 1024) enforce a 10MB limit. The dual check provides defense in depth.

**36. What file types are accepted for upload?**

- A) PDF only
- B) PDF and TXT
- **C) PDF, TXT, Markdown (.md), and text/x-markdown**
- D) PDF, TXT, DOCX, and HTML

? Which MIME types does the upload handler allow?

> The allowed MIME types are: application/pdf, text/plain, text/markdown, and text/x-markdown. The text extractor uses pdf-parse for PDFs and direct buffer.toString() for plain text and markdown files.

**37. How many retry attempts are configured for document processing jobs?**

- A) 1 attempt
- B) 2 attempts
- **C) 3 attempts with exponential backoff starting at 5000ms**
- D) 5 attempts with linear backoff

? What is the BullMQ retry configuration for the document process queue?

> Jobs are configured with attempts: 3 and backoff: { type: 'exponential', delay: 5000 }. This means retries at ~5s, ~10s, and ~20s. If all three attempts fail, the document status is set to failed.

**38. What batch size does the worker use when generating embeddings?**

- A) 10 texts per batch
- B) 50 texts per batch
- **C) 100 texts per batch**
- D) 500 texts per batch

? How many texts does the worker send to OpenAI per API call?

> The worker's embedding service uses BATCH_SIZE = 100, processing texts in batches of 100 (for loop: i += 100). This balances API throughput with request size limits, avoiding timeouts while minimizing the number of API calls.

**39. What PostgreSQL error code indicates a unique constraint violation?**

- A) 23502 (NOT NULL violation)
- **B) 23505 (unique violation)**
- C) 23503 (foreign key violation)
- D) 42P01 (undefined table)

? How does the auth handler detect duplicate email registration?

> The register handler catches errors with code 23505 (PostgreSQL unique violation) and returns a 409 Conflict response. This handles the case where a user tries to register with an email that already exists in the users table.

**40. How does the frontend poll for document processing status updates?**

- A) WebSocket connection with real-time updates
- B) Server-Sent Events stream
- **C) React Query with refetchInterval: 5000 (every 5 seconds)**
- D) Manual refresh button

? How does the documents page know when processing is complete?

> The documents page uses React Query with refetchInterval: 5000, polling the GET /documents endpoint every 5 seconds. This simple approach checks for status changes (uploaded → chunking → embedding → ready) without requiring WebSocket infrastructure.

**41. What HTTP header does the server set to prevent Nginx from buffering SSE responses?**

- A) Cache-Control: no-store
- B) Transfer-Encoding: chunked
- **C) X-Accel-Buffering: no**
- D) Connection: keep-alive

? How does the app ensure streaming responses aren't buffered by reverse proxies?

> The QA handler sets the X-Accel-Buffering: no header. This tells Nginx (and similar reverse proxies like Railway's) to disable response buffering, allowing SSE tokens to be delivered to the client immediately rather than being batched.

**42. What is the SQL operator for cosine distance in pgvector?**

- A) <->
- **B) <=>**
- C) <#>
- D) <~>

? Which operator does the retrieval service use for vector similarity search?

> pgvector's <=> operator computes cosine distance. The retrieval service calculates similarity as 1 - (c.embedding <=> $1::vector). The <-> operator is for Euclidean distance and <#> is for inner product.

**43. How does the frontend API client handle CSRF token management?**

- A) Fetches a new token on every request
- **B) Lazy-loads and caches the token in memory; resets to null on 403 and retries once**
- C) Stores the token in localStorage
- D) Reads the token from a cookie

? What is the CSRF token lifecycle on the client?

> The token is fetched once from GET /api/csrf-token and cached in a module-level variable. It's sent on all state-changing requests (POST, PUT, PATCH, DELETE). On a 403 response, the token is reset to null and the request retries once with a fresh token.

**44. Why does the upload handler use multer with memory storage?**

- A) Disk storage isn't available in Docker containers
- **B) The file buffer is needed to upload directly to R2 without writing to disk**
- C) Memory storage is faster for large files
- D) Express requires memory storage for multipart forms

? Why memoryStorage instead of diskStorage for multer?

> Memory storage keeps the uploaded file as a Buffer (req.file.buffer), which can be passed directly to the R2 uploadFile service. There's no need for temporary disk files since the buffer goes straight to cloud storage.

**45. What is the session cookie's sameSite setting in production?**

- A) strict
- B) lax
- **C) none**
- D) Not set

? Why is sameSite: none required in production?

> In production, the frontend (Vercel) and backend (Railway) are on different domains. Cross-origin requests require sameSite: none combined with secure: true for cookies to be sent. Using strict or lax would block the session cookie on cross-origin requests.

**46. How is the conversation title generated?**

- A) The user manually enters a title
- B) The first message content is used as the title
- **C) Claude Haiku generates a short title asynchronously after the first question**
- D) A hash of the conversation ID is used

? When and how are conversation titles created?

> After the first question in a conversation, the QA handler fires off an async (fire-and-forget) call to Claude Haiku (max_tokens: 30) to generate a short title based on the question. This happens in the background without blocking the streaming response.

**47. What unique constraint exists on the chunks table?**

- A) Unique on chunk_index alone
- B) Unique on document_id alone
- **C) Unique on (document_id, chunk_index) combined**
- D) No unique constraint on chunks

? How does the schema prevent duplicate chunks for the same document?

> The migration creates a unique index on (document_id, chunk_index). This ensures that each document can only have one chunk at each index position, preventing duplicates if a processing job is retried.

**48. What does the set_updated_at trigger do in the database?**

- A) Updates a global timestamp table
- **B) Automatically sets the updated_at column to NOW() before any UPDATE**
- C) Logs the update to an audit table
- D) Notifies the application of changes

? How is updated_at maintained across tables?

> The migration creates a set_updated_at function that sets NEW.updated_at = NOW() on every row update. This trigger is applied to the users, documents, and conversations tables, ensuring updated_at is always current without the application needing to set it.

**49. How does the retrieval service filter chunks when optional document_ids are provided?**

- A) It runs a separate query for each document
- B) It uses a JOIN with a temporary table
- **C) It adds a WHERE d.id = ANY($3::uuid[]) clause when document_ids are provided**
- D) It filters results in JavaScript after the query

? How does the SQL query handle optional document filtering?

> The retrieval service dynamically builds the WHERE clause. When document_ids are provided, it adds AND d.id = ANY($N::uuid[]) using parameterized queries. This lets users scope Q&A to specific documents rather than searching all their uploads.

**50. What is the SQL-level statement timeout for database queries?**

- A) 5 seconds
- **B) 10 seconds**
- C) 30 seconds
- D) No timeout

? How does the app prevent runaway database queries?

> The pool configuration includes statement_timeout: 10000 (10 seconds) set at the SQL level. This ensures that any query taking longer than 10 seconds is automatically cancelled by PostgreSQL, preventing slow queries from blocking connections.
