# Track A4: Worker Internals Convention Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `apps/worker` into directory/clean-code compliance (R-220, R-222, R-223, R-226, R-227, R-229, R-235, R-238-family, R-239) with zero behavior change, as one PR branched off updated `main`.

**Architecture:** The worker's RAG pipeline is currently one monolithic `processors/document-processor.ts` with inline SQL, a `new Anthropic()` construction, a `db/` dir, a `utils/logger.ts` re-export, a root-level `workers.ts` mixing four concerns, a `.service`-suffixed extractor, and integration-only tests. This track decomposes the processor into an orchestrator that sequences atomic services/repositories, moves inline SQL into a repository layer, renames directories and files to the canonical vocabulary, splits `workers.ts` into a `workers/` tree, relocates tests into the `src/__tests__/` mirror, and adds unit tests for the newly-extracted atomic steps. Each step lands under a green build + the existing characterization integration test.

**Tech Stack:** TypeScript (NodeNext ESM, `app/*` path alias), BullMQ, ioredis, `pg`, `@repo/chunker`, `@repo/clients` (r2 + openai), `@anthropic-ai/sdk`, Vitest.

## Global Constraints

- No U+2014 em dash anywhere (R-001). Enforced by `no-em-dash.sh` hook.
- One PR branched off updated `main`; zero stacking; `refactor/<slug>` branch naming. Paths: `apps/worker/**` plus one root `package.json` line (wiring worker unit tests into the CI aggregate).
- Zero behavior change. The existing integration test (`processDocument`) is the characterization harness: it stays green at every commit.
- One exported function per file in `services/`, `clients/`, `repositories/` (R-235); verb-noun filenames (R-217); verb-noun function names (R-232).
- File-level header comment on every new source file (R-230); not on test files, `.d.ts`, or barrels.
- No magic strings/numbers: extract meaningful literals to named constants (R-219).
- Per-task: changed-file build + relevant tests. Pre-push: full suite + `pnpm test:integration` (R-507).
- `import 'dotenv/config'` must evaluate before any module that reads `process.env` at construction (pool, redis connection). Preserve the dynamic-import ordering guard in `index.ts`.
- Never merge a PR without explicit per-turn authorization (R-516).
- ESM import specifiers use the `.js` extension and the `app/*` alias (e.g. `app/database/pool.js`), per the existing worker convention.

---

## Target file structure

```
apps/worker/src/
  index.ts                              # entrypoint: dotenv, then dynamic-import + call startWorker()
  clients/
    anthropic.ts                        # NEW: configured Anthropic SDK singleton (mirrors apps/server/src/clients/anthropic.ts)
  database/
    pool.ts                             # MOVED from db/pool.ts; logger import -> @repo/logger
  repositories/
    documents.ts                        # NEW: updateDocumentStatus (extracted inline UPDATE)
    chunks.ts                           # NEW: insertChunk (extracted inline INSERT)
  services/
    extractText.ts                      # RENAMED from text-extractor.service.ts (one exported fn + private helpers)
    checkDocumentRelevance.ts           # NEW: relevance classification (consumes anthropic singleton)
  processors/
    processDocument.ts                  # RENAMED from document-processor.ts; pure orchestrator
  workers/
    redisConnection.ts                  # NEW: ioredis connection singleton (shared module state)
    documentProcessWorker.ts            # NEW: BullMQ Worker factory + event handlers
    startHealthServer.ts                # NEW: health HTTP server
    startWorker.ts                      # NEW: orchestrator wiring connection + worker + health + shutdown
  types/
    pdf-parse.d.ts                      # unchanged
  __tests__/
    services/
      extractText.test.ts               # NEW unit
      checkDocumentRelevance.test.ts    # NEW unit
    integration/
      processDocument.integration.test.ts  # MOVED+RENAMED from __integration__/document-processor.integration.test.ts
      setup.ts                          # MOVED from __integration__/setup.ts; dotenv path + pool import updated
  __fixtures__/
    policy.txt                          # MOVED from __integration__/fixtures/policy.txt (R-239)
```

Deleted by end of track: `src/db/`, `src/utils/`, `src/workers.ts`, `src/services/text-extractor.service.ts`, `src/processors/document-processor.ts`, `src/__integration__/`.

## Locked decisions (resolve at plan review)

- **D1 - Single-file taxonomy folders kept (`clients/`, `database/`, `processors/`).** `apps/server` (A3, merged) keeps `clients/anthropic.ts` and `database/pool.ts` as single-file folders because they are fixed top-level vocabulary, not incidental groupings. The worker mirrors that: `clients/anthropic.ts`, `database/pool.ts`, and `processors/processDocument.ts` stay foldered even at one file. This is a deliberate R-223 reading (taxonomy dirs are exempt from the single-file-collapse rule; incidental domain sub-groupings are not). Re-nest peers when a second module joins.
- **D2 - `repositories/` stays flat (`documents.ts`, `chunks.ts`), no per-domain subfolders, no barrels.** The worker has exactly one query per domain, so a `repositories/documents/updateDocumentStatus.ts` + `index.ts` nest would be a single-file folder (R-223 violation) plus a redundant barrel. Flat `repositories/documents.ts` (one exported fn) and `repositories/chunks.ts` (one exported fn) satisfy R-235 and R-223. Server nests because each server domain has 2+ queries; the worker does not. Re-nest into `repositories/documents/` the moment a second documents query is added.
- **D3 - Anthropic stays an app-local client, not promoted to `@repo/clients`.** A2 shared only `r2` and `openai` (both genuinely duplicated server+worker). A3 kept Anthropic app-local in the server. The worker mirrors that with its own `clients/anthropic.ts`. Promoting Anthropic to `@repo/clients` is out of A4 scope (it would touch `packages/clients` and `apps/server`, breaking the single-scope / path-disjoint rule). Note as possible future consolidation, do not do it here.
- **D4 - `@repo/clients` consumption is already done.** The spec lists "Consume `@repo/clients` for embedding/r2" under A4, but A2 already landed it: `document-processor.ts` imports `generateEmbeddings` from `@repo/clients/openai` and `downloadFile` from `@repo/clients/r2`. No A4 work required; verified by grep in Task 5.
- **D5 - Fixture moves to `__fixtures__/` per R-239.** `policy.txt` is a captured integration fixture; R-239 mandates `src/__fixtures__/`. It moves out of the co-located `fixtures/` dir.

---

## Task 1: Rename `db/` to `database/`

**Files:**

- Move: `apps/worker/src/db/pool.ts` -> `apps/worker/src/database/pool.ts`
- Modify: `apps/worker/src/database/pool.ts` (logger import)
- Modify: `apps/worker/src/processors/document-processor.ts:6` (import path)
- Modify: `apps/worker/src/__integration__/document-processor.integration.test.ts:5` (import path)
- Modify: `apps/worker/src/__integration__/setup.ts:15` (dynamic import path)

**Interfaces:**

- Produces: `app/database/pool.js` exporting named `query<T>(text, values?)` and `default` pool (signatures unchanged from `db/pool.ts`).

- [ ] **Step 1: Create the branch off updated main**

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot
git checkout main && git pull
git checkout -b refactor/trackA4-worker-internals
```

- [ ] **Step 2: Move the pool with git mv (preserves history)**

```bash
git mv apps/worker/src/db/pool.ts apps/worker/src/database/pool.ts
rmdir apps/worker/src/db 2>/dev/null || true
```

- [ ] **Step 3: Update the logger import inside the moved pool**

In `apps/worker/src/database/pool.ts`, change line 1 from `import { logger } from 'app/utils/logger.js';` to:

```typescript
import { logger } from '@repo/logger';
```

(The rest of the file is unchanged. `apps/server/src/database/pool.ts` imports `@repo/logger` directly; this matches it.)

- [ ] **Step 4: Update the three importers of `app/db/pool.js`**

- `apps/worker/src/processors/document-processor.ts:6`: `import { query } from 'app/db/pool.js';` -> `import { query } from 'app/database/pool.js';`
- `apps/worker/src/__integration__/document-processor.integration.test.ts:5`: `import pool from 'app/db/pool.js';` -> `import pool from 'app/database/pool.js';`
- `apps/worker/src/__integration__/setup.ts:15`: `const { default: pool } = await import('app/db/pool.js');` -> `const { default: pool } = await import('app/database/pool.js');`

- [ ] **Step 5: Verify no `db/pool` references remain**

Run: `grep -rn "db/pool" apps/worker/src`
Expected: no output.

- [ ] **Step 6: Build and run the integration test (characterization)**

Run:

```bash
pnpm --filter @repo/types build && pnpm --filter @repo/logger build && pnpm --filter @repo/chunker build && pnpm --filter @repo/clients build
pnpm --filter policy-pilot-worker build
pnpm --filter policy-pilot-worker test:integration
```

Expected: build succeeds; integration tests PASS (5 tests in `document-processor.integration.test.ts`). Requires a reachable `DATABASE_URL` (worker integration reads `apps/server/.env`).

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/database apps/worker/src/processors/document-processor.ts apps/worker/src/__integration__
git commit -m "refactor(A4): rename worker db/ to database/, logger to @repo/logger"
```

---

## Task 2: Rename `text-extractor.service.ts` to `services/extractText.ts` + add unit-test harness

**Files:**

- Move: `apps/worker/src/services/text-extractor.service.ts` -> `apps/worker/src/services/extractText.ts`
- Modify: `apps/worker/src/services/extractText.ts` (add header comment)
- Modify: `apps/worker/src/processors/document-processor.ts:7,50` (import + call site)
- Create: `apps/worker/vitest.config.ts` (unit test runner)
- Create: `apps/worker/src/__tests__/services/extractText.test.ts`
- Modify: `apps/worker/package.json` (add `test` script)
- Modify: `package.json` (add worker to root `test` aggregate)

**Interfaces:**

- Produces: `app/services/extractText.js` exporting `extractText(buffer: Buffer, mimeType: string): Promise<string>` (unchanged signature; private helpers `extractPdfText`, `extractDocxText`, `extractHtmlText` stay in the file per R-235 - they serve the one exported function).

- [ ] **Step 1: Move the extractor and drop the `.service` suffix**

```bash
git mv apps/worker/src/services/text-extractor.service.ts apps/worker/src/services/extractText.ts
```

- [ ] **Step 2: Add a file header to the renamed extractor**

Prepend to `apps/worker/src/services/extractText.ts` (above the imports):

```typescript
/** Extracts plain text from an uploaded document buffer, dispatching by MIME type (PDF, DOCX, HTML, plain text, markdown). */
```

(No other change; the exported function is already named `extractText`.)

- [ ] **Step 3: Update the processor's import and call site**

In `apps/worker/src/processors/document-processor.ts`:

- Line 7: `import * as textExtractor from 'app/services/text-extractor.service.js';` -> `import { extractText } from 'app/services/extractText.js';`
- Line 50: `const text = await textExtractor.extractText(fileBuffer, mimeType);` -> `const text = await extractText(fileBuffer, mimeType);`

- [ ] **Step 4: Create the unit-test vitest config**

Create `apps/worker/vitest.config.ts`:

```typescript
/** Vitest configuration for worker unit tests (excludes the live-DB integration suite). */
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      app: path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['src/__tests__/integration/**'],
  },
});
```

- [ ] **Step 5: Write the failing unit test for extractText**

Create `apps/worker/src/__tests__/services/extractText.test.ts`:

```typescript
import { extractText } from 'app/services/extractText.js';
import { describe, expect, it } from 'vitest';

const PLAIN_MIME = 'text/plain';
const MARKDOWN_MIME = 'text/markdown';
const HTML_MIME = 'text/html';
const UNSUPPORTED_MIME = 'image/png';

describe('extractText', () => {
  it('returns UTF-8 text unchanged for plain text', async () => {
    const result = await extractText(Buffer.from('hello policy'), PLAIN_MIME);
    expect(result).toBe('hello policy');
  });

  it('returns UTF-8 text unchanged for markdown', async () => {
    const result = await extractText(
      Buffer.from('# Heading\nbody'),
      MARKDOWN_MIME,
    );
    expect(result).toBe('# Heading\nbody');
  });

  it('strips tags, scripts, and styles from HTML', async () => {
    const html =
      '<style>.x{color:red}</style><p>Remote work <b>policy</b></p><script>alert(1)</script>';
    const result = await extractText(Buffer.from(html), HTML_MIME);
    expect(result).toBe('Remote work policy');
  });

  it('throws on an unsupported MIME type', async () => {
    await expect(
      extractText(Buffer.from('x'), UNSUPPORTED_MIME),
    ).rejects.toThrow(/Unsupported mime type/);
  });
});
```

- [ ] **Step 6: Add the `test` script to the worker package**

In `apps/worker/package.json` `scripts`, add (alphabetical placement before `test:integration`):

```json
"test": "vitest run",
```

- [ ] **Step 7: Wire worker unit tests into the root CI aggregate**

In the root `package.json`, change the `test` script from:

```json
"test": "pnpm --filter @repo/chunker run test && pnpm --filter @repo/clients run test && pnpm --filter policy-pilot-server run test",
```

to append the worker:

```json
"test": "pnpm --filter @repo/chunker run test && pnpm --filter @repo/clients run test && pnpm --filter policy-pilot-server run test && pnpm --filter policy-pilot-worker run test",
```

- [ ] **Step 8: Run the unit test and confirm it passes**

Run: `pnpm --filter policy-pilot-worker test`
Expected: 4 tests PASS in `extractText.test.ts`. (Confirms the harness, config, and rename all resolve.)

- [ ] **Step 9: Build and confirm integration still green**

Run: `pnpm --filter policy-pilot-worker build && pnpm --filter policy-pilot-worker test:integration`
Expected: build succeeds; 5 integration tests PASS.

- [ ] **Step 10: Verify no stale references**

Run: `grep -rn "text-extractor\|textExtractor" apps/worker/src`
Expected: no output.

- [ ] **Step 11: Commit**

```bash
git add apps/worker/src/services/extractText.ts apps/worker/src/processors/document-processor.ts apps/worker/vitest.config.ts apps/worker/src/__tests__/services/extractText.test.ts apps/worker/package.json package.json
git commit -m "refactor(A4): rename text-extractor to services/extractText, add worker unit harness"
```

---

## Task 3: Extract the relevance check into `services/checkDocumentRelevance.ts` + `clients/anthropic.ts`

**Files:**

- Create: `apps/worker/src/clients/anthropic.ts`
- Create: `apps/worker/src/services/checkDocumentRelevance.ts`
- Create: `apps/worker/src/__tests__/services/checkDocumentRelevance.test.ts`
- Modify: `apps/worker/src/processors/document-processor.ts` (remove inline `new Anthropic()` + inline relevance block; call the new service)

**Interfaces:**

- Consumes: `app/clients/anthropic.js` exporting `anthropic` (configured `Anthropic` singleton).
- Produces: `app/services/checkDocumentRelevance.js` exporting
  `checkDocumentRelevance(text: string, log: Logger): Promise<DocumentRelevance>`
  where `DocumentRelevance = { isRelevant: boolean; reason: string; score: number }` and `log` is the pino child logger from the processor. Behavior preserved exactly: a parse failure or an Anthropic API error returns `{ isRelevant: true, reason: '', score: 1 }` (process proceeds); a parsed `score < 0.5` returns `isRelevant: false`.

- [ ] **Step 1: Create the Anthropic singleton client (mirrors the server)**

Create `apps/worker/src/clients/anthropic.ts`:

```typescript
/** Configured Anthropic SDK singleton: the single place the LLM SDK is constructed, so services never call `new Anthropic()` directly (R-222, R-224). */
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

- [ ] **Step 2: Write the failing unit test for checkDocumentRelevance**

Create `apps/worker/src/__tests__/services/checkDocumentRelevance.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('app/clients/anthropic.js', () => ({
  anthropic: { messages: { create: mockCreate } },
}));

const { checkDocumentRelevance } =
  await import('app/services/checkDocumentRelevance.js');

const log = {
  info: vi.fn(),
  warn: vi.fn(),
} as unknown as Parameters<typeof checkDocumentRelevance>[1];

function textResponse(body: string) {
  return { content: [{ type: 'text', text: body }] };
}

describe('checkDocumentRelevance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks a high-scoring document relevant', async () => {
    mockCreate.mockResolvedValue(
      textResponse('{"score": 0.9, "reason": "HR policy"}'),
    );
    const result = await checkDocumentRelevance('some policy text', log);
    expect(result.isRelevant).toBe(true);
    expect(result.score).toBe(0.9);
    expect(result.reason).toBe('HR policy');
  });

  it('marks a low-scoring document not relevant', async () => {
    mockCreate.mockResolvedValue(
      textResponse('{"score": 0.2, "reason": "not a policy"}'),
    );
    const result = await checkDocumentRelevance('random text', log);
    expect(result.isRelevant).toBe(false);
    expect(result.reason).toBe('not a policy');
  });

  it('proceeds (relevant) when the response is unparseable', async () => {
    mockCreate.mockResolvedValue(textResponse('not json'));
    const result = await checkDocumentRelevance('text', log);
    expect(result.isRelevant).toBe(true);
    expect(result.score).toBe(1);
  });

  it('proceeds (relevant) when the Anthropic call throws', async () => {
    mockCreate.mockRejectedValue(new Error('api down'));
    const result = await checkDocumentRelevance('text', log);
    expect(result.isRelevant).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter policy-pilot-worker test checkDocumentRelevance`
Expected: FAIL with "Cannot find module 'app/services/checkDocumentRelevance.js'".

- [ ] **Step 4: Implement the relevance service**

Create `apps/worker/src/services/checkDocumentRelevance.ts`:

```typescript
/** Classifies whether a document is policy-related via a cheap Anthropic call; on any parse or API failure it fails open (treats the document as relevant) so processing continues. */
import { anthropic } from 'app/clients/anthropic.js';
import type { Logger } from 'pino';

export interface DocumentRelevance {
  isRelevant: boolean;
  reason: string;
  score: number;
}

const RELEVANCE_MODEL = 'claude-haiku-4-5-20251001';
const RELEVANCE_MAX_TOKENS = 100;
const RELEVANCE_THRESHOLD = 0.5;
const PREVIEW_LENGTH = 2000;
const RELEVANT_BY_DEFAULT: DocumentRelevance = {
  isRelevant: true,
  reason: '',
  score: 1,
};

export async function checkDocumentRelevance(
  text: string,
  log: Logger,
): Promise<DocumentRelevance> {
  const preview = text.slice(0, PREVIEW_LENGTH);
  try {
    const response = await anthropic.messages.create({
      model: RELEVANCE_MODEL,
      max_tokens: RELEVANCE_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: `Classify this document. Is it an employee policy document, company handbook, HR document, compliance manual, or standard operating procedure? Respond with JSON only: {"score": 0.0-1.0, "reason": "brief explanation"}\n\nDocument preview:\n${preview}`,
        },
      ],
    });

    const block = response.content[0];
    const relevanceText = block?.type === 'text' ? block.text : '';

    let score = 1;
    let reason = '';
    try {
      const parsed = JSON.parse(relevanceText);
      score = typeof parsed.score === 'number' ? parsed.score : 1;
      reason = typeof parsed.reason === 'string' ? parsed.reason : '';
    } catch {
      log.warn('Could not parse relevance response, proceeding anyway');
      return RELEVANT_BY_DEFAULT;
    }

    return { isRelevant: score >= RELEVANCE_THRESHOLD, reason, score };
  } catch (err) {
    log.warn({ err }, 'Relevance check failed, proceeding with processing');
    return RELEVANT_BY_DEFAULT;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter policy-pilot-worker test checkDocumentRelevance`
Expected: 4 tests PASS.

- [ ] **Step 6: Rewire the processor to use the service**

In `apps/worker/src/processors/document-processor.ts`:

- Remove the `import Anthropic from '@anthropic-ai/sdk';` (line 1) and the `const anthropic = new Anthropic(...)` block (lines 11-13).
- Add `import { checkDocumentRelevance } from 'app/services/checkDocumentRelevance.js';` to the import group.
- Replace the entire relevance block (the `// 2b. Relevance check` section, lines ~59-104) with:

```typescript
    // 2b. Relevance check
    log.info('Running relevance check');
    const relevance = await checkDocumentRelevance(text, log);
    if (!relevance.isRelevant) {
      log.info(
        { relevanceScore: relevance.score, relevanceReason: relevance.reason },
        'Document rejected as not policy-related',
      );
      await updateStatus(documentId, 'rejected', {
        error: `This doesn't appear to be a policy document: ${relevance.reason}`,
      });
      return;
    }
    log.info({ relevanceScore: relevance.score }, 'Document passed relevance check');
```

- [ ] **Step 7: Verify the SDK is no longer constructed in the processor**

Run: `grep -rn "new Anthropic\|@anthropic-ai/sdk" apps/worker/src/processors`
Expected: no output. (The only `@anthropic-ai/sdk` import is now in `clients/anthropic.ts`.)

- [ ] **Step 8: Build, unit, integration**

Run:

```bash
pnpm --filter policy-pilot-worker build
pnpm --filter policy-pilot-worker test
pnpm --filter policy-pilot-worker test:integration
```

Expected: build succeeds; all unit tests PASS (8 total); 5 integration tests PASS. The integration test mocks `@anthropic-ai/sdk`'s default constructor, which `clients/anthropic.ts` invokes at import - the mock still intercepts, so the `rejected`-status test still drives the low-score path.

- [ ] **Step 9: Commit**

```bash
git add apps/worker/src/clients apps/worker/src/services/checkDocumentRelevance.ts apps/worker/src/__tests__/services/checkDocumentRelevance.test.ts apps/worker/src/processors/document-processor.ts
git commit -m "refactor(A4): extract relevance check into service + anthropic client singleton"
```

---

## Task 4: Move inline SQL into a repository layer

**Files:**

- Create: `apps/worker/src/repositories/documents.ts` (`updateDocumentStatus`)
- Create: `apps/worker/src/repositories/chunks.ts` (`insertChunk`)
- Modify: `apps/worker/src/processors/document-processor.ts` (remove inline `updateStatus` + inline INSERT; call repositories)

**Interfaces:**

- Consumes: `app/database/pool.js` `query`.
- Produces:
  - `app/repositories/documents.js` exporting
    `updateDocumentStatus(documentId: string, status: string, extra?: { total_chunks?: number; error?: string }): Promise<void>` (same dynamic-column UPDATE as the current inline `updateStatus`).
  - `app/repositories/chunks.js` exporting
    `insertChunk(documentId: string, userId: string, chunk: TextChunk, embedding: number[]): Promise<void>` where `TextChunk` is imported from `@repo/chunker`.

- [ ] **Step 1: Create the documents repository**

Create `apps/worker/src/repositories/documents.ts`:

```typescript
/** Worker-side document write: updates a document's processing status and optional chunk-count/error fields. */
import { query } from 'app/database/pool.js';

interface StatusFields {
  error?: string;
  total_chunks?: number;
}

export async function updateDocumentStatus(
  documentId: string,
  status: string,
  extra?: StatusFields,
): Promise<void> {
  const sets = ['status = $2'];
  const values: unknown[] = [documentId, status];
  let idx = 3;
  if (extra?.total_chunks !== undefined) {
    sets.push(`total_chunks = $${idx}`);
    values.push(extra.total_chunks);
    idx++;
  }
  if (extra?.error !== undefined) {
    sets.push(`error = $${idx}`);
    values.push(extra.error);
    idx++;
  }
  await query(`UPDATE documents SET ${sets.join(', ')} WHERE id = $1`, values);
}
```

- [ ] **Step 2: Create the chunks repository**

Create `apps/worker/src/repositories/chunks.ts`:

```typescript
/** Worker-side chunk write: inserts a single embedded chunk row into the pgvector-backed chunks table. */
import type { TextChunk } from '@repo/chunker';
import { query } from 'app/database/pool.js';

export async function insertChunk(
  documentId: string,
  userId: string,
  chunk: TextChunk,
  embedding: number[],
): Promise<void> {
  const embeddingStr = `[${embedding.join(',')}]`;
  await query(
    `INSERT INTO chunks (document_id, user_id, chunk_index, content, token_count, embedding)
     VALUES ($1, $2, $3, $4, $5, $6::vector)`,
    [
      documentId,
      userId,
      chunk.index,
      chunk.content,
      chunk.tokenCount,
      embeddingStr,
    ],
  );
}
```

- [ ] **Step 3: Rewire the processor to use the repositories**

In `apps/worker/src/processors/document-processor.ts`:

- Remove the entire `async function updateStatus(...)` helper (lines ~15-34).
- Remove the `import { query } from 'app/database/pool.js';` import (no longer used directly).
- Add to the import group:

```typescript
import { insertChunk } from 'app/repositories/chunks.js';
import { updateDocumentStatus } from 'app/repositories/documents.js';
```

- Replace every `updateStatus(` call with `updateDocumentStatus(` (the chunking status, the no-text `failed`, the `rejected` path, the `embedding` status, the final `ready`, and the catch-block `failed`).
- Replace the chunk-storage loop (lines ~118-136) with:

```typescript
// 5. Store chunks + embeddings in pgvector
log.info('Storing chunks in database');
for (let i = 0; i < chunks.length; i++) {
  await insertChunk(documentId, userId, chunks[i]!, embeddings[i]!);
}
```

- [ ] **Step 4: Verify no inline SQL remains in the processor**

Run: `grep -nE "INSERT INTO|UPDATE documents|query\(" apps/worker/src/processors/document-processor.ts`
Expected: no output.

- [ ] **Step 5: Build and run integration (characterization covers the repositories)**

Run:

```bash
pnpm --filter policy-pilot-worker build
pnpm --filter policy-pilot-worker test:integration
```

Expected: build succeeds; 5 integration tests PASS (they assert `status = 'ready'`, `total_chunks`, the stored chunk count, the `failed` no-text path, and the `rejected` path - exercising both repositories end-to-end against the live DB).

Note: no isolated repository unit tests are added. Mocking the pool in a repository test is an R-200 anti-pattern (#5); the live-DB integration test is the correct coverage layer.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/repositories apps/worker/src/processors/document-processor.ts
git commit -m "refactor(A4): move worker inline SQL into documents + chunks repositories"
```

---

## Task 5: Finalize the processor as an orchestrator and rename to `processDocument.ts`

**Files:**

- Move: `apps/worker/src/processors/document-processor.ts` -> `apps/worker/src/processors/processDocument.ts`
- Modify: `apps/worker/src/processors/processDocument.ts` (header comment, logger import, NO_TEXT_ERROR constant, final orchestrator read)
- Modify: `apps/worker/src/workers.ts:2` (import path)
- Modify: `apps/worker/src/__integration__/document-processor.integration.test.ts:6` (import path)

**Interfaces:**

- Produces: `app/processors/processDocument.js` exporting `processDocument(job: Job<DocumentProcessJob>): Promise<void>` (unchanged signature).

- [ ] **Step 1: Confirm D4 - @repo/clients already consumed**

Run: `grep -n "@repo/clients" apps/worker/src/processors/document-processor.ts`
Expected: two lines (`generateEmbeddings` from `@repo/clients/openai`, `downloadFile` from `@repo/clients/r2`). No further action; the spec's "consume @repo/clients" item is already satisfied by A2.

- [ ] **Step 2: Rename the processor file**

```bash
git mv apps/worker/src/processors/document-processor.ts apps/worker/src/processors/processDocument.ts
```

- [ ] **Step 3: Add a header comment and update the logger import**

In `apps/worker/src/processors/processDocument.ts`:

- Prepend the header (above imports):

```typescript
/** BullMQ job orchestrator for the document RAG pipeline: download, extract, relevance-check, chunk, embed, store, sequencing the worker's atomic services and repositories (R-227). */
```

- Change the logger import to `import { logger } from '@repo/logger';`.

- [ ] **Step 4: Extract the no-text error literal to a named constant (R-219)**

Add near the top of the module body:

```typescript
const NO_TEXT_ERROR = 'No text content found in document';
```

and use it in the no-text `failed` branch:

```typescript
await updateDocumentStatus(documentId, 'failed', { error: NO_TEXT_ERROR });
```

- [ ] **Step 5: Read the orchestrator with fresh eyes (R-227 self-check)**

Confirm `processDocument`'s body now only: destructures `job.data`, builds the child logger, and sequences `downloadFile -> updateDocumentStatus -> extractText -> (guard) -> checkDocumentRelevance -> (guard) -> chunkText -> updateDocumentStatus -> generateEmbeddings -> insertChunk loop -> updateDocumentStatus -> catch`. No inline business logic remains (no SQL, no JSON parsing, no SDK construction). The numbered `// 1.`..`// 6.` step comments may stay as they aid the flow narrative.

- [ ] **Step 6: Update the two importers of the old processor path**

- `apps/worker/src/workers.ts:2`: `import { processDocument } from 'app/processors/document-processor.js';` -> `import { processDocument } from 'app/processors/processDocument.js';`
- `apps/worker/src/__integration__/document-processor.integration.test.ts:6`: `import { processDocument } from 'app/processors/document-processor.js';` -> `import { processDocument } from 'app/processors/processDocument.js';`

- [ ] **Step 7: Verify no stale processor references**

Run: `grep -rn "document-processor" apps/worker/src`
Expected: only the integration test FILENAME matches (it relocates in Task 7); no `import ... document-processor.js` specifiers remain.

- [ ] **Step 8: Build, unit, integration**

Run:

```bash
pnpm --filter policy-pilot-worker build
pnpm --filter policy-pilot-worker test
pnpm --filter policy-pilot-worker test:integration
```

Expected: build succeeds; 8 unit PASS; 5 integration PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/worker/src/processors/processDocument.ts apps/worker/src/workers.ts apps/worker/src/__integration__/document-processor.integration.test.ts
git commit -m "refactor(A4): finalize processDocument orchestrator, verb-noun filename"
```

---

## Task 6: Split `workers.ts` into a `workers/` tree

**Files:**

- Create: `apps/worker/src/workers/redisConnection.ts`
- Create: `apps/worker/src/workers/documentProcessWorker.ts`
- Create: `apps/worker/src/workers/startHealthServer.ts`
- Create: `apps/worker/src/workers/startWorker.ts`
- Delete: `apps/worker/src/workers.ts`
- Delete: `apps/worker/src/utils/logger.ts` (last importer removed; `utils/` eliminated, R-220)
- Modify: `apps/worker/src/index.ts` (call `startWorker`)

**Interfaces:**

- Produces:
  - `app/workers/redisConnection.js` exporting `connection` (ioredis singleton).
  - `app/workers/documentProcessWorker.js` exporting `createDocumentProcessWorker(): Worker<DocumentProcessJob>`.
  - `app/workers/startHealthServer.js` exporting `startHealthServer(): Server`.
  - `app/workers/startWorker.js` exporting `startWorker(): void` (orchestrates connection + worker + health server + shutdown handlers).

- [ ] **Step 1: Create the redis connection singleton (shared module state)**

Create `apps/worker/src/workers/redisConnection.ts`:

```typescript
/** Shared ioredis connection singleton for the BullMQ worker; isolated so the worker factory and shutdown handler import the same instance (R-235 shared-state module). */
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const connection = new IORedis.default(REDIS_URL, {
  maxRetriesPerRequest: null,
});
```

- [ ] **Step 2: Create the BullMQ worker factory**

Create `apps/worker/src/workers/documentProcessWorker.ts`:

```typescript
/** Constructs the BullMQ Worker for the document-process queue and attaches its lifecycle event handlers. */
import { logger } from '@repo/logger';
import type { DocumentProcessJob } from '@repo/types';
import { processDocument } from 'app/processors/processDocument.js';
import { connection } from 'app/workers/redisConnection.js';
import { Worker } from 'bullmq';

const QUEUE_NAME = 'document-process';
const WORKER_CONCURRENCY = 2;

export function createDocumentProcessWorker(): Worker<DocumentProcessJob> {
  const worker = new Worker<DocumentProcessJob>(
    QUEUE_NAME,
    async (job) => {
      logger.info(
        { jobId: job.id, documentId: job.data.documentId },
        'Processing document',
      );
      await processDocument(job);
    },
    { connection, concurrency: WORKER_CONCURRENCY },
  );

  worker.on('completed', (job) => {
    logger.info(
      { jobId: job.id, documentId: job.data.documentId },
      'Job completed',
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, documentId: job?.data.documentId, err },
      'Job failed',
    );
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker error');
  });

  return worker;
}
```

- [ ] **Step 3: Create the health server starter**

Create `apps/worker/src/workers/startHealthServer.ts`:

```typescript
/** Starts the minimal HTTP health-check server Railway probes to confirm the worker process is live. */
import http from 'node:http';
import type { Server } from 'node:http';

const DEFAULT_HEALTH_PORT = 3002;
const HEALTH_OK_BODY = 'ok';

export function startHealthServer(): Server {
  const server = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end(HEALTH_OK_BODY);
  });
  server.listen(
    Number(process.env.PORT || process.env.WORKER_PORT) || DEFAULT_HEALTH_PORT,
  );
  return server;
}
```

- [ ] **Step 4: Create the startWorker orchestrator**

Create `apps/worker/src/workers/startWorker.ts`:

```typescript
/** Boots the worker process: starts the BullMQ worker and health server, then registers graceful-shutdown handlers for SIGTERM/SIGINT. */
import { logger } from '@repo/logger';
import { createDocumentProcessWorker } from 'app/workers/documentProcessWorker.js';
import { connection } from 'app/workers/redisConnection.js';
import { startHealthServer } from 'app/workers/startHealthServer.js';

export function startWorker(): void {
  const worker = createDocumentProcessWorker();
  const healthServer = startHealthServer();

  logger.info('Document processing worker started');

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutting down worker gracefully');
    await worker.close();
    await connection.quit();
    healthServer.close();
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
```

(Note: `void shutdown(...)` satisfies R-215 - no floating-promise IIFE, the handler calls a named async function.)

- [ ] **Step 5: Update index.ts to call startWorker**

Replace `apps/worker/src/index.ts` contents with:

```typescript
import 'dotenv/config';

const { startWorker } = await import('app/workers/startWorker.js');
startWorker();
```

(The dynamic import preserves the existing guarantee that `dotenv/config` runs before `redisConnection.ts` and `database/pool.ts` read `process.env` at construction.)

- [ ] **Step 6: Delete the old monolith and the utils re-export**

```bash
git rm apps/worker/src/workers.ts apps/worker/src/utils/logger.ts
rmdir apps/worker/src/utils 2>/dev/null || true
```

- [ ] **Step 7: Verify `utils/` is gone and no stale references**

Run:

```bash
grep -rn "utils/logger\|app/workers.js" apps/worker/src
test -d apps/worker/src/utils && echo "utils STILL EXISTS" || echo "utils removed"
```

Expected: no grep output; "utils removed".

- [ ] **Step 8: Build and smoke (the worker actually starts)**

Run:

```bash
pnpm --filter policy-pilot-worker build
pnpm --filter policy-pilot-worker test:integration
```

Expected: build succeeds; 5 integration tests PASS. (The integration test imports `processDocument` directly and does not boot `startWorker`, so it isolates the pipeline from the BullMQ/redis wiring.)

Optional manual smoke (if Redis is running locally): `node apps/worker/dist/index.js` should log "Document processing worker started" and respond `ok` on the health port, then Ctrl-C exits gracefully.

- [ ] **Step 9: Commit**

```bash
git add apps/worker/src/workers apps/worker/src/index.ts
git commit -m "refactor(A4): split workers.ts into workers/ tree, eliminate utils/"
```

---

## Task 7: Relocate tests into the `src/__tests__/` mirror and `__fixtures__/`

**Files:**

- Move: `apps/worker/src/__integration__/document-processor.integration.test.ts` -> `apps/worker/src/__tests__/integration/processDocument.integration.test.ts`
- Move: `apps/worker/src/__integration__/setup.ts` -> `apps/worker/src/__tests__/integration/setup.ts`
- Move: `apps/worker/src/__integration__/fixtures/policy.txt` -> `apps/worker/src/__fixtures__/policy.txt`
- Modify: relocated `setup.ts` (dotenv relative path: one extra `../`)
- Modify: relocated integration test (fixture path -> `__fixtures__/`)
- Modify: `apps/worker/vitest.integration.config.ts` (`include` + `setupFiles` paths)

**Interfaces:** none changed; this is pure relocation + path fixes.

- [ ] **Step 1: Move the integration test, setup, and fixture**

```bash
mkdir -p apps/worker/src/__tests__/integration apps/worker/src/__fixtures__
git mv apps/worker/src/__integration__/document-processor.integration.test.ts apps/worker/src/__tests__/integration/processDocument.integration.test.ts
git mv apps/worker/src/__integration__/setup.ts apps/worker/src/__tests__/integration/setup.ts
git mv apps/worker/src/__integration__/fixtures/policy.txt apps/worker/src/__fixtures__/policy.txt
rmdir apps/worker/src/__integration__/fixtures apps/worker/src/__integration__ 2>/dev/null || true
```

- [ ] **Step 2: Fix the dotenv relative path in the relocated setup**

The file moved one directory deeper (`__integration__/` -> `__tests__/integration/`), so the path to the repo root gains one `../`. In `apps/worker/src/__tests__/integration/setup.ts`, change:

```typescript
config({ path: path.resolve(__dirname, '../../../../apps/server/.env') });
```

to:

```typescript
config({ path: path.resolve(__dirname, '../../../../../apps/server/.env') });
```

- [ ] **Step 3: Fix the fixture path in the relocated integration test**

The fixture moved from `__integration__/fixtures/policy.txt` to `src/__fixtures__/policy.txt`. From `src/__tests__/integration/`, that is `../../__fixtures__/`. In `processDocument.integration.test.ts`, change:

```typescript
const POLICY_FIXTURE = path.resolve(__dirname, 'fixtures/policy.txt');
```

to:

```typescript
const POLICY_FIXTURE = path.resolve(__dirname, '../../__fixtures__/policy.txt');
```

- [ ] **Step 4: Update the integration vitest config paths**

In `apps/worker/vitest.integration.config.ts`:

- `include: ['src/__integration__/**/*.test.ts'],` -> `include: ['src/__tests__/integration/**/*.test.ts'],`
- `setupFiles: ['src/__integration__/setup.ts'],` -> `setupFiles: ['src/__tests__/integration/setup.ts'],`

- [ ] **Step 5: Verify the old test dir is gone**

Run:

```bash
test -d apps/worker/src/__integration__ && echo "STILL EXISTS" || echo "removed"
grep -rn "__integration__" apps/worker
```

Expected: "removed"; no grep output.

- [ ] **Step 6: Full worker verification**

Run:

```bash
pnpm --filter policy-pilot-worker build
pnpm --filter policy-pilot-worker test
pnpm --filter policy-pilot-worker test:integration
pnpm --filter policy-pilot-worker lint
```

Expected: build succeeds; 8 unit PASS; 5 integration PASS (the relocated setup resolves `apps/server/.env` and the fixture loads); lint 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/__tests__ apps/worker/src/__fixtures__ apps/worker/vitest.integration.config.ts
git commit -m "refactor(A4): relocate worker tests to src/__tests__ mirror + __fixtures__"
```

---

## Final verification (before PR)

- [ ] **Step 1: Whole-repo build + full suites**

```bash
pnpm build
pnpm test
pnpm test:integration
```

Expected: all green. `pnpm test` now includes the worker unit suite (8 tests).

- [ ] **Step 2: Compliance greps**

```bash
cd apps/worker
grep -rn "db/pool\|utils/logger\|text-extractor\|document-processor\|app/workers.js\|__integration__" src && echo "FAIL: stale refs" || echo "clean: no stale refs"
test -d src/db -o -d src/utils && echo "FAIL: legacy dirs" || echo "clean: no db/ or utils/"
grep -rn "new Anthropic\|INSERT INTO\|UPDATE documents" src/processors && echo "FAIL: inline" || echo "clean: processor has no SDK/SQL"
cd ../..
```

Expected: "clean" on all three.

- [ ] **Step 3: Em-dash sweep (R-001)**

```bash
grep -rnP "\xe2\x80\x94" apps/worker/src && echo "FAIL: em dash present" || echo "clean: no em dash"
```

Expected: "clean".

- [ ] **Step 4: package.json deps audit (gap-pattern #2)**

The processor no longer imports `@anthropic-ai/sdk` directly, but `clients/anthropic.ts` does, so the dep stays. Confirm nothing was orphaned:

```bash
grep -rn "@anthropic-ai/sdk" apps/worker/src
```

Expected: exactly one hit - `src/clients/anthropic.ts`. (Dep still required; do NOT drop it.) `mammoth`, `pdf-parse`, `ioredis`, `bullmq`, `pg` all still imported. No `package.json` dependency removals in this track.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin refactor/trackA4-worker-internals
gh pr create --title "refactor(A4): worker internals convention compliance" --body-file docs/prs/2026-06-22-trackA4-worker-internals.md
```

(Write the PR doc first per project PR Workflow: summary, what-changed, D1-D5 decisions, testing, reflection.) Do not merge without explicit per-turn authorization (R-516).

---

## Self-Review

**1. Spec coverage** (design spec section A4, lines 127-137):

- `db/` -> `database/`: Task 1.
- Decompose `document-processor.ts` into orchestrator + atomic steps (download, extract, chunk, embed, store): Tasks 3 (relevance service), 4 (repositories), 5 (orchestrator finalization). Download/chunk/embed are already atomic external calls; extract is Task 2's service; store is Task 4's `insertChunk`.
- Move inline SQL into a repository layer: Task 4.
- Restructure `workers.ts` into a `workers/` tree (worker setup, health server, shutdown): Task 6.
- `text-extractor.service.ts` -> verb-noun one-function-per-file: Task 2.
- Consume `@repo/clients` for embedding/r2: already done by A2 (D4), verified Task 5 Step 1.
- Test consolidation as A3 + unit tests for newly-extracted atomic steps: Task 2 (extractText unit), Task 3 (checkDocumentRelevance unit), Task 7 (relocation). Repositories covered by integration per R-200 #5.
- Done when: processor decomposed, no inline SQL, tests relocated, new step tests green - all covered by the final verification.

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step shows complete code. Every command has expected output.

**3. Type consistency:** `updateDocumentStatus(documentId, status, extra?)` defined in Task 4, called in Tasks 4-5. `checkDocumentRelevance(text, log) -> DocumentRelevance{isRelevant,reason,score}` defined in Task 3, consumed in Task 3 Step 6 (`relevance.isRelevant`, `.score`, `.reason`). `insertChunk(documentId, userId, chunk: TextChunk, embedding: number[])` defined in Task 4, called in Task 4 Step 3. `createDocumentProcessWorker()`, `startHealthServer()`, `startWorker()`, `connection` consistent across Task 6. `extractText(buffer, mimeType)` unchanged from the original.

**Gap-pattern pre-flight (project memory `refactor-plan-gap-patterns`):**

- #1 (mock sites): grepped - the only `vi.mock` targets are `@repo/clients/r2`, `@repo/clients/openai`, `@anthropic-ai/sdk`, none of which A4 moves. No worker module being moved is `vi.mock`'d. Safe.
- #2 (orphaned deps after re-export): no module is converted to a re-export in A4 (`utils/logger.ts`, the only existing re-export, is deleted, not introduced). `@anthropic-ai/sdk` relocates construction but stays imported (clients/anthropic.ts). Verified in final verification Step 4. No deps to drop.
