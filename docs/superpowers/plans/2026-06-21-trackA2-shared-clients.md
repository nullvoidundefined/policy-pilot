# Track A2: Shared Clients De-duplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the duplicated OpenAI embedding and Cloudflare R2 implementations (currently copied across `apps/server` and `apps/worker`) into a shared `@repo/clients` package, extract the byte-identical pino logger into a shared `@repo/logger`, adopt the superset behavior, and migrate both apps off their local copies.

**Architecture:** Today both apps carry near-duplicate `services/embedding.service.ts` and `services/r2.service.ts`, and byte-identical `logger` modules. A2 creates two shared packages: `@repo/logger` (the pino logger) and `@repo/clients` (third-party provider wrappers, one provider per folder, one exported function per file per R-235). The clients adopt the superset: batched `generateEmbeddings` plus a `generateEmbedding` convenience (OpenAI), and the server's full R2 function set. Both apps import from the packages; the apps' own logger modules become thin re-exports of `@repo/logger` so existing import sites are untouched. This is one atomic PR: deleting the local services breaks the build until the migration completes.

**Tech Stack:** pnpm workspaces, TypeScript (NodeNext), Vitest, pino, `@aws-sdk/client-s3`, native fetch.

## Global Constraints

- No U+2014 em dash anywhere (R-001).
- One PR, branched off updated `main`; zero stacking. Branch: `refactor/trackA2-shared-clients` (R-213).
- `@repo/clients` holds one folder per third-party provider; each folder has the SDK singleton and each exported function in its own file (R-235 strict, locked decision). No domain logic in clients (R-222).
- Shared packages take the `@repo/*` scope (R-236).
- New source files get a file-level header comment (R-230); test files, barrels, and single-constant files are exempt.
- No magic strings/numbers: `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `BATCH_SIZE`, `BUCKET` live in a sibling `constants.ts` per provider (R-219, R-222).
- Behavior parity: the embedding superset is the worker's batching plus the server's single-text convenience; R2 is the server's full set. The worker's `generateEmbeddingsBatch` is renamed to `generateEmbeddings` (batched).
- Tests assert behavior, not mocks (R-200). The moved embedding/r2 tests keep their behavior assertions; only import paths and the logger mock target change.
- R-515: update every import path and stale assertion in the same commit as the move.
- Per-PR: changed-file tests + full build. Pre-push: full suite + `npm run smoke` (R-507).
- Squash merge, delete branch. Never merge without explicit per-turn authorization (R-516).
- Deploy monitoring after merge: GitHub Actions, Railway, health endpoints green. Both Dockerfiles already build all `packages/*`; A2 adds two packages that the existing `pnpm --filter` build chains must include (Task 3).

## File Structure

**New package `@repo/logger` (`packages/logger`):**

- `package.json`, `tsconfig.json`
- `src/index.ts` -- the pino logger (copied verbatim from the byte-identical app loggers)

**New package `@repo/clients` (`packages/clients`):**

- `package.json`, `tsconfig.json`, `vitest.config.ts`
- `src/openai/constants.ts` -- `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `BATCH_SIZE`
- `src/openai/generateEmbeddings.ts` -- batched, one exported function
- `src/openai/generateEmbedding.ts` -- single-text convenience, imports `generateEmbeddings`
- `src/openai/index.ts` -- barrel (re-exports both functions + `EMBEDDING_DIMENSIONS`)
- `src/r2/constants.ts` -- `BUCKET`
- `src/r2/s3Client.ts` -- the configured `S3Client` singleton
- `src/r2/uploadFile.ts`, `downloadFile.ts`, `deleteFile.ts`, `checkConnection.ts`, `getSignedDownloadUrl.ts` -- one exported function each
- `src/r2/index.ts` -- barrel (re-exports the five functions)
- `src/__tests__/openai/generateEmbeddings.test.ts` -- ported from the server embedding test
- `src/__tests__/r2/r2.test.ts` -- ported from the server r2 test

**Modified (apps):**

- `apps/server/src/handlers/qa/qa.ts`, `apps/server/src/handlers/documents/documents.ts`, `apps/server/src/app.ts` -- import from `@repo/clients/*`
- `apps/worker/src/processors/document-processor.ts` -- import from `@repo/clients/*`, rename call
- `apps/server/src/utils/logs/logger.ts`, `apps/worker/src/utils/logger.ts` -- re-export `@repo/logger`
- `apps/server/package.json`, `apps/worker/package.json` -- add `@repo/clients` + `@repo/logger`; drop `@aws-sdk/*`
- `pnpm-workspace.yaml`, root `package.json`, `lefthook.yml`, `.github/workflows/ci.yml`, `eslint.config.js`, `Dockerfile.server`, `Dockerfile.worker` -- include the two new packages in workspace + build chains + lint project paths

**Deleted:**

- `apps/server/src/services/embedding.service.ts` + `embedding.service.test.ts`
- `apps/server/src/services/r2.service.ts` + `r2.service.test.ts`
- `apps/worker/src/services/embedding.service.ts`
- `apps/worker/src/services/r2.service.ts`

**Unchanged consumers (verified):** `EMBEDDING_DIMENSIONS` has no external consumer; `@aws-sdk` is imported only by the r2 services; `pino` is imported directly only by the logger modules and `requestLogger.ts` (`pino-http`, kept).

---

### Task 1: Create `@repo/logger`

**Files:**

- Create `packages/logger/package.json`, `packages/logger/tsconfig.json`, `packages/logger/src/index.ts`

**Interfaces:**

- Produces: `import { logger } from '@repo/logger'` -- a configured pino `Logger`.

- [ ] **Step 1: Create `packages/logger/package.json`**

```json
{
  "name": "@repo/logger",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint --config ../../eslint.config.js .",
    "lint:fix": "eslint --config ../../eslint.config.js . --fix",
    "format": "prettier --config ../../prettier.config.mjs --write .",
    "format:check": "prettier --config ../../prettier.config.mjs --check ."
  },
  "dependencies": {
    "pino": "^10.3.1",
    "pino-pretty": "^13.1.3"
  },
  "devDependencies": {
    "@trivago/prettier-plugin-sort-imports": "^5.2.2",
    "@typescript-eslint/parser": "^8.56.1",
    "eslint": "^9.39.3",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-security": "^3.0.0",
    "eslint-plugin-unused-imports": "^4.1.4",
    "globals": "^17.3.0",
    "prettier": "^3.8.1",
    "typescript": "^5.9.3",
    "typescript-eslint": "^8.56.1"
  }
}
```

- [ ] **Step 2: Create `packages/logger/tsconfig.json`** (same as the other packages)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `packages/logger/src/index.ts`** (copied verbatim from the app loggers; the file-level header is the only addition)

```typescript
/**
 * Shared pino logger for all apps and packages. Pretty-prints in development,
 * structured JSON in production. Single source of truth for log configuration.
 */
import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: isProd ? 'info' : 'debug',
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
});
```

- [ ] **Step 4: Do not commit yet.** Single atomic commit in Task 4.

---

### Task 2: Create `@repo/clients` (OpenAI + R2)

**Files:** all under `packages/clients/` (see File Structure).

**Interfaces:**

- Produces `@repo/clients/openai`: `generateEmbeddings(texts: string[]): Promise<number[][]>` (batched), `generateEmbedding(text: string): Promise<number[]>`, `EMBEDDING_DIMENSIONS: number`.
- Produces `@repo/clients/r2`: `uploadFile(key, body, contentType): Promise<void>`, `downloadFile(key): Promise<Buffer>`, `deleteFile(key): Promise<void>`, `checkConnection(): Promise<void>`, `getSignedDownloadUrl(key, expiresIn?): Promise<string>`.
- Consumes: `@repo/logger`.

- [ ] **Step 1: Create `packages/clients/package.json`**

```json
{
  "name": "@repo/clients",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    "./openai": "./dist/openai/index.js",
    "./r2": "./dist/r2/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint --config ../../eslint.config.js .",
    "lint:fix": "eslint --config ../../eslint.config.js . --fix",
    "format": "prettier --config ../../prettier.config.mjs --write .",
    "format:check": "prettier --config ../../prettier.config.mjs --check .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.800.0",
    "@aws-sdk/s3-request-presigner": "^3.800.0",
    "@repo/logger": "workspace:*"
  },
  "devDependencies": {
    "@trivago/prettier-plugin-sort-imports": "^5.2.2",
    "@types/node": "^25.3.0",
    "@typescript-eslint/parser": "^8.56.1",
    "eslint": "^9.39.3",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-security": "^3.0.0",
    "eslint-plugin-unused-imports": "^4.1.4",
    "globals": "^17.3.0",
    "prettier": "^3.8.1",
    "typescript": "^5.9.3",
    "typescript-eslint": "^8.56.1",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Create `packages/clients/tsconfig.json`** (same as Task 1 Step 2).

- [ ] **Step 3: Create `packages/clients/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `packages/clients/src/openai/constants.ts`**

```typescript
/** OpenAI embedding configuration shared across the embedding client functions. */
export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
export const BATCH_SIZE = 100;
```

- [ ] **Step 5: Create `packages/clients/src/openai/generateEmbeddings.ts`** (batched superset, from the worker implementation, using `@repo/logger`)

```typescript
/** Generates OpenAI embeddings for many texts, batching to respect API limits. */
import { logger } from '@repo/logger';

import {
  BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from './constants.js';

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

const EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) throw new Error('OPEN_AI_API_KEY is not set');

  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch(EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: batch,
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Embedding API error (${response.status}): ${errorBody}`);
    }

    const result = (await response.json()) as EmbeddingResponse;
    logger.info(
      {
        tokens: result.usage.total_tokens,
        batchSize: batch.length,
        batchIndex: Math.floor(i / BATCH_SIZE),
      },
      'Generated embedding batch',
    );

    allEmbeddings.push(...result.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}
```

- [ ] **Step 6: Create `packages/clients/src/openai/generateEmbedding.ts`** (single-text convenience)

```typescript
/** Generates a single OpenAI embedding; convenience wrapper over generateEmbeddings. */
import { generateEmbeddings } from './generateEmbeddings.js';

export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([text]);
  const embedding = embeddings[0];
  if (!embedding) throw new Error('No embedding returned');
  return embedding;
}
```

- [ ] **Step 7: Create `packages/clients/src/openai/index.ts`** (barrel, R-230 exempt)

```typescript
export { EMBEDDING_DIMENSIONS } from './constants.js';
export { generateEmbedding } from './generateEmbedding.js';
export { generateEmbeddings } from './generateEmbeddings.js';
```

- [ ] **Step 8: Create `packages/clients/src/r2/constants.ts`**

```typescript
/** Cloudflare R2 bucket name shared across the R2 client functions. */
export const BUCKET = process.env.R2_BUCKET_NAME ?? 'doc-qa-rag';
```

- [ ] **Step 9: Create `packages/clients/src/r2/s3Client.ts`** (the configured singleton)

```typescript
/** Configured S3 client singleton for Cloudflare R2 (S3-compatible API). */
import { S3Client } from '@aws-sdk/client-s3';

export const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});
```

- [ ] **Step 10: Create `packages/clients/src/r2/uploadFile.ts`**

```typescript
/** Uploads a file buffer to Cloudflare R2 under the given key. */
import { PutObjectCommand } from '@aws-sdk/client-s3';

import { BUCKET } from './constants.js';
import { s3 } from './s3Client.js';

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
```

- [ ] **Step 11: Create `packages/clients/src/r2/downloadFile.ts`**

```typescript
/** Downloads an object from Cloudflare R2 and returns its contents as a Buffer. */
import { GetObjectCommand } from '@aws-sdk/client-s3';

import { BUCKET } from './constants.js';
import { s3 } from './s3Client.js';

export async function downloadFile(key: string): Promise<Buffer> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  );
  const stream = response.Body;
  if (!stream) throw new Error('Empty response body from R2');

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
```

- [ ] **Step 12: Create `packages/clients/src/r2/deleteFile.ts`**

```typescript
/** Deletes an object from Cloudflare R2 by key. */
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

import { BUCKET } from './constants.js';
import { s3 } from './s3Client.js';

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
```

- [ ] **Step 13: Create `packages/clients/src/r2/checkConnection.ts`**

```typescript
/** Verifies connectivity to the Cloudflare R2 bucket (health check). */
import { HeadBucketCommand } from '@aws-sdk/client-s3';

import { BUCKET } from './constants.js';
import { s3 } from './s3Client.js';

export async function checkConnection(): Promise<void> {
  await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
}
```

- [ ] **Step 14: Create `packages/clients/src/r2/getSignedDownloadUrl.ts`**

```typescript
/** Returns a presigned GET URL for an R2 object, valid for expiresIn seconds. */
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { BUCKET } from './constants.js';
import { s3 } from './s3Client.js';

const DEFAULT_EXPIRY_SECONDS = 3600;

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = DEFAULT_EXPIRY_SECONDS,
): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn,
  });
}
```

- [ ] **Step 15: Create `packages/clients/src/r2/index.ts`** (barrel)

```typescript
export { checkConnection } from './checkConnection.js';
export { deleteFile } from './deleteFile.js';
export { downloadFile } from './downloadFile.js';
export { getSignedDownloadUrl } from './getSignedDownloadUrl.js';
export { uploadFile } from './uploadFile.js';
```

- [ ] **Step 16: Move the embedding test.** `git mv apps/server/src/services/embedding.service.test.ts packages/clients/src/__tests__/openai/generateEmbeddings.test.ts` (create the dir first). Then edit its imports: change `from './embedding.service.js'` to `from '../../openai/index.js'`, and change the logger mock target `vi.mock('app/utils/logs/logger.js', ...)` to `vi.mock('@repo/logger', ...)`. Keep all behavior assertions unchanged. The test covers both `generateEmbeddings` and `generateEmbedding`.

- [ ] **Step 17: Move the r2 test.** `git mv apps/server/src/services/r2.service.test.ts packages/clients/src/__tests__/r2/r2.test.ts` (create the dir first). Edit its import: change `from './r2.service.js'` (which imported `deleteFile, getSignedDownloadUrl, uploadFile`) to `from '../../r2/index.js'`. Keep the `@aws-sdk` mocks and all behavior assertions unchanged.

- [ ] **Step 18: Run the clients package tests in isolation to confirm the ports work.**

Run: `pnpm --filter @repo/clients run test`
Expected: PASS (the ported embedding + r2 behavior tests). If the logger mock path is wrong, the embedding test fails on an unmocked logger import; fix the `vi.mock` target to `@repo/logger`.

- [ ] **Step 19: Do not commit yet.**

---

### Task 3: Migrate apps, rewire build refs, delete local services

**Files:** see File Structure (apps + workspace/build configs).

- [ ] **Step 1: Update `pnpm-workspace.yaml`** -- add the two new packages.

```yaml
packages:
  - 'apps/server'
  - 'apps/worker'
  - 'apps/client/web'
  - 'packages/types'
  - 'packages/chunker'
  - 'packages/logger'
  - 'packages/clients'
```

- [ ] **Step 2: Update root `package.json` `build` and `test` scripts** -- build the new packages before the apps; run the clients test.

`build`:

```
"build": "pnpm --filter @repo/types build && pnpm --filter @repo/logger build && pnpm --filter @repo/chunker build && pnpm --filter @repo/clients build && pnpm --filter policy-pilot-server build && pnpm --filter policy-pilot-worker build && pnpm --filter policy-pilot-web build",
```

`test`:

```
"test": "pnpm --filter @repo/chunker run test && pnpm --filter @repo/clients run test && pnpm --filter policy-pilot-server run test",
```

(Order: `@repo/logger` before `@repo/clients` because clients depends on logger.)

- [ ] **Step 3: Update `lefthook.yml` build command (line 16)** -- include the new packages before the apps.

```yaml
run: pnpm --filter @repo/types build && pnpm --filter @repo/logger build && pnpm --filter @repo/chunker build && pnpm --filter @repo/clients build && pnpm --filter policy-pilot-server build && pnpm --filter policy-pilot-worker build
```

- [ ] **Step 4: Update `.github/workflows/ci.yml`** -- the "Build shared packages" step builds all four.

```yaml
- name: Build shared packages
  run: pnpm --filter @repo/types build && pnpm --filter @repo/logger build && pnpm --filter @repo/chunker build && pnpm --filter @repo/clients build
```

- [ ] **Step 5: Update `eslint.config.js` `parserOptions.project` array** -- add the two new tsconfigs.

```javascript
        project: [
          './apps/server/tsconfig.json',
          './apps/client/web/tsconfig.json',
          './apps/worker/tsconfig.json',
          './packages/types/tsconfig.json',
          './packages/chunker/tsconfig.json',
          './packages/logger/tsconfig.json',
          './packages/clients/tsconfig.json',
        ],
```

- [ ] **Step 6: Update `Dockerfile.server`** -- the manifest-copy, install, source-copy, build, and dist-copy must include `packages/logger` and `packages/clients` alongside the existing `packages/types` and `packages/chunker`. Read the current Dockerfile (it was updated in A1 to copy types + chunker) and add the two new packages to each of: the base-stage `COPY packages/<name>/package.json`, the base + production `pnpm install --filter` lists, the base-stage `COPY packages/<name>/` source copies, the base-stage build (`pnpm --filter @repo/logger build && pnpm --filter @repo/clients build`, ordered logger before clients), and the production-stage `COPY --from=base /app/packages/<name>/dist`. The install `--filter` lists add `--filter @repo/logger --filter @repo/clients`.

- [ ] **Step 7: Update `Dockerfile.worker`** -- same additions as Step 6 (logger + clients in every place types + chunker appear). The worker image needs both new packages (it imports `generateEmbeddings`, `downloadFile`, and the logger).

- [ ] **Step 8: Convert the server logger to a re-export.** Replace the entire contents of `apps/server/src/utils/logs/logger.ts` with:

```typescript
export { logger } from '@repo/logger';
```

- [ ] **Step 9: Convert the worker logger to a re-export.** Replace the entire contents of `apps/worker/src/utils/logger.ts` with:

```typescript
export { logger } from '@repo/logger';
```

- [ ] **Step 10: Migrate `apps/server/src/handlers/qa/qa.ts`.** Replace the import `import * as embeddingService from 'app/services/embedding.service.js';` (line 5) with `import { generateEmbedding } from '@repo/clients/openai';`, and change the call site (line ~98) `await embeddingService.generateEmbedding(question)` to `await generateEmbedding(question)`.

- [ ] **Step 11: Migrate `apps/server/src/handlers/documents/documents.ts`.** Replace `import * as r2Service from 'app/services/r2.service.js';` (line 4) with `import { deleteFile, uploadFile } from '@repo/clients/r2';`, and change `r2Service.uploadFile(...)` (line ~46) to `uploadFile(...)` and `r2Service.deleteFile(...)` (line ~122) to `deleteFile(...)`.

- [ ] **Step 12: Migrate `apps/server/src/app.ts`.** Replace `import { checkConnection as checkR2 } from 'app/services/r2.service.js';` (line 19) with `import { checkConnection as checkR2 } from '@repo/clients/r2';`. The call site `await checkR2()` (line ~105) is unchanged.

- [ ] **Step 13: Migrate `apps/worker/src/processors/document-processor.ts`.** Replace `import * as embeddingService from 'app/services/embedding.service.js';` (line 5) with `import { generateEmbeddings } from '@repo/clients/openai';` and `import * as r2Service from 'app/services/r2.service.js';` (line 6) with `import { downloadFile } from '@repo/clients/r2';`. Change `r2Service.downloadFile(r2Key)` (line ~45) to `downloadFile(r2Key)` and `embeddingService.generateEmbeddingsBatch(chunkTexts)` (line ~116) to `generateEmbeddings(chunkTexts)`.

- [ ] **Step 14: Update `apps/server/package.json` dependencies.** Add `"@repo/clients": "workspace:*"` and `"@repo/logger": "workspace:*"` in scoped-alphabetical position (after `@aws-sdk/*`, before bare names; `@repo/clients` before `@repo/logger`). Remove `"@aws-sdk/client-s3"` and `"@aws-sdk/s3-request-presigner"` (no longer imported directly; verified). Keep `pino`, `pino-http`, `pino-pretty`.

- [ ] **Step 15: Update `apps/worker/package.json` dependencies.** Add `"@repo/clients": "workspace:*"` and `"@repo/logger": "workspace:*"` (scoped-alphabetical, alongside the existing `@repo/chunker` and `@repo/types`: order `@repo/chunker`, `@repo/clients`, `@repo/logger`, `@repo/types`). Remove `"@aws-sdk/client-s3"` (no longer imported directly; verified). Keep `pino`.

- [ ] **Step 16: Delete the local service files.**

```bash
git rm apps/server/src/services/embedding.service.ts apps/server/src/services/r2.service.ts \
       apps/worker/src/services/embedding.service.ts apps/worker/src/services/r2.service.ts
```

(The two server test files were already moved by `git mv` in Task 2 Steps 16-17; the worker had no embedding/r2 unit tests.)

- [ ] **Step 17: Reinstall to wire the new workspace packages and update the lockfile.**

Run: `pnpm install`
Expected: `@repo/logger` and `@repo/clients` resolve as workspace links; `@aws-sdk/*` removed from the app importer blocks in `pnpm-lock.yaml`.

- [ ] **Step 18: Do not commit yet.**

---

### Task 4: Verify and commit

**Files:** none modified; runs the regression harness and produces the single atomic commit.

- [ ] **Step 1: No stale references to the old local services.**

Run:

```bash
grep -rn "services/embedding.service\|services/r2.service\|generateEmbeddingsBatch" apps \
  --include="*.ts"
```

Expected: zero matches.

- [ ] **Step 2: Full build.**

Run: `pnpm build`
Expected: all seven filters build in order (types, logger, chunker, clients, server, worker, web), no TS errors.

- [ ] **Step 3: Clients package tests.**

Run: `pnpm --filter @repo/clients run test`
Expected: PASS (ported embedding + r2 behavior tests).

- [ ] **Step 4: Full unit suite.**

Run: `pnpm test`
Expected: PASS. The server suite now runs without the deleted service tests; `retrieval.service.test.ts` (unchanged) still passes.

- [ ] **Step 5: Lint and format.**

Run: `pnpm lint && pnpm format:check`
Expected: PASS. ESLint resolves the two new tsconfig project paths.

- [ ] **Step 6: Smoke test.**

Run: `npm run smoke`
Expected: all checks pass, including `GET /health` and the R2 `checkConnection` path exercised at server startup (`app.ts`).

- [ ] **Step 7: Commit.**

```bash
git branch --show-current   # must print refactor/trackA2-shared-clients
git add -A -- ':!docs/agentic-conversion-plan.md'
git status   # confirm no unrelated untracked files staged
git commit -m "refactor(A2): extract shared @repo/clients and @repo/logger

Move duplicated OpenAI embedding and Cloudflare R2 implementations into
@repo/clients (one provider folder, one exported function per file, R-235);
extract the byte-identical pino logger into @repo/logger; adopt the batched
embedding superset and the server R2 superset; migrate server and worker;
app logger modules become re-exports. No behavior change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Note: the explicit pathspec exclusion keeps the untracked `docs/agentic-conversion-plan.md` (separate workstream) out of the commit. This corrects the `git add -A` defect from A1's plan.

- [ ] **Step 8: Push, write the PR doc, open the PR.** Write `docs/prs/2026-06-22-trackA2-shared-clients.md` (project PR Workflow) first. Branch `refactor/trackA2-shared-clients`, request review. Do NOT merge without explicit per-turn authorization (R-516). After merge, monitor GitHub Actions + Railway + health endpoints green.

---

## Self-Review

**1. Spec coverage (master index unit 3; spec section 6 A2; locked decisions):**

- "Create `@repo/clients`" -> Task 2 (openai + r2, R-235 strict per locked decision).
- "Migrate server + worker off duplicated `embedding`/`r2` impls" -> Task 3 Steps 10-16.
- "Adopt server's superset for r2, batched embedding" (spec risk row) -> R2 uses the full server set (Task 2 Steps 9-15); embedding uses the worker's batching plus the server's convenience (Steps 5-6); worker call renamed (Step 13).
- Logger decision (this session) -> `@repo/logger` (Task 1); apps re-export (Steps 8-9).

**2. Placeholder scan:** No TBD/TODO/"handle edge cases". Every new file's full content is shown. Dockerfile Steps 6-7 describe additions by enumerating each site and instruct reading the current (A1-updated) file; the substitution pattern is identical to A1's, which is concrete. Versions are copied verbatim from the existing app manifests.

**3. Type consistency:** Function signatures match the originals exactly (`generateEmbeddings(texts: string[]): Promise<number[][]>`, `uploadFile(key, body, contentType)`, etc.). `EMBEDDING_DIMENSIONS` re-exported from `@repo/clients/openai`. The worker's old `generateEmbeddingsBatch` maps to `generateEmbeddings` (same signature, batched). No symbol is referenced that no task defines.

**4. Atomicity:** Tasks 1-3 leave the build red (apps still reference deleted services until Steps 10-16); single commit in Task 4, consistent with A2 being one PR. The commit uses a scoped `git add` pathspec to avoid A1's sweep of the unrelated untracked file.

**5. R-235 / R-222 compliance:** Each provider is a folder; the SDK singleton (`s3Client.ts`) and each public function are separate files; constants extracted to `constants.ts`; barrels are the only multi-symbol files and are R-230/R-235 exempt. No domain logic in the clients (batching is a provider-API concern, not business logic).
