# App 4: Document Q&A (RAG) — FAQ

Practical guide to running, developing, and understanding the Document Q&A application.

---

## Getting Started

### How do I run this locally?

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables (see below)
cp .env.example .env  # or create .env manually

# 3. Run database migrations
cd server && pnpm run migrate up

# 4. Start all services (3 terminals)
pnpm --filter doc-qa-rag-server run dev    # API on :3001
pnpm --filter doc-qa-rag-worker run dev    # Worker process
pnpm --filter doc-qa-rag-web run dev       # Frontend on :3000
```

### What environment variables do I need?

**Server (.env in server/):**
```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
REDIS_URL=redis://default:pass@host:6379
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret
R2_BUCKET_NAME=doc-qa-rag
OPENAI_API_KEY=sk-...           # For embeddings
ANTHROPIC_API_KEY=sk-ant-...    # For Claude completions
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=any-random-string
```

**Worker (.env in worker/):**
```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
REDIS_URL=redis://default:pass@host:6379
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret
R2_BUCKET_NAME=doc-qa-rag
OPENAI_API_KEY=sk-...
```

**Web Client (.env.local in web-client/):**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### How do I run migrations?

```bash
cd server
pnpm run migrate up      # Apply all pending migrations
pnpm run migrate down     # Rollback last migration
pnpm run migrate create my-migration-name  # Create new migration
```

Migrations are in `server/migrations/` and run via `node-pg-migrate`.

---

## How It Works

### What happens when I upload a document?

1. **Frontend** sends the file as multipart/form-data to `POST /api/documents`
2. **Server** receives via multer (memory storage), uploads to Cloudflare R2 at `documents/{userId}/{docId}/{filename}`
3. **Server** creates a `documents` record with status `uploaded`
4. **Server** enqueues a `document-process` job in BullMQ with `{ documentId, userId }`
5. **Worker** picks up the job:
   - Downloads file from R2
   - Extracts text (pdf-parse for PDFs, raw read for txt/md)
   - Updates status to `chunking`
   - Splits text into ~500-token chunks with 50-token overlap
   - Updates status to `embedding`
   - Batch-embeds all chunks via OpenAI (100 chunks per API call)
   - Stores chunks + embeddings in pgvector
   - Updates status to `ready`
6. **Frontend** polls document list every 5 seconds, showing status badges

### How does the Q&A work?

1. User types a question in the chat interface
2. Frontend opens an SSE connection to `POST /api/qa`
3. Server embeds the question using the same OpenAI model
4. pgvector cosine similarity search finds top matching chunks (user-scoped)
5. Server sends a `citations` event with chunk metadata
6. Server assembles a prompt: system instructions + numbered chunks + question
7. Claude API streams the answer, which is forwarded as SSE `delta` events
8. Frontend renders tokens in real-time, parsing `[1]`, `[2]` markers as citation badges
9. After streaming completes, the full response + cited chunk IDs are persisted

### What file types are supported?

- **PDF** (.pdf) — extracted via `pdf-parse`
- **Plain text** (.txt) — read directly
- **Markdown** (.md) — read directly (treated as plain text for chunking)

Max file size: 10MB (enforced by multer).

### How does the chunking algorithm work?

The recursive character text splitter in `common/src/chunker/`:

1. Tries to split by the largest separator first: `\n\n` (paragraphs)
2. If chunks are still too large, falls back to `\n` (lines)
3. Then `. ` (sentences)
4. Then ` ` (words)
5. Each chunk targets ~500 tokens with 50-token overlap
6. Token count is estimated at 4 characters per token

This preserves natural document structure — paragraphs stay intact when possible.

---

## Architecture

### Why is there a separate worker process?

Document processing involves:
- Downloading files from R2
- CPU-intensive text extraction (especially PDFs)
- Multiple API calls for embedding (potentially hundreds of chunks)

This can take seconds to minutes. Running it in the API process would block HTTP requests. The worker runs independently, with BullMQ providing:
- Job queuing and persistence
- Automatic retries (3 attempts, exponential backoff)
- Concurrency control (2 concurrent jobs)
- Job status tracking

### Why pgvector instead of Pinecone/Weaviate/Qdrant?

- **Simplicity**: One database for everything (users, documents, chunks, conversations)
- **Cost**: No additional service — Neon includes pgvector for free
- **Transactions**: Can atomically insert chunks + update document status
- **Scale**: For per-user document collections (thousands of chunks), pgvector with HNSW is more than fast enough
- **SQL**: Can join chunks with documents and users using standard SQL

### What's the HNSW index and why those parameters?

HNSW (Hierarchical Navigable Small World) is a graph-based approximate nearest neighbor index.

```sql
CREATE INDEX idx_chunks_embedding ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

- `m = 16` — Number of connections per node. Higher = better recall, more memory
- `ef_construction = 64` — Build-time search breadth. Higher = better index quality, slower build
- `vector_cosine_ops` — Use cosine distance for similarity

These are balanced defaults suitable for datasets up to ~1M vectors.

### How is auth implemented?

Custom session-based auth (no Supabase Auth in this app):

1. **Register**: bcrypt-hash password, create user, generate session token
2. **Login**: Verify password, generate session token
3. **Session storage**: SHA-256 hash of token stored in `sessions` table (7-day TTL)
4. **Cookie**: Raw token set as HTTP-only, Secure, SameSite=Lax cookie named `sid`
5. **Middleware**: `loadSession` reads cookie → hashes → DB lookup → populates `req.user`
6. **CSRF**: Custom header check (`X-Requested-With`) for state-changing requests

---

## Deployment

### Where is everything deployed?

| Component | Platform | URL/Details |
|-----------|----------|-------------|
| Frontend | Vercel | `doc-qa-rag-web.vercel.app` |
| API Server | Railway | Docker container from `Dockerfile.server` |
| Worker | Railway | Docker container from `Dockerfile.worker` |
| Database | Neon | PostgreSQL + pgvector |
| File Storage | Cloudflare R2 | S3-compatible bucket |
| Queue | Railway Redis | BullMQ job queue |

### How do I deploy changes?

- **Frontend**: Push to `main` branch → Vercel auto-deploys
- **Server/Worker**: Push to `main` → Railway auto-deploys from Dockerfiles
- **Migrations**: Run manually via `DATABASE_URL=... pnpm run migrate up`

### How do the Docker builds work?

Both `Dockerfile.server` and `Dockerfile.worker` use multi-stage builds:

**Stage 1 (base)**: Install all deps, build `common` package first (dependency), then build target package.

**Stage 2 (production)**: Install only production deps, copy compiled JS from stage 1. This keeps images small by excluding TypeScript, devDependencies, and source files.

---

## Troubleshooting

### Document stuck in "processing" status?

1. Check if the worker is running
2. Check Redis connection — the worker needs it for BullMQ
3. Check worker logs for errors
4. The document may have failed silently — check for `failed` status
5. Try re-processing: `DELETE` then re-upload

### "I don't have enough information" for every question?

1. Verify the document reached `ready` status
2. Check that chunks exist in the database for that document
3. Ensure embeddings were generated (embedding column should not be null)
4. The question may be too different from the document content — try rephrasing

### CORS errors in the browser?

- Ensure `FRONTEND_URL` env var on the server matches your frontend URL exactly
- Check that credentials are included in fetch requests (`credentials: 'include'`)
- The server's CORS config allows the frontend origin with credentials

### Vercel build fails?

The web-client uses `npm install --legacy-peer-deps` (not pnpm) on Vercel due to compatibility issues with pnpm v10 in the monorepo setup. Check `web-client/vercel.json` for the build configuration.

---

## Cost & Performance

### What are the API costs?

- **OpenAI Embeddings** (text-embedding-3-small): ~$0.02 per 1M tokens. A 100-page PDF ≈ 50K tokens ≈ $0.001
- **Anthropic Claude** (completions): Varies by model. Each Q&A response uses ~2K-5K input tokens (system prompt + chunks) + ~500-1K output tokens
- **Cloudflare R2**: Free storage up to 10GB, zero egress fees

### How fast is retrieval?

With HNSW indexing, vector similarity search typically completes in <50ms for datasets under 100K chunks. The main latency is in the Claude API streaming response, not retrieval.
