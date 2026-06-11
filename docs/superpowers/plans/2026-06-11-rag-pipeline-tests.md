# RAG Pipeline Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the full PolicyPilot upload-to-Q&A pipeline works via a worker integration test and a Playwright E2E test.

**Architecture:** Task 0 fixes a missing `GET /collections/:id/documents` server route that the web client already calls (prerequisite for all subsequent tasks). Task 1 bootstraps vitest infrastructure in `apps/worker`. Task 2 feeds a plain-text fixture through `processDocument()` against the real DB with R2/embeddings/Anthropic mocked, asserting chunks land in pgvector with status `ready`. Task 3 adds the worker to Playwright's webServer array, then drives the browser through login, create collection, upload, poll ready, navigate to chat, and assert a `[1]` citation.

**Tech Stack:** Express 5, TypeScript NodeNext, vitest, Playwright, pg/pgvector, pnpm workspaces, BullMQ

---

## File map

| Action | Path                                                                     |
| ------ | ------------------------------------------------------------------------ |
| Modify | `apps/server/src/handlers/documents/documents.ts`                        |
| Modify | `apps/server/src/routes/collections.ts`                                  |
| Modify | `apps/worker/package.json`                                               |
| Create | `apps/worker/vitest.integration.config.ts`                               |
| Create | `apps/worker/src/__integration__/setup.ts`                               |
| Create | `apps/worker/src/__integration__/fixtures/policy.txt`                    |
| Create | `apps/worker/src/__integration__/document-processor.integration.test.ts` |
| Modify | `playwright.config.ts`                                                   |
| Create | `e2e/rag-pipeline.spec.ts`                                               |
| Modify | `package.json` (root)                                                    |

---

## Task 0: Fix missing GET /collections/:id/documents route

The web client calls `GET /collections/:id/documents` but the server has no such route. This is a prerequisite for the E2E test: the collection page receives a 404 without it, and the document list never renders.

**Files:**

- Modify: `apps/server/src/handlers/documents/documents.ts`
- Modify: `apps/server/src/routes/collections.ts`

- [ ] **Step 1: Write the failing test**

Check whether `apps/server/src/__integration__/collections.test.ts` already exists. If it does, add the describe block below to that file. If it does not exist, create it with the full content shown.

```ts
import { app } from 'app/app.js';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

describe('GET /collections/:id/documents', () => {
  it('returns documents array for a user-owned collection', async () => {
    const email = `col-docs-${Date.now()}@integration-test.invalid`;

    await request(app)
      .post('/auth/register')
      .send({ email, password: 'password123', first_name: 'T', last_name: 'T' })
      .expect(201);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    const cookie = loginRes.headers['set-cookie'] as string;

    const colRes = await request(app)
      .post('/collections')
      .set('Cookie', cookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: 'test-collection' })
      .expect(201);
    const collectionId = colRes.body.collection.id as string;

    const docsRes = await request(app)
      .get(`/collections/${collectionId}/documents`)
      .set('Cookie', cookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(200);

    expect(Array.isArray(docsRes.body.documents)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test, confirm it FAILS**

```bash
cd apps/server && npx vitest run --config vitest.integration.config.ts src/__integration__/collections.test.ts
```

Expected: fails with 404 because the route does not exist.

- [ ] **Step 3: Add the handler to documents.ts**

In `apps/server/src/handlers/documents/documents.ts`, append after the `deleteDocument` export:

```ts
export async function listCollectionDocuments(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user!;
  const collectionId = req.params.id as string;
  const documents = await docsRepo.listDocuments(user.id, collectionId);
  res.json({ documents });
}
```

Note: `docsRepo` is already imported at the top of the file as `import * as docsRepo from 'app/repositories/documents/documents.js';`.

- [ ] **Step 4: Register the route in collections.ts**

The complete `apps/server/src/routes/collections.ts` after changes:

```ts
import * as collectionHandlers from 'app/handlers/collections/collections.js';
import * as documentHandlers from 'app/handlers/documents/documents.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import * as collectionsRepo from 'app/repositories/collections/collections.js';
import express from 'express';

const collectionRouter = express.Router();

collectionRouter.get('/demo', async (_req, res) => {
  const collections = await collectionsRepo.getDemoCollections();
  if (collections.length === 0) {
    res.status(404).json({ error: 'No demo collections available' });
    return;
  }
  res.json({ collections });
});

collectionRouter.use(requireAuth);
collectionRouter.get('/', collectionHandlers.listCollections);
collectionRouter.post('/', collectionHandlers.createCollection);
collectionRouter.get(
  '/:id/documents',
  documentHandlers.listCollectionDocuments,
);
collectionRouter.get('/:id', collectionHandlers.getCollection);
collectionRouter.delete('/:id', collectionHandlers.deleteCollection);

export { collectionRouter };
```

The `/:id/documents` route must be registered before `/:id` so Express doesn't attempt to match `documents` as the `:id` value.

- [ ] **Step 5: Run the test, confirm it PASSES**

```bash
cd apps/server && npx vitest run --config vitest.integration.config.ts src/__integration__/collections.test.ts
```

Expected: PASS, returns 200 with `{ documents: [] }`.

- [ ] **Step 6: Run the full server integration suite as regression baseline**

```bash
cd apps/server && npx vitest run --config vitest.integration.config.ts
```

Expected: all previously passing tests still pass.

- [ ] **Step 7: Format and commit**

```bash
npx prettier --config prettier.config.mjs --write \
  apps/server/src/handlers/documents/documents.ts \
  apps/server/src/routes/collections.ts
```

```bash
git add apps/server/src/handlers/documents/documents.ts \
        apps/server/src/routes/collections.ts
git commit -m "feat: add GET /collections/:id/documents endpoint"
```

---

## Task 1: Worker vitest integration infrastructure

`apps/worker` has zero test coverage. This task bootstraps the vitest config, dotenv setup, and the policy fixture text used by both the integration test and the E2E test.

**Files:**

- Modify: `apps/worker/package.json`
- Create: `apps/worker/vitest.integration.config.ts`
- Create: `apps/worker/src/__integration__/setup.ts`
- Create: `apps/worker/src/__integration__/fixtures/policy.txt`
- Modify: `package.json` (root)

- [ ] **Step 1: Add vitest to apps/worker devDependencies**

In `apps/worker/package.json`, add to `devDependencies`:

```json
"vitest": "^3.2.4"
```

Run from repo root:

```bash
pnpm install
```

- [ ] **Step 2: Create vitest.integration.config.ts**

`apps/worker/vitest.integration.config.ts`:

```ts
/** Vitest configuration for worker integration tests. */
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
    include: ['src/__integration__/**/*.test.ts'],
    testTimeout: 30_000,
    setupFiles: ['src/__integration__/setup.ts'],
  },
});
```

- [ ] **Step 3: Create setup.ts**

`apps/worker/src/__integration__/setup.ts`:

```ts
import pool from 'app/db/pool.js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterAll, beforeAll } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../../apps/server/.env') });

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not set; skipping worker integration tests');
    return;
  }

  await pool.query(
    "DELETE FROM chunks WHERE document_id IN (SELECT id FROM documents WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid'))",
  );
  await pool.query(
    "DELETE FROM documents WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  );
  await pool.query(
    "DELETE FROM collections WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  );
  await pool.query(
    "DELETE FROM users WHERE email LIKE '%@integration-test.invalid'",
  );
});

afterAll(async () => {
  await pool.query(
    "DELETE FROM chunks WHERE document_id IN (SELECT id FROM documents WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid'))",
  );
  await pool.query(
    "DELETE FROM documents WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  );
  await pool.query(
    "DELETE FROM collections WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  );
  await pool.query(
    "DELETE FROM users WHERE email LIKE '%@integration-test.invalid'",
  );
  await pool.end();
});
```

- [ ] **Step 4: Create the policy fixture**

`apps/worker/src/__integration__/fixtures/policy.txt`:

```
Remote Work Policy

Section 1: Eligibility
All full-time employees who have completed a 90-day probationary period are eligible for remote work arrangements. Employees must maintain satisfactory performance ratings to retain remote work privileges. Part-time employees and contractors require explicit department head approval before starting remote work.

Section 2: Equipment and Security
Remote employees must maintain a secure home workspace. Company laptops require full-disk encryption and strong password protection. All access to company systems requires the approved VPN solution. Personal devices may not access confidential company data without prior IT department approval and enrollment in device management.

Section 3: Working Hours and Availability
Remote employees must be available during core hours of 9 AM to 3 PM in their local time zone. All meetings scheduled during these hours are mandatory unless prior approval for absence is obtained. Employees must respond to communications within two hours during business hours and maintain accurate timekeeping records.

Section 4: Performance Reviews
Remote employees are evaluated using the same criteria as office-based staff, with additional focus on communication quality and self-management. Quarterly performance reviews apply to all remote staff. Repeated failure to meet availability or communication standards may result in revocation of remote work privileges and a required return to office.
```

- [ ] **Step 5: Add test:integration script to worker package.json**

In `apps/worker/package.json`, add to `scripts`:

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

- [ ] **Step 6: Expand root test:integration to cover worker**

In `package.json` (root), change:

```json
"test:integration": "pnpm --filter policy-pilot-server run test:integration",
```

to:

```json
"test:integration": "pnpm --filter policy-pilot-server run test:integration && pnpm --filter policy-pilot-worker run test:integration",
```

- [ ] **Step 7: Smoke-test the config (no test files yet)**

```bash
cd apps/worker && npx vitest run --config vitest.integration.config.ts
```

Expected: `No test files found` or `0 tests run`, no error.

- [ ] **Step 8: Format and commit**

```bash
npx prettier --config prettier.config.mjs --write \
  apps/worker/package.json \
  apps/worker/vitest.integration.config.ts \
  apps/worker/src/__integration__/setup.ts \
  package.json
```

```bash
git add apps/worker/package.json \
        apps/worker/vitest.integration.config.ts \
        apps/worker/src/__integration__/setup.ts \
        apps/worker/src/__integration__/fixtures/policy.txt \
        package.json
git commit -m "feat: bootstrap vitest integration infrastructure for worker"
```

---

## Task 2: Worker document-processor integration test

**Files:**

- Create: `apps/worker/src/__integration__/document-processor.integration.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/worker/src/__integration__/document-processor.integration.test.ts`:

```ts
/** Integration test for document-processor: real DB, mocked R2/embeddings/Anthropic. */
import pool from 'app/db/pool.js';
import { processDocument } from 'app/processors/document-processor.js';
import * as embeddingService from 'app/services/embedding.service.js';
import * as r2Service from 'app/services/r2.service.js';
import type { Job } from 'bullmq';
import { readFileSync } from 'fs';
import path from 'path';
import type { DocumentProcessJob } from 'policy-pilot-common';
import { fileURLToPath } from 'url';
import {
  type MockInstance,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const POLICY_FIXTURE = path.resolve(__dirname, 'fixtures/policy.txt');
const EMBEDDING_DIM = 1536;
const TEST_EMAIL = 'worker-processor@integration-test.invalid';
const TEST_R2_KEY = 'test/worker-integration/policy.txt';

vi.mock('app/services/r2.service.js', () => ({
  downloadFile: vi.fn(),
}));

vi.mock('app/services/embedding.service.js', () => ({
  generateEmbeddingsBatch: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    content: [
      {
        type: 'text',
        text: '{"score": 0.9, "reason": "HR policy document about remote work"}',
      },
    ],
  });
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

async function seedUser(): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, 'x', 'Worker', 'Test')
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [TEST_EMAIL],
  );
  return result.rows[0]!.id;
}

async function seedCollection(userId: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO collections (user_id, name)
     VALUES ($1, 'Worker Test Collection')
     RETURNING id`,
    [userId],
  );
  return result.rows[0]!.id;
}

async function seedDocument(
  userId: string,
  collectionId: string,
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO documents (user_id, filename, r2_key, mime_type, size_bytes, collection_id, status)
     VALUES ($1, 'policy.txt', $2, 'text/plain', 1000, $3, 'pending')
     RETURNING id`,
    [userId, TEST_R2_KEY, collectionId],
  );
  return result.rows[0]!.id;
}

function makeJob(data: DocumentProcessJob): Job<DocumentProcessJob> {
  return {
    data,
    id: 'integration-test-job',
    log: vi.fn(),
    updateProgress: vi.fn(),
  } as unknown as Job<DocumentProcessJob>;
}

describe('processDocument', () => {
  let userId: string;
  let collectionId: string;
  let documentId: string;

  beforeEach(async () => {
    vi.mocked(r2Service.downloadFile).mockResolvedValue(
      readFileSync(POLICY_FIXTURE),
    );
    vi.mocked(embeddingService.generateEmbeddingsBatch).mockImplementation(
      async (texts: string[]) => texts.map(() => Array(EMBEDDING_DIM).fill(0)),
    );

    userId = await seedUser();
    collectionId = await seedCollection(userId);
    documentId = await seedDocument(userId, collectionId);
  });

  afterEach(async () => {
    await pool.query('DELETE FROM chunks WHERE document_id = $1', [documentId]);
    await pool.query('DELETE FROM documents WHERE id = $1', [documentId]);
    await pool.query('DELETE FROM collections WHERE id = $1', [collectionId]);
  });

  it('sets status to ready and stores chunks in pgvector', async () => {
    await processDocument(
      makeJob({
        documentId,
        userId,
        r2Key: TEST_R2_KEY,
        mimeType: 'text/plain',
        collectionId,
      }),
    );

    const docRow = await pool.query<{ status: string; total_chunks: number }>(
      'SELECT status, total_chunks FROM documents WHERE id = $1',
      [documentId],
    );
    expect(docRow.rows[0]!.status).toBe('ready');
    expect(docRow.rows[0]!.total_chunks).toBeGreaterThanOrEqual(1);

    const chunkRow = await pool.query<{ count: string }>(
      'SELECT COUNT(*) FROM chunks WHERE document_id = $1',
      [documentId],
    );
    const chunkCount = parseInt(chunkRow.rows[0]!.count, 10);
    expect(chunkCount).toBeGreaterThanOrEqual(1);
    expect(chunkCount).toBe(docRow.rows[0]!.total_chunks);
  });

  it('calls r2Service.downloadFile with the r2Key', async () => {
    const downloadSpy = vi.mocked(r2Service.downloadFile) as MockInstance;

    await processDocument(
      makeJob({
        documentId,
        userId,
        r2Key: TEST_R2_KEY,
        mimeType: 'text/plain',
        collectionId,
      }),
    );

    expect(downloadSpy).toHaveBeenCalledWith(TEST_R2_KEY);
  });

  it('calls generateEmbeddingsBatch with the chunk texts', async () => {
    const embedSpy = vi.mocked(
      embeddingService.generateEmbeddingsBatch,
    ) as MockInstance;

    await processDocument(
      makeJob({
        documentId,
        userId,
        r2Key: TEST_R2_KEY,
        mimeType: 'text/plain',
        collectionId,
      }),
    );

    expect(embedSpy).toHaveBeenCalledTimes(1);
    const [chunkTexts] = embedSpy.mock.calls[0] as [string[]];
    expect(chunkTexts.length).toBeGreaterThanOrEqual(1);
    expect(typeof chunkTexts[0]).toBe('string');
  });
});
```

- [ ] **Step 2: Run the test, confirm it FAILS**

```bash
cd apps/worker && npx vitest run --config vitest.integration.config.ts
```

Expected: tests fail. If you get `Cannot find module 'policy-pilot-common'`, build the shared package first:

```bash
cd packages/common && pnpm build
```

Then retry. The important thing is FAIL (not error-out), meaning the test logic runs but assertions fail.

- [ ] **Step 3: Confirm no new implementation is needed**

`processDocument` already exists in `apps/worker/src/processors/document-processor.ts`. This test exercises existing behavior. Proceed to running it.

- [ ] **Step 4: Run the test, confirm it PASSES**

```bash
cd apps/worker && npx vitest run --config vitest.integration.config.ts
```

Expected: all 3 tests PASS.

Troubleshooting:

- `Cannot find module 'app/...'`: vitest config alias not resolving. Verify `vitest.integration.config.ts` has `resolve.alias: { app: path.resolve(__dirname, 'src') }`.
- `DATABASE_URL is not set`: confirm `apps/server/.env` exists with `DATABASE_URL`. The setup.ts loads it from `../../../../apps/server/.env` relative to `src/__integration__/`.
- SSL connection rejected: ensure `DATABASE_SSL_REJECT_UNAUTHORIZED=false` is set in `apps/server/.env` (Neon requires SSL but not cert validation in dev).

- [ ] **Step 5: Format and commit**

```bash
npx prettier --config prettier.config.mjs --write \
  apps/worker/src/__integration__/document-processor.integration.test.ts
```

```bash
git add apps/worker/src/__integration__/document-processor.integration.test.ts
git commit -m "test: worker integration test for document-processor pipeline"
```

---

## Task 3: Playwright E2E RAG pipeline test

This test drives the full user-facing flow: login, create collection, upload policy.txt, wait for the worker to process, navigate to chat, ask a question, and assert a `[1]` citation in the response.

**Files:**

- Modify: `playwright.config.ts`
- Create: `e2e/rag-pipeline.spec.ts`

- [ ] **Step 1: Check the worker's health port**

```bash
grep -n "WORKER_PORT\|health\|listen" apps/worker/src/index.ts | head -20
```

Note the health port number. The default is 3002. If the worker has no HTTP health server, the webServer entry must use `stdout` pattern matching instead of `port`. Record what you find before editing `playwright.config.ts`.

- [ ] **Step 2: Write the failing test**

`e2e/rag-pipeline.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_EMAIL = 'e2e-user@integration-test.invalid';
const TEST_PASSWORD = 'testpassword123';
const POLICY_FIXTURE = path.resolve(
  __dirname,
  '../apps/worker/src/__integration__/fixtures/policy.txt',
);
const READY_STATUS_LABEL = 'Cleared for takeoff';
const PROCESSING_TIMEOUT_MS = 120_000;

test('upload a policy document and receive a cited answer', async ({
  page,
}) => {
  // Login
  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

  // Get CSRF token (the browser session cookie is already set after login)
  const csrfRes = await page.request.get(
    'http://localhost:3001/api/csrf-token',
  );
  expect(csrfRes.ok()).toBeTruthy();
  const { token: csrfToken } = (await csrfRes.json()) as { token: string };

  // Create a user-owned collection via API (demo collections block uploads)
  const collectionName = `E2E RAG Test ${Date.now()}`;
  const colRes = await page.request.post('http://localhost:3001/collections', {
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
    },
    data: JSON.stringify({ name: collectionName }),
  });
  expect(colRes.ok()).toBeTruthy();
  const { collection } = (await colRes.json()) as {
    collection: { id: string };
  };
  const collectionId = collection.id;

  // Navigate to the collection page and upload the policy document
  await page.goto(`/collections/${collectionId}`);
  await expect(page.locator('h1')).toContainText(collectionName, {
    timeout: 5_000,
  });

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(POLICY_FIXTURE);

  // Wait for upload to complete (button re-enables)
  await expect(
    page.locator('button[aria-label="Upload a document"]'),
  ).not.toBeDisabled({ timeout: 15_000 });

  // Poll via the page's built-in 5-second refetch until status is "Cleared for takeoff"
  await expect(page.locator(`text=${READY_STATUS_LABEL}`)).toBeVisible({
    timeout: PROCESSING_TIMEOUT_MS,
  });

  // Navigate to chat
  await page.click('button[aria-label="Start chatting about this collection"]');
  await expect(page).toHaveURL(new RegExp(`/chat/${collectionId}`), {
    timeout: 5_000,
  });

  // Ask a question and wait for a cited answer
  await page.fill(
    'input[placeholder="Ask a question about your policies..."]',
    'What is the eligibility requirement for remote work?',
  );
  await page.click('button[type="submit"]');

  await expect(page.locator('[class*="message"]').last()).toContainText('[1]', {
    timeout: 30_000,
  });
});
```

- [ ] **Step 3: Add worker to playwright.config.ts webServer array**

If the worker health port is 3002, the complete `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'cd apps/server && npx tsx src/index.ts',
      port: 3001,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: '3001',
        NODE_ENV: 'test',
      },
    },
    {
      command: 'cd apps/worker && npx tsx src/index.ts',
      port: 3002,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
      },
    },
    {
      command: 'cd apps/client/web && npx next dev --port 3000',
      port: 3000,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

If the worker has no HTTP server (Step 1 found no `listen` call), use `stdout` instead of `port`:

```ts
{
  command: 'cd apps/worker && npx tsx src/index.ts',
  stdout: 'Worker',
  timeout: 20_000,
  reuseExistingServer: !process.env.CI,
  env: { NODE_ENV: 'test' },
},
```

Replace `'Worker'` with the actual startup log message you see in `apps/worker/src/index.ts`.

- [ ] **Step 4: Run the E2E test**

```bash
npx playwright test e2e/rag-pipeline.spec.ts --headed
```

Expected: PASS. Processing the plain-text fixture takes 5-30 seconds. The test allows 120 seconds.

If it times out at "Cleared for takeoff":

1. Check the worker stdout in the Playwright output (is BullMQ connected to Redis?).
2. Query Neon directly: `SELECT status, error FROM documents ORDER BY created_at DESC LIMIT 5;`

If it fails at `[1]` assertion:

1. Inspect the chat page in headed mode. If the CSS selector `[class*="message"]` doesn't match the response container, update the selector to match the actual class name used in `apps/client/web/src/app/(protected)/chat/[collectionId]/page.tsx`.

- [ ] **Step 5: Run the full E2E suite for regressions**

```bash
npx playwright test
```

Expected: auth and navigation tests still PASS.

- [ ] **Step 6: Format and commit**

```bash
npx prettier --config prettier.config.mjs --write \
  playwright.config.ts \
  e2e/rag-pipeline.spec.ts
```

```bash
git add playwright.config.ts e2e/rag-pipeline.spec.ts
git commit -m "test: E2E RAG pipeline test covering upload, process, chat, and cite"
```

---

## Self-review

**Spec coverage:**

- Worker integration test: Task 2 covers `processDocument` pipeline, R2/embeddings/Anthropic mocked, real DB, status and chunks asserted.
- E2E test: Task 3 covers full UI flow from login to `[1]` citation.
- Missing route fix: Task 0. Without this, the collection page is broken and the E2E test cannot reach the upload step.

**Placeholder scan:** No TBD or TODO items. All code blocks are complete.

**Type consistency:**

- `DocumentProcessJob` is imported from `policy-pilot-common`, matching the processor's own import.
- `Job<DocumentProcessJob>` comes from `bullmq`, matching the processor signature `processDocument(job: Job<DocumentProcessJob>)`.
- `r2Service.downloadFile` returns `Promise<Buffer>`; `readFileSync` returns `Buffer`, satisfying the mock.
- `generateEmbeddingsBatch` returns `Promise<number[][]>`; mock returns `texts.map(() => Array(1536).fill(0))`.

**Ordering dependency:** Task 0 must complete before Task 3 (the E2E test navigates the collection page which calls the new route). Tasks 1 and 2 are independent of Task 0 but must run in order (1 before 2).
