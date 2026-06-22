# Track A3: Server Internals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `apps/server/src` into directory/clean-code compliance: rename `db/` to `database/`, eliminate `utils/`, split the function-tree modules (repositories, services) to one exported function per file, extract the Anthropic SDK out of the qa handler into a `clients/` singleton, split the mixed prompt module, and consolidate all tests into a single `src/__tests__/` mirror tree.

**Architecture:** Pure internal refactor of one app; no behavior change, no API change, no DB change. Every step is a move/rename/split plus the matching import and `vi.mock` specifier updates, verified continuously against the existing test suite. Consumers already import repositories as `import * as xRepo`, so each repository folder becomes one-file-per-function plus an `index.ts` barrel and the call sites change only their import path. The Anthropic singleton mirrors the established `@repo/clients` `s3Client.ts` pattern (and Doppelscript/Voyager's LLM client): the client module constructs the SDK and nothing else; the `.messages.*` calls stay in the consumer (handler/service), exactly as the qa handler already imports `@repo/clients/openai` directly today. This is one atomic PR.

**Tech Stack:** pnpm workspaces, TypeScript (NodeNext, `app/*` to `src/*` alias), Vitest (unit + integration configs), Express 5, `pg`, `@anthropic-ai/sdk`.

## Global Constraints

- No U+2014 em dash anywhere (R-001).
- One PR, branched off updated `main`; zero stacking. Branch: `refactor/trackA3-server-internals` (R-213).
- One exported function per file in `services/`, `clients/`, and repositories; verb-noun filenames (R-235, R-217). Handlers are exempt (see Decisions D1).
- A helper called by 2+ public functions becomes its own file, imported by each, and is NOT re-exported from the domain barrel (R-235).
- New source files get a file-level header `/** ... */` comment (R-230); test files, barrels (`index.ts`), single-constant files, and pure type re-exports are exempt.
- No magic strings/numbers in edited code: single-use literals become a named module-level `const` beside their consumer (R-219).
- Tests assert behavior, not mocks (R-200). Moves preserve every existing assertion; only import paths and `vi.mock` specifiers change.
- R-515 and gap-pattern #1: when a module moves or is deleted, grep `vi.mock(` for its OLD specifier across ALL tests and retarget each in the same commit. Vitest silently fails to intercept a nonexistent specifier.
- Gap-pattern #2: after converting any module to a re-export or deleting a re-export, audit `apps/server/package.json` for now-orphaned direct deps. (A3 has no re-export conversions and no expected dep changes; verify in Task 12.)
- Per-task: `pnpm --filter policy-pilot-server test` plus `pnpm --filter policy-pilot-server build` green before the task's commit. Pre-push: full `pnpm test`, `pnpm build`, `pnpm test:integration`, `pnpm run smoke` (R-507).
- Conventional commit per task; squash merge, delete branch. Never merge without explicit per-turn authorization (R-516).
- Deploy monitoring after merge: GitHub Actions, Railway (server + worker), health endpoints green (project CLAUDE.md).
- `apps/server/**` paths only. Do not touch `apps/worker`, `apps/client`, or `packages/*` (those are A4/A5/done).

## Decisions (resolving spec section 10 open items)

These resolve the two A3 open items in `docs/superpowers/specs/2026-06-21-convention-refactor-design.md` using the reference-repo process (Track B, task B2 step 1). Both reference repos agree, so no user conflict arises.

- **D1. Handlers stay domain-grouped, NOT one-function-per-file.** R-235's one-function-per-file scope is `services/`, `api/`, `clients/`, repositories, and stores; handlers are R-227 orchestrators and are excluded. Both reference repos keep handlers domain-grouped (Voyager `handlers/trips/trips.ts`, `handlers/auth.ts`; Doppelscript `handlers/voices.ts`, `handlers/billing/billing.ts`, all multi-export). The spec's "handlers one function per file" bullet is over-applied; the spec's own "Done when: no multi-export function-tree files" is satisfied without splitting handlers. Handlers are NOT split. The only handler change is extracting the Anthropic SDK construction out of `handlers/qa/qa.ts` (Task 8) and updating import paths.
- **D2. Logger: drop the re-export, import `@repo/logger` directly.** `apps/server/src/utils/logs/logger.ts` is already a pure `export { logger } from '@repo/logger'` (post-A2). A `logging/` dir holding one re-export file would be a single-file folder (R-223) plus pointless indirection. The clean `utils/` elimination is to import `@repo/logger` directly at every site and delete the file. (Task 3.)
- **D3. Anthropic client is singleton only, at `clients/anthropic.ts`.** The spec shorthand "`clients/llm.ts`" becomes a provider-named module per R-222. Both reference repos make the LLM client only the SDK construction (Doppelscript `clients/anthropic.ts` exports the `anthropic` singleton; Voyager `clients/llm.ts` a factory). policy-pilot mirrors the `@repo/clients/r2/s3Client.ts` singleton form: `clients/anthropic.ts` constructs and exports `anthropic`; consumers import it and call `.messages.create`/`.messages.stream`. This is the only file in `clients/`, so it stays a flat module (R-223), not a folder. No call-wrapping (avoids fragile SDK param types and matches both references).
- **D4. `database/pool.ts` stays a single module.** The spec explicitly says "collapse the double-nested `db/pool/pool.ts` to `database/pool.ts`" (R-223, R-229). A connection pool sits below repositories in its own top-level tree (R-220 carve-out); `pool` plus `query` plus `withTransaction` stay together in `database/pool.ts`. R-235's strict split was the locked decision for clients, not the pool. (Task 1.)

## File Structure

**Renamed/created top-level server dirs:**

- `src/database/pool.ts`: moved from `src/db/pool/pool.ts` (D4). `src/db/` deleted.
- `src/errors/ApiError.ts`: moved from `src/utils/ApiError.ts`. `src/utils/` deleted entirely.
- `src/clients/anthropic.ts`: NEW, the Anthropic SDK singleton (D3).

**Repositories (one function per file plus barrel; `import * as` call sites change path to `index.js`):**

- `src/repositories/auth/`: `hashSessionToken.ts` (private helper, NOT in barrel), `createUser.ts`, `findUserByEmail.ts`, `verifyPassword.ts`, `createSession.ts`, `getSessionWithUser.ts`, `deleteSession.ts`, `loginUser.ts`, `createUserAndSession.ts`, `index.ts`. Deletes `auth.ts`.
- `src/repositories/collections/`: `createCollection.ts`, `listCollections.ts`, `getCollectionById.ts`, `getDemoCollection.ts`, `getDemoCollections.ts`, `deleteCollection.ts`, `getCollectionDocumentCount.ts`, `index.ts`. Deletes `collections.ts`.
- `src/repositories/conversations/`: `createConversation.ts`, `getConversation.ts`, `listConversations.ts`, `createMessage.ts`, `updateConversationTitle.ts`, `getMessages.ts`, `index.ts`. Deletes `conversations.ts`.
- `src/repositories/documents/`: `createDocument.ts`, `getDocumentById.ts`, `listDocuments.ts`, `updateDocumentStatus.ts`, `deleteDocument.ts`, `index.ts`. Deletes `documents.ts`.

**Services (drop `.service` suffix, verb-noun, one function per file):**

- `src/services/searchChunks.ts`: moved/renamed from `src/services/retrieval.service.ts`.
- `src/services/generateConversationTitle.ts`: NEW, extracted from `handlers/qa/qa.ts` (uses the Anthropic singleton).

**Prompts (split constant from function, R-222):**

- `src/prompts/qaSystemPrompt.ts`: the `QA_SYSTEM_PROMPT` constant (single-constant file, header-exempt).
- `src/prompts/buildContextPrompt.ts`: the `buildContextPrompt` function. Deletes `qa-system.ts`.

**Tests move to a single `src/__tests__/` mirror (Task 11):**

- All co-located `*.test.ts` move under `src/__tests__/` mirroring source layout; relative imports (`from './x.js'`) become alias imports (`from 'app/.../x.js'`).
- `src/__integration__/` becomes `src/__tests__/integration/` (including `setup.ts`).
- Both `vitest.config.ts` and `vitest.integration.config.ts` updated for the new integration path.

**Modified (import-path / mock-specifier updates only):**

- Consumers of pool: `app.ts`, repositories, `services/searchChunks.ts`, `__tests__/integration/setup.ts`, `__tests__/integration/collections.test.ts`.
- Consumers of `ApiError`: `handlers/{auth,collections,documents,qa}`, `middleware/{errorHandler,requireAuth}`, `routes/conversations.ts`, plus their tests.
- Consumers of logger: `app.ts`, `database/pool.ts`, `handlers/{auth,documents,qa}`, `middleware/{errorHandler,requestLogger}`, plus every `vi.mock('app/utils/logs/logger.js')` test.
- Consumers of repositories (`import * as`): `handlers/{auth,qa,documents,collections}`, `middleware/requireAuth`, `routes/{collections,conversations}`, plus tests mocking those repos.
- `handlers/qa/qa.ts`: Anthropic singleton import; `generateConversationTitle` removed (now imported from services); model literals to named consts.

**Deleted:** `src/db/` (whole tree), `src/utils/` (whole tree), `src/services/retrieval.service.ts`, `src/prompts/qa-system.ts`, and each pre-split repository `*.ts`.

**No-test source (verified, so no test moves for these):** `repositories/collections` (no unit test), `handlers/collections`, `config/{corsConfig,queue}`, `middleware/requestLogger`, `db/pool/pool.ts`.

---

### Task 1: Rename `db/` to `database/` and collapse the pool

**Files:**

- Create: `apps/server/src/database/pool.ts` (from `apps/server/src/db/pool/pool.ts`)
- Delete: `apps/server/src/db/pool/pool.ts`, dir `apps/server/src/db/`
- Modify (source): `app.ts`, `repositories/auth/auth.ts`, `repositories/collections/collections.ts`, `repositories/conversations/conversations.ts`, `repositories/documents/documents.ts`, `services/retrieval.service.ts`
- Modify (tests, co-located): `repositories/auth/auth.test.ts`, `repositories/conversations/conversations.test.ts`, `repositories/documents/documents.test.ts`, `services/retrieval.service.test.ts`, `__integration__/setup.ts`, `__integration__/collections.test.ts`

**Interfaces:**

- Produces: `import { query, withTransaction } from 'app/database/pool.js'`, `import type { PoolClient } from 'app/database/pool.js'`, `import pool from 'app/database/pool.js'` (default). Same signatures as today.

- [ ] **Step 1: Move the pool file with git, contents unchanged**

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot
mkdir -p apps/server/src/database
git mv apps/server/src/db/pool/pool.ts apps/server/src/database/pool.ts
rmdir apps/server/src/db/pool apps/server/src/db
```

(`database/pool.ts` keeps `import { logger } from 'app/utils/logs/logger.js';` for now; Task 3 rewrites it. Its body is unchanged.)

- [ ] **Step 2: Update every non-test import of the old pool path**

Replace `from 'app/db/pool/pool.js'` with `from 'app/database/pool.js'` in: `app.ts:5`, `repositories/auth/auth.ts:2-3`, `repositories/collections/collections.ts:2`, `repositories/conversations/conversations.ts:2`, `repositories/documents/documents.ts:2-3`, `services/retrieval.service.ts:2`.

- [ ] **Step 3: Update every test `vi.mock` and import of the old pool path**

In `repositories/auth/auth.test.ts`, `repositories/conversations/conversations.test.ts`, `repositories/documents/documents.test.ts`, `services/retrieval.service.test.ts`: change `vi.mock('app/db/pool/pool.js', ...)` to `vi.mock('app/database/pool.js', ...)`. In `__integration__/setup.ts:1` and `__integration__/collections.test.ts:2`: change `import pool from 'app/db/pool/pool.js'` to `import pool from 'app/database/pool.js'`.

- [ ] **Step 4: Verify no stale references remain**

```bash
grep -rn "db/pool/pool" apps/server/src   # expect: no matches
```

- [ ] **Step 5: Run unit tests plus build**

Run: `pnpm --filter policy-pilot-server test && pnpm --filter policy-pilot-server build`
Expected: PASS, same test count as baseline.

- [ ] **Step 6: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A3): rename db/ to database/, collapse pool"
```

---

### Task 2: Move `ApiError` to `errors/`

**Files:**

- Create: `apps/server/src/errors/ApiError.ts` (from `apps/server/src/utils/ApiError.ts`)
- Delete: `apps/server/src/utils/ApiError.ts`
- Modify (source): `handlers/auth/auth.ts:5`, `handlers/collections/collections.ts:3`, `handlers/documents/documents.ts:5`, `handlers/qa/qa.ts:7`, `middleware/errorHandler/errorHandler.ts:1`, `middleware/requireAuth/requireAuth.ts:3`, `routes/conversations.ts:3`
- Modify (tests): `handlers/auth/auth.test.ts:2`, `handlers/documents/documents.test.ts:4`, `handlers/qa/qa.test.ts:5`, `middleware/errorHandler/errorHandler.test.ts:1`

**Interfaces:**

- Produces: `import { ApiError } from 'app/errors/ApiError.js'`, same class, same static factories.

- [ ] **Step 1: Move the file (contents unchanged)**

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot
mkdir -p apps/server/src/errors
git mv apps/server/src/utils/ApiError.ts apps/server/src/errors/ApiError.ts
```

- [ ] **Step 2: Update all imports (source plus test)**

Replace `from 'app/utils/ApiError.js'` with `from 'app/errors/ApiError.js'` in the seven source files and four test files listed under **Files**.

- [ ] **Step 3: Verify**

```bash
grep -rn "utils/ApiError" apps/server/src   # expect: no matches
```

- [ ] **Step 4: Run unit tests plus build**

Run: `pnpm --filter policy-pilot-server test && pnpm --filter policy-pilot-server build`
Expected: PASS, same count.

- [ ] **Step 5: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A3): move ApiError to errors/"
```

---

### Task 3: Import `@repo/logger` directly and delete `utils/`

**Files:**

- Delete: `apps/server/src/utils/logs/logger.ts`, dirs `apps/server/src/utils/logs/`, `apps/server/src/utils/`
- Modify (source): `app.ts:20`, `database/pool.ts:1`, `handlers/auth/auth.ts:6`, `handlers/documents/documents.ts:6`, `handlers/qa/qa.ts:8`, `middleware/errorHandler/errorHandler.ts:2`, `middleware/requestLogger/requestLogger.ts:1`
- Modify (tests): every file with `vi.mock('app/utils/logs/logger.js', ...)`: `handlers/auth/auth.test.ts:19`, `handlers/documents/documents.test.ts:36`, `handlers/qa/qa.test.ts:44`, `middleware/errorHandler/errorHandler.test.ts:8`, `middleware/requireAuth/requireAuth.test.ts:14`, `repositories/auth/auth.test.ts:22`, `repositories/conversations/conversations.test.ts:19`, `repositories/documents/documents.test.ts:18`, `services/retrieval.service.test.ts:12`

**Interfaces:**

- Produces: `import { logger } from '@repo/logger'` at every former site.

- [ ] **Step 1: Rewrite source imports**

Replace `import { logger } from 'app/utils/logs/logger.js';` with `import { logger } from '@repo/logger';` in the seven source files. Re-sort the import block per the import sorter if needed (run format in Step 5).

- [ ] **Step 2: Retarget the logger mock in every test (gap-pattern #1)**

In each of the nine test files, change the mock specifier only: `vi.mock('app/utils/logs/logger.js', () => ({ ... }))` becomes `vi.mock('@repo/logger', () => ({ ... }))`. Keep each mock factory body exactly as-is.

- [ ] **Step 3: Delete the `utils/` tree**

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot
git rm apps/server/src/utils/logs/logger.ts
rmdir apps/server/src/utils/logs apps/server/src/utils 2>/dev/null || true
grep -rn "app/utils/" apps/server/src   # expect: no matches
```

- [ ] **Step 4: Verify no orphaned deps (gap-pattern #2)**

```bash
grep -rn "from 'pino'\|from \"pino\"\|require('pino')" apps/server/src   # expect: no matches except pino-http in requestLogger
grep -n "\"pino\"\|\"pino-pretty\"" apps/server/package.json              # expect: not present as direct deps (A2 already dropped them)
```

No `package.json` change expected (the logger was already a re-export of `@repo/logger`; `pino-http` stays for `requestLogger`).

- [ ] **Step 5: Format, test, build**

Run: `pnpm --filter policy-pilot-server format && pnpm --filter policy-pilot-server test && pnpm --filter policy-pilot-server build`
Expected: PASS, same count.

- [ ] **Step 6: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A3): import @repo/logger directly, remove utils/"
```

---

### Task 4: Split `repositories/auth` to one function per file

**Files:**

- Create: `apps/server/src/repositories/auth/{hashSessionToken,createUser,findUserByEmail,verifyPassword,createSession,getSessionWithUser,deleteSession,loginUser,createUserAndSession,index}.ts`
- Delete: `apps/server/src/repositories/auth/auth.ts`
- Modify (consumers): `handlers/auth/auth.ts:3`, `middleware/requireAuth/requireAuth.ts:2`
- Modify (tests): `repositories/auth/auth.test.ts` (import plus mock specifiers), `handlers/auth/auth.test.ts:1,7`, `middleware/requireAuth/requireAuth.test.ts:2,10`

**Interfaces:**

- Produces: barrel `app/repositories/auth/index.js` re-exporting the 8 public functions (verbatim signatures from the current `auth.ts`). `hashSessionToken` is private (imported by `createSession`, `getSessionWithUser`, `deleteSession`; NOT re-exported).
- Intra-folder deps: `createSession` imports `hashSessionToken`; `getSessionWithUser`/`deleteSession` import `hashSessionToken`; `loginUser` imports `createSession`; `createUserAndSession` imports `createUser` plus `createSession`.

- [ ] **Step 1: Create `hashSessionToken.ts` (private helper)**

```ts
/** Hashes a raw session token to its stored SHA-256 id (shared by session repository functions). */
import crypto from 'node:crypto';

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}
```

- [ ] **Step 2: Create the 8 public function files**

Each file: a `/** ... */` header naming its responsibility, the imports it needs, then the function body copied verbatim from the current `apps/server/src/repositories/auth/auth.ts` (read it for exact bodies). Imports per file:

- `createUser.ts`: `import { query } from 'app/database/pool.js'; import type { PoolClient } from 'app/database/pool.js'; import type { User } from 'app/schemas/auth.js'; import bcrypt from 'bcrypt';` plus a local `const SALT_ROUNDS = 12;` (single-use, R-219).
- `findUserByEmail.ts`: `query` plus `User`.
- `verifyPassword.ts`: `import bcrypt from 'bcrypt';` only.
- `createSession.ts`: `query`, `PoolClient`, `import { SESSION_TTL_MS } from 'app/constants/session.js'; import crypto from 'node:crypto'; import { hashSessionToken } from './hashSessionToken.js';`
- `getSessionWithUser.ts`: `query`, `User`, `hashSessionToken`.
- `deleteSession.ts`: `query`, `hashSessionToken`.
- `loginUser.ts`: `import { query, withTransaction } from 'app/database/pool.js'; import { createSession } from './createSession.js';`
- `createUserAndSession.ts`: `import { withTransaction } from 'app/database/pool.js'; import type { User } from 'app/schemas/auth.js'; import { createSession } from './createSession.js'; import { createUser } from './createUser.js';`

- [ ] **Step 3: Create the barrel `index.ts`**

```ts
export { createSession } from './createSession.js';
export { createUser } from './createUser.js';
export { createUserAndSession } from './createUserAndSession.js';
export { deleteSession } from './deleteSession.js';
export { findUserByEmail } from './findUserByEmail.js';
export { getSessionWithUser } from './getSessionWithUser.js';
export { loginUser } from './loginUser.js';
export { verifyPassword } from './verifyPassword.js';
```

- [ ] **Step 4: Delete the old module**

```bash
git rm apps/server/src/repositories/auth/auth.ts
```

- [ ] **Step 5: Update consumers (gap-pattern #1)**

- `handlers/auth/auth.ts:3` and `middleware/requireAuth/requireAuth.ts:2`: `import * as authRepo from 'app/repositories/auth/auth.js'` becomes `... from 'app/repositories/auth/index.js'`.
- `handlers/auth/auth.test.ts`: line 1 import and line 7 `vi.mock('app/repositories/auth/auth.js', ...)` become `.../index.js` (both).
- `middleware/requireAuth/requireAuth.test.ts`: line 2 import and line 10 `vi.mock(...)` become `.../index.js`.
- `repositories/auth/auth.test.ts`: change `from './auth.js'` to `from './index.js'` (pool plus logger mocks already retargeted in Tasks 1, 3).

- [ ] **Step 6: Verify, test, build**

```bash
grep -rn "repositories/auth/auth" apps/server/src   # expect: no matches
pnpm --filter policy-pilot-server test && pnpm --filter policy-pilot-server build
```

Expected: PASS, same count.

- [ ] **Step 7: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A3): split auth repository to one function per file"
```

---

### Task 5: Split `repositories/collections` to one function per file

**Files:**

- Create: `apps/server/src/repositories/collections/{createCollection,listCollections,getCollectionById,getDemoCollection,getDemoCollections,deleteCollection,getCollectionDocumentCount,index}.ts`
- Delete: `apps/server/src/repositories/collections/collections.ts`
- Modify (consumers): `handlers/qa/qa.ts:4`, `handlers/collections/collections.ts:1`, `routes/collections.ts:3`, `handlers/qa/qa.test.ts:2,32`
- (No `collections` repository unit test exists.)

**Interfaces:**

- Produces: barrel `app/repositories/collections/index.js` with the 7 functions (verbatim from current `collections.ts`). No intra-folder deps, no private helpers.

- [ ] **Step 1: Create the 7 function files**

Each: header plus imports plus verbatim body from `apps/server/src/repositories/collections/collections.ts`. Imports: `import { query } from 'app/database/pool.js';` in all 7; add `import type { Collection } from '@repo/types';` to every file except `getCollectionDocumentCount.ts` (which uses an inline `{ count: string }` row type and returns `number`).

- [ ] **Step 2: Create the barrel `index.ts`**

```ts
export { createCollection } from './createCollection.js';
export { deleteCollection } from './deleteCollection.js';
export { getCollectionById } from './getCollectionById.js';
export { getCollectionDocumentCount } from './getCollectionDocumentCount.js';
export { getDemoCollection } from './getDemoCollection.js';
export { getDemoCollections } from './getDemoCollections.js';
export { listCollections } from './listCollections.js';
```

- [ ] **Step 3: Delete the old module**

```bash
git rm apps/server/src/repositories/collections/collections.ts
```

- [ ] **Step 4: Update consumers (gap-pattern #1)**

Change `'app/repositories/collections/collections.js'` to `'app/repositories/collections/index.js'` in: `handlers/qa/qa.ts:4`, `handlers/collections/collections.ts:1`, `routes/collections.ts:3`, and in `handlers/qa/qa.test.ts` both the import (line 2) and `vi.mock` (line 32).

- [ ] **Step 5: Verify, test, build**

```bash
grep -rn "repositories/collections/collections" apps/server/src   # expect: no matches
pnpm --filter policy-pilot-server test && pnpm --filter policy-pilot-server build
```

Expected: PASS, same count.

- [ ] **Step 6: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A3): split collections repository to one function per file"
```

---

### Task 6: Split `repositories/conversations` to one function per file

**Files:**

- Create: `apps/server/src/repositories/conversations/{createConversation,getConversation,listConversations,createMessage,updateConversationTitle,getMessages,index}.ts`
- Delete: `apps/server/src/repositories/conversations/conversations.ts`
- Modify (consumers): `handlers/qa/qa.ts:5`, `routes/conversations.ts:2`, `handlers/qa/qa.test.ts:3,26`, `repositories/conversations/conversations.test.ts` (import)

**Interfaces:**

- Produces: barrel `app/repositories/conversations/index.js` with the 6 functions (verbatim). No helpers, no intra-folder deps. Every file imports `import { query } from 'app/database/pool.js';`; type imports per use (`createMessage`/`getMessages` use `Message`; the others use `Conversation`; `updateConversationTitle` returns `void` and needs no type import).

- [ ] **Step 1: Create the 6 function files** (header plus imports plus verbatim bodies from `conversations.ts`).

- [ ] **Step 2: Create the barrel `index.ts`**

```ts
export { createConversation } from './createConversation.js';
export { createMessage } from './createMessage.js';
export { getConversation } from './getConversation.js';
export { getMessages } from './getMessages.js';
export { listConversations } from './listConversations.js';
export { updateConversationTitle } from './updateConversationTitle.js';
```

- [ ] **Step 3: Delete the old module**

```bash
git rm apps/server/src/repositories/conversations/conversations.ts
```

- [ ] **Step 4: Update consumers (gap-pattern #1)**

Change `'app/repositories/conversations/conversations.js'` to `'.../index.js'` in: `handlers/qa/qa.ts:5`, `routes/conversations.ts:2`, `handlers/qa/qa.test.ts` import (line 3) plus `vi.mock` (line 26). In `repositories/conversations/conversations.test.ts` change `from './conversations.js'` to `from './index.js'`.

- [ ] **Step 5: Verify, test, build**

```bash
grep -rn "repositories/conversations/conversations" apps/server/src   # expect: no matches
pnpm --filter policy-pilot-server test && pnpm --filter policy-pilot-server build
```

Expected: PASS, same count.

- [ ] **Step 6: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A3): split conversations repository to one function per file"
```

---

### Task 7: Split `repositories/documents` to one function per file

**Files:**

- Create: `apps/server/src/repositories/documents/{createDocument,getDocumentById,listDocuments,updateDocumentStatus,deleteDocument,index}.ts`
- Delete: `apps/server/src/repositories/documents/documents.ts`
- Modify (consumers): `handlers/documents/documents.ts:4`, `handlers/collections/collections.ts:2`, `handlers/documents/documents.test.ts:3,14`, `repositories/documents/documents.test.ts` (import)

**Interfaces:**

- Produces: barrel `app/repositories/documents/index.js` with the 5 functions (verbatim). No helpers, no intra-folder deps. Imports per file: `import { query } from 'app/database/pool.js';` in all; type imports per use (`createDocument`/`getDocumentById`/`listDocuments` use `Document`, and `createDocument` also needs `import type { PoolClient } from 'app/database/pool.js';`; `updateDocumentStatus` uses `DocumentStatus` and returns `void`; `deleteDocument` returns `boolean`, no type import).

- [ ] **Step 1: Create the 5 function files** (header plus imports plus verbatim bodies from `documents.ts`).

- [ ] **Step 2: Create the barrel `index.ts`**

```ts
export { createDocument } from './createDocument.js';
export { deleteDocument } from './deleteDocument.js';
export { getDocumentById } from './getDocumentById.js';
export { listDocuments } from './listDocuments.js';
export { updateDocumentStatus } from './updateDocumentStatus.js';
```

- [ ] **Step 3: Delete the old module**

```bash
git rm apps/server/src/repositories/documents/documents.ts
```

- [ ] **Step 4: Update consumers (gap-pattern #1)**

Change `'app/repositories/documents/documents.js'` to `'.../index.js'` in: `handlers/documents/documents.ts:4`, `handlers/collections/collections.ts:2`, `handlers/documents/documents.test.ts` import (line 3) plus `vi.mock` (line 14). In `repositories/documents/documents.test.ts` change `from './documents.js'` to `from './index.js'`.

- [ ] **Step 5: Verify, test, build**

```bash
grep -rn "repositories/documents/documents" apps/server/src   # expect: no matches
pnpm --filter policy-pilot-server test && pnpm --filter policy-pilot-server build
```

Expected: PASS, same count.

- [ ] **Step 6: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A3): split documents repository to one function per file"
```

---

### Task 8: Extract the Anthropic client and move `generateConversationTitle` to a service

**Files:**

- Create: `apps/server/src/clients/anthropic.ts`, `apps/server/src/services/generateConversationTitle.ts`
- Modify: `apps/server/src/handlers/qa/qa.ts`, `apps/server/src/handlers/qa/qa.test.ts`
- Create (test): `apps/server/src/services/generateConversationTitle.test.ts` (the `generateConversationTitle` describe block moved out of `qa.test.ts`)

**Interfaces:**

- Produces: `import { anthropic } from 'app/clients/anthropic.js'`, the configured SDK singleton (`anthropic.messages.create`, `anthropic.messages.stream`).
- Produces: `import { generateConversationTitle } from 'app/services/generateConversationTitle.js'`, `(question: string) => Promise<string>`, same behavior as today (haiku call, trim, fallback to `question.slice(0, 100)`).

- [ ] **Step 1: Create the Anthropic singleton** (mirrors `@repo/clients/r2/s3Client.ts`)

```ts
/** Configured Anthropic SDK singleton: the single place the LLM SDK is constructed, so handlers and services never call `new Anthropic()` directly (R-222, R-224). */
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

- [ ] **Step 2: Write the failing service test**

Create `apps/server/src/services/generateConversationTitle.test.ts` by moving the `describe('generateConversationTitle', ...)` block (currently `qa.test.ts` lines ~350-392) and the pieces it needs. It mocks the new client and the logger:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateConversationTitle } from './generateConversationTitle.js';

const { mockMessagesCreate } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Default Title' }],
  }),
}));

vi.mock('app/clients/anthropic.js', () => ({
  anthropic: { messages: { create: mockMessagesCreate } },
}));

vi.mock('@repo/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('generateConversationTitle', () => {
  beforeEach(() => vi.clearAllMocks());
  // (paste the moved assertions verbatim: returns the model title, trims, falls back on error/empty)
});
```

(Copy the original `it(...)` cases verbatim from `qa.test.ts`. They set `mockMessagesCreate` return values and assert the returned title / fallback.)

- [ ] **Step 3: Run it, confirm it fails**

Run: `pnpm --filter policy-pilot-server test -- generateConversationTitle`
Expected: FAIL ("Cannot find module './generateConversationTitle.js'").

- [ ] **Step 4: Create the service** (move the function verbatim from `qa.ts`, swap the SDK source)

```ts
/** Generates a short AI title for a new conversation; falls back to the truncated question on any failure. */
import { logger } from '@repo/logger';
import { anthropic } from 'app/clients/anthropic.js';

const TITLE_MODEL = 'claude-haiku-4-5-20251001';
const TITLE_MAX_TOKENS = 30;

export async function generateConversationTitle(
  question: string,
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: TITLE_MODEL,
      max_tokens: TITLE_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: `Generate a 3-6 word title for a conversation that started with this question: ${question}. Reply with just the title, no quotes.`,
        },
      ],
    });
    const block = response.content[0];
    if (block?.type === 'text' && block.text.trim().length > 0) {
      return block.text.trim();
    }
    return question.slice(0, 100);
  } catch (err) {
    logger.warn({ err }, 'Title generation failed, using fallback');
    return question.slice(0, 100);
  }
}
```

- [ ] **Step 5: Rewrite `handlers/qa/qa.ts`**

- Remove `import Anthropic from '@anthropic-ai/sdk';` and the `const anthropic = new Anthropic({...});` block.
- Remove the `generateConversationTitle` function (now in the service).
- Add `import { anthropic } from 'app/clients/anthropic.js';` and `import { generateConversationTitle } from 'app/services/generateConversationTitle.js';`.
- Add module-level `const QA_MODEL = 'claude-sonnet-4-20250514';` and `const QA_MAX_TOKENS = 2048;`; use them in the existing `anthropic.messages.stream({ model: QA_MODEL, max_tokens: QA_MAX_TOKENS, ... })` call (the `.stream(...)` call body is otherwise unchanged; `anthropic` now refers to the imported singleton).

- [ ] **Step 6: Update `qa.test.ts` for the extracted client (gap-pattern #1)**

- Change the SDK mock (lines 17-24) from `vi.mock('@anthropic-ai/sdk', ...)` to `vi.mock('app/clients/anthropic.js', () => ({ anthropic: { messages: { create: mockMessagesCreate, stream: mockMessagesStream } } }))`. Keep the `vi.hoisted` block.
- Change `import { generateConversationTitle, streamQA } from './qa.js'` to `import { streamQA } from './qa.js'`.
- Delete the moved `describe('generateConversationTitle', ...)` block (now in the service test). Keep `describe('streamQA')` and `describe('title generation in streamQA')` (they exercise the real service through the mocked client plus mocked conv repo).

- [ ] **Step 7: Run service plus handler tests, then build**

Run: `pnpm --filter policy-pilot-server test && pnpm --filter policy-pilot-server build`
Expected: PASS. Net test count unchanged (3 title cases moved, not removed).

- [ ] **Step 8: Verify the layering fix**

```bash
grep -rn "new Anthropic(" apps/server/src   # expect: only apps/server/src/clients/anthropic.ts
```

- [ ] **Step 9: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A3): extract Anthropic client, move generateConversationTitle to services"
```

---

### Task 9: Rename `retrieval.service.ts` to `services/searchChunks.ts`

**Files:**

- Create: `apps/server/src/services/searchChunks.ts` (from `retrieval.service.ts`)
- Delete: `apps/server/src/services/retrieval.service.ts`
- Rename test: `services/retrieval.service.test.ts` to `services/searchChunks.test.ts` (stays co-located until Task 11)
- Modify: `handlers/qa/qa.ts` (import plus the `retrievalService.searchChunks` call site), `handlers/qa/qa.test.ts`

**Interfaces:**

- Produces: `import { searchChunks } from 'app/services/searchChunks.js'`, same signature `(embedding, userId, topK?, collectionId?) => Promise<CitedChunk[]>`.

- [ ] **Step 1: Move source and test (contents unchanged except test import)**

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot
git mv apps/server/src/services/retrieval.service.ts apps/server/src/services/searchChunks.ts
git mv apps/server/src/services/retrieval.service.test.ts apps/server/src/services/searchChunks.test.ts
```

In `searchChunks.test.ts` change `from './retrieval.service.js'` to `from './searchChunks.js'` (pool plus logger mocks already correct).

- [ ] **Step 2: Update the qa handler**

In `handlers/qa/qa.ts`: change `import * as retrievalService from 'app/services/retrieval.service.js';` to `import { searchChunks } from 'app/services/searchChunks.js';` and change the call `await retrievalService.searchChunks(...)` to `await searchChunks(...)`.

- [ ] **Step 3: Update `qa.test.ts` (gap-pattern #1)**

Change `import * as retrievalService from 'app/services/retrieval.service.js'` to `import * as retrievalService from 'app/services/searchChunks.js'` (keep the namespace alias so `mockRetrieval`/`vi.mocked(retrievalService)` still work) and `vi.mock('app/services/retrieval.service.js', ...)` to `vi.mock('app/services/searchChunks.js', ...)`.

- [ ] **Step 4: Verify, test, build**

```bash
grep -rn "retrieval.service" apps/server/src   # expect: no matches
pnpm --filter policy-pilot-server test && pnpm --filter policy-pilot-server build
```

Expected: PASS, same count.

- [ ] **Step 5: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A3): rename retrieval service to services/searchChunks"
```

---

### Task 10: Split `prompts/qa-system.ts`

**Files:**

- Create: `apps/server/src/prompts/qaSystemPrompt.ts`, `apps/server/src/prompts/buildContextPrompt.ts`
- Delete: `apps/server/src/prompts/qa-system.ts`
- Modify: `handlers/qa/qa.ts:3`
- Split test: `prompts/qa-system.test.ts` into `prompts/qaSystemPrompt.test.ts` plus `prompts/buildContextPrompt.test.ts` (stay co-located until Task 11)

**Interfaces:**

- Produces: `import { QA_SYSTEM_PROMPT } from 'app/prompts/qaSystemPrompt.js'` and `import { buildContextPrompt } from 'app/prompts/buildContextPrompt.js'`.

- [ ] **Step 1: Create `qaSystemPrompt.ts`** (single-constant file, header-exempt; copy the `QA_SYSTEM_PROMPT` string verbatim from `qa-system.ts`)

```ts
export const QA_SYSTEM_PROMPT = `You are a helpful document Q&A assistant. Answer questions based ONLY on the provided context from the user's documents.

Rules:
- Only use information from the provided context to answer questions
- Cite your sources using [1], [2], etc. markers that correspond to the numbered context chunks
- If the context doesn't contain enough information to answer, say "I don't have enough information in the provided documents to answer this question."
- Be concise and direct in your answers
- When multiple chunks support a claim, cite all relevant ones`;
```

- [ ] **Step 2: Create `buildContextPrompt.ts`** (function module, header required)

```ts
/** Assembles the numbered-context user prompt from retrieved chunks for the QA completion. */
import type { CitedChunk } from '@repo/types';

export function buildContextPrompt(
  chunks: CitedChunk[],
  question: string,
): string {
  const contextParts = chunks.map(
    (chunk, i) =>
      `[${i + 1}] (From "${chunk.filename}", chunk ${chunk.chunk_index}):\n${chunk.content}`,
  );

  return `Context from documents:\n\n${contextParts.join('\n\n---\n\n')}\n\nQuestion: ${question}`;
}
```

- [ ] **Step 3: Split the test**

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot
git rm apps/server/src/prompts/qa-system.test.ts
```

Create `prompts/qaSystemPrompt.test.ts` with the `describe('QA_SYSTEM_PROMPT', ...)` cases (import from `./qaSystemPrompt.js`) and `prompts/buildContextPrompt.test.ts` with the `describe('buildContextPrompt', ...)` cases (import `{ buildContextPrompt }` from `./buildContextPrompt.js`, plus `import type { CitedChunk } from '@repo/types'`). Copy assertions verbatim from the original `qa-system.test.ts`.

- [ ] **Step 4: Delete old source and update the handler**

```bash
git rm apps/server/src/prompts/qa-system.ts
```

In `handlers/qa/qa.ts:3` replace `import { QA_SYSTEM_PROMPT, buildContextPrompt } from 'app/prompts/qa-system.js';` with two imports: `import { buildContextPrompt } from 'app/prompts/buildContextPrompt.js';` and `import { QA_SYSTEM_PROMPT } from 'app/prompts/qaSystemPrompt.js';` (sorted).

- [ ] **Step 5: Verify, test, build**

```bash
grep -rn "qa-system" apps/server/src   # expect: no matches
pnpm --filter policy-pilot-server test && pnpm --filter policy-pilot-server build
```

Expected: PASS, same count.

- [ ] **Step 6: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A3): split prompts/qa-system into constant + builder modules"
```

---

### Task 11: Consolidate tests into `src/__tests__/` mirror and rename integration dir

**Files:**

- Move all remaining co-located `*.test.ts` under `src/__tests__/` mirroring source layout.
- Rename `src/__integration__/` to `src/__tests__/integration/`.
- Modify: `apps/server/vitest.config.ts`, `apps/server/vitest.integration.config.ts`.

**Interfaces:**

- After this task: no `*.test.ts` co-located beside source (R-221); one `src/__tests__/` tree (R-239); integration suite under `src/__tests__/integration/`.

- [ ] **Step 1: Move unit tests to the mirror**

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot/apps/server/src
mkdir -p __tests__/config __tests__/constants __tests__/schemas \
  __tests__/handlers/auth __tests__/handlers/documents __tests__/handlers/qa \
  __tests__/middleware/csrfGuard __tests__/middleware/errorHandler \
  __tests__/middleware/notFoundHandler __tests__/middleware/rateLimiter \
  __tests__/middleware/requireAuth \
  __tests__/repositories/auth __tests__/repositories/conversations __tests__/repositories/documents \
  __tests__/services __tests__/prompts
git mv config/env.test.ts __tests__/config/env.test.ts
git mv constants/session.test.ts __tests__/constants/session.test.ts
git mv schemas/auth.test.ts __tests__/schemas/auth.test.ts
git mv handlers/auth/auth.test.ts __tests__/handlers/auth/auth.test.ts
git mv handlers/documents/documents.test.ts __tests__/handlers/documents/documents.test.ts
git mv handlers/qa/qa.test.ts __tests__/handlers/qa/qa.test.ts
git mv middleware/csrfGuard/csrfGuard.test.ts __tests__/middleware/csrfGuard/csrfGuard.test.ts
git mv middleware/errorHandler/errorHandler.test.ts __tests__/middleware/errorHandler/errorHandler.test.ts
git mv middleware/notFoundHandler/notFoundHandler.test.ts __tests__/middleware/notFoundHandler/notFoundHandler.test.ts
git mv middleware/rateLimiter/rateLimiter.test.ts __tests__/middleware/rateLimiter/rateLimiter.test.ts
git mv middleware/requireAuth/requireAuth.test.ts __tests__/middleware/requireAuth/requireAuth.test.ts
git mv repositories/auth/auth.test.ts __tests__/repositories/auth/auth.test.ts
git mv repositories/conversations/conversations.test.ts __tests__/repositories/conversations/conversations.test.ts
git mv repositories/documents/documents.test.ts __tests__/repositories/documents/documents.test.ts
git mv services/searchChunks.test.ts __tests__/services/searchChunks.test.ts
git mv services/generateConversationTitle.test.ts __tests__/services/generateConversationTitle.test.ts
git mv prompts/qaSystemPrompt.test.ts __tests__/prompts/qaSystemPrompt.test.ts
git mv prompts/buildContextPrompt.test.ts __tests__/prompts/buildContextPrompt.test.ts
```

- [ ] **Step 2: Convert relative imports to alias imports in the moved tests**

Any moved test that imports its subject relatively must now use the `app/` alias. Find them and fix:

```bash
grep -rn "from '\./" apps/server/src/__tests__   # each hit becomes app/<source-path>.js
```

Concretely: `__tests__/config/env.test.ts` `./env.js` to `app/config/env.js`; `__tests__/constants/session.test.ts` `./session.js` to `app/constants/session.js`; `__tests__/schemas/auth.test.ts` `./auth.js` to `app/schemas/auth.js`; `__tests__/handlers/*/*.test.ts` `./<name>.js` to `app/handlers/<dir>/<name>.js`; `__tests__/middleware/*/*.test.ts` similarly; `__tests__/repositories/<dir>/<dir>.test.ts` `./index.js` to `app/repositories/<dir>/index.js`; `__tests__/services/searchChunks.test.ts` `./searchChunks.js` to `app/services/searchChunks.js`; `__tests__/services/generateConversationTitle.test.ts` `./generateConversationTitle.js` to `app/services/generateConversationTitle.js`; `__tests__/prompts/*.test.ts` `./<name>.js` to `app/prompts/<name>.js`. (`vi.mock` specifiers already use the `app/` alias and need no change.)

- [ ] **Step 3: Rename the integration dir**

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot/apps/server/src
git mv __integration__ __tests__/integration
```

The integration tests already import via the `app/` alias (e.g. `app/database/pool.js`) and need no import edits.

- [ ] **Step 4: Update `vitest.config.ts`** (unit config: exclude the new integration path)

```ts
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      app: path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/__tests__/integration/**', 'dist/**'],
  },
});
```

- [ ] **Step 5: Update `vitest.integration.config.ts`** (integration include plus setup path)

Change `include: ['src/__integration__/**/*.test.ts']` to `include: ['src/__tests__/integration/**/*.test.ts']` and `setupFiles: ['src/__integration__/setup.ts']` to `setupFiles: ['src/__tests__/integration/setup.ts']`. (`setup.ts` is not a `*.test.ts`, so it is not double-collected.)

- [ ] **Step 6: Verify layout and run both suites plus build**

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot
find apps/server/src -name '*.test.ts' -not -path '*/__tests__/*'   # expect: no matches
test -d apps/server/src/__integration__ && echo "STILL EXISTS" || echo "renamed ok"
pnpm --filter policy-pilot-server test && pnpm --filter policy-pilot-server build
pnpm --filter policy-pilot-server test:integration   # requires DB; run if creds present, else note skip
```

Expected: unit PASS (same count); integration PASS or documented skip.

- [ ] **Step 7: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A3): consolidate tests into src/__tests__ mirror, rename integration dir"
```

---

### Task 12: Whole-branch verification, sweep, and PR

**Files:** none (verification plus docs).

- [ ] **Step 1: Compliance greps (all must return no matches)**

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot
grep -rn "app/db/\|app/utils/" apps/server/src                       # no db/ or utils/ imports
test -d apps/server/src/db && echo FAIL || echo "no db/ dir"
test -d apps/server/src/utils && echo FAIL || echo "no utils/ dir"
grep -rln "\.service" apps/server/src/services                        # no .service suffix files
grep -rn "new Anthropic(" apps/server/src | grep -v "clients/anthropic.ts"   # only the client constructs it
find apps/server/src -name '*.test.ts' -not -path '*/__tests__/*'     # no co-located tests
```

- [ ] **Step 2: Confirm no orphaned deps (gap-pattern #2)**

```bash
git diff main -- apps/server/package.json   # expect: empty (no dep changes in A3)
```

- [ ] **Step 3: Full monorepo gates**

Run: `pnpm build && pnpm test && pnpm run smoke`
Expected: all green. Record the server unit test count; it must equal the pre-A3 baseline (no tests lost; the 3 title cases relocated).

- [ ] **Step 4: Lint the server**

Run: `pnpm --filter policy-pilot-server lint`
Expected: clean. (If eslint flags any moved import ordering, run `pnpm --filter policy-pilot-server format` and re-commit into the relevant task.)

- [ ] **Step 5: Format scratch plus open PR**

```bash
npx prettier --write '.superpowers/**/*.md' 2>/dev/null || true
git push -u origin refactor/trackA3-server-internals
```

Write the PR doc at `docs/prs/2026-06-22-trackA3-server-internals.md` (summary, what-changed, decisions D1-D4 with chosen-vs-alternative-vs-why, testing, reflection) before opening. Open the PR; request Copilot review via the Reviewers panel UI (the API reviewer add is unavailable in this repo). Do NOT merge without explicit per-turn authorization (R-516). After merge, monitor GitHub Actions plus Railway (server + worker) plus health endpoints.

- [ ] **Step 6: Update the master index**

In `docs/superpowers/plans/2026-06-21-convention-refactor-index.md`, set the A3 row Status to "Shipped" once merged and deployed.

---

## Self-Review

**1. Spec coverage** (spec section "A3: Server internals"):

- "`db/` becomes `database/`; collapse `database/pool.ts`": Task 1 (D4). Covered.
- "Eliminate `utils/`: `ApiError` to `errors/`; logger to `logging/`": Tasks 2, 3. Logger resolution is direct `@repo/logger` import, not `logging/` (D2, documented divergence). Covered.
- "Repositories: one function per file (R-235); verb-noun names": Tasks 4-7. Covered.
- "Handlers: one function per file; extract the Anthropic call ... into `clients/llm.ts`": handler split dropped (D1, reference-repo-resolved); Anthropic to `clients/anthropic.ts` (D3), Task 8. Covered.
- "Split `prompts/qa-system.ts` into constant module + builder function": Task 10. Covered.
- "Test consolidation: `__integration__/` to `__tests__/integration/`; co-located to `__tests__/` mirror; fixtures to `__fixtures__/`": Task 11. No server fixtures exist, so `__fixtures__/` is N/A (noted). Covered.
- "Done when: no `utils/`, no `db/`, no multi-export function-tree files, tests relocated and green": Task 12 greps. Handlers (orchestrators, not a function tree) remain multi-export per D1. Covered.

**2. Placeholder scan:** New-file contents (anthropic client, barrels, prompt modules, title service) are verbatim. Repository function bodies and moved test assertions are "copy verbatim from `<exact path>`" instructions against existing in-repo code the executing agent reads, which is concrete, not vague. No "add error handling"/"TBD"/"similar to" placeholders.

**3. Type consistency:** `searchChunks` signature identical across Task 9 producer and the qa-handler consumer. `generateConversationTitle(question: string): Promise<string>` identical across Task 8 service, its test, and the qa-handler call. `anthropic` singleton shape (`messages.create`/`messages.stream`) matches both the handler/service usage and the test mocks. Barrel export names match each split function file name.

**4. Gap-pattern pre-flight (project memory `refactor-plan-gap-patterns`):**

- #1 (mock sites of moved modules): every `vi.mock(` of a moved specifier is enumerated in the owning task: pool (Task 1), logger (Task 3), each repo barrel (Tasks 4-7), `@anthropic-ai/sdk` to `app/clients/anthropic.js` (Task 8), retrieval to searchChunks (Task 9), prompts (Task 10). Covered.
- #2 (orphaned deps after re-export change): A3 deletes a re-export (logger) but the deps (`pino`/`pino-pretty`) were already non-direct after A2; Task 3 Step 4 and Task 12 Step 2 verify `package.json` is unchanged. Covered.
