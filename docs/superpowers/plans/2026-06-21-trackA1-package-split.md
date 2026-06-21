# Track A1: Package Split and Rescope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `packages/common` (`policy-pilot-common`) into two canonical shared packages, `@repo/types` and `@repo/chunker`, and update every importer and build reference, with no behavior change.

**Architecture:** `packages/common` holds two fully self-contained concerns: `src/types/index.ts` (130 LOC, zero imports) and `src/chunker/index.ts` (119 LOC, zero imports, one co-located test). Neither imports the other. A1 moves each concern into its own package under `packages/`, rescopes both to the project-agnostic `@repo/*` scope (R-236), and rewires all consumers. Apps stay unscoped (`policy-pilot-server`, `policy-pilot-worker`, `policy-pilot-web`). This is a purely mechanical, atomic rename: one PR, branched off updated `main`, landing as a single commit because the build is red between the first file move and the final rewire.

**Tech Stack:** pnpm workspaces, TypeScript (NodeNext), Vitest, ESLint flat config, Prettier, Docker (Railway), GitHub Actions, lefthook.

## Global Constraints

- No U+2014 em dash anywhere (R-001).
- One PR, branched off updated `main`; zero stacking. Branch: `refactor/trackA1-package-split` (R-213, project PR Workflow).
- This is an atomic package rename plus all importers; it stays one larger PR rather than a base+dependent chain (spec section 7).
- No logic changes. Moved source files are byte-identical (`git mv`); the only edits are import specifiers, package names, and build references.
- R-511 exception (stated explicitly): pure structural refactor, no new behavior. No new failing test is written. The regression harness is the existing `@repo/chunker` unit test plus the full server/worker suites plus a clean full build plus `npm run smoke`.
- R-515: a package rename breaks import paths repo-wide; every reference (source, config, Docker, CI, lint) is updated in the same commit as the rename.
- Shared packages take `@repo/*` (R-236); apps stay unscoped.
- One exported function per file is already satisfied (chunker exports `chunkText` plus two interfaces from one module); A1 does NOT restructure module internals (out of scope; the public entry stays `index.ts`).
- Squash merge, delete branch. Never merge without explicit per-turn authorization (R-516).
- Deploy monitoring after merge to `main`: GitHub Actions, Railway, health endpoints green before claiming done.

## File Structure

**New packages created:**

- `packages/types/` is `@repo/types`. `src/index.ts` (moved verbatim from `packages/common/src/types/index.ts`). No tests (none exist today). Files: `package.json`, `tsconfig.json`, `src/index.ts`.
- `packages/chunker/` is `@repo/chunker`. `src/index.ts` plus `src/index.test.ts` (both moved verbatim from `packages/common/src/chunker/`). Files: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/index.test.ts`.

**Deleted:** `packages/common/` entirely (`package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, and the now-empty `src/types/` plus `src/chunker/` dirs).

**Inter-package dependency:** none. `@repo/chunker` does NOT depend on `@repo/types` (chunker is self-contained). Confirmed: `grep -nE "^import|from '" packages/common/src/chunker/index.ts` returns nothing.

**Consumers (exhaustive, verified by grep):**

| Consumer                                                                 | Current specifier               | New specifier     |
| ------------------------------------------------------------------------ | ------------------------------- | ----------------- |
| `apps/server/src/repositories/conversations/conversations.ts`            | `'policy-pilot-common'`         | `'@repo/types'`   |
| `apps/server/src/repositories/documents/documents.ts`                    | `'policy-pilot-common'`         | `'@repo/types'`   |
| `apps/server/src/repositories/collections/collections.ts`                | `'policy-pilot-common'`         | `'@repo/types'`   |
| `apps/server/src/prompts/qa-system.ts`                                   | `'policy-pilot-common'`         | `'@repo/types'`   |
| `apps/server/src/prompts/qa-system.test.ts`                              | `'policy-pilot-common'`         | `'@repo/types'`   |
| `apps/server/src/handlers/documents/documents.ts`                        | `'policy-pilot-common'`         | `'@repo/types'`   |
| `apps/server/src/services/retrieval.service.ts`                          | `'policy-pilot-common'`         | `'@repo/types'`   |
| `apps/worker/src/workers.ts`                                             | `'policy-pilot-common/types'`   | `'@repo/types'`   |
| `apps/worker/src/processors/document-processor.ts` (chunk)               | `'policy-pilot-common/chunker'` | `'@repo/chunker'` |
| `apps/worker/src/processors/document-processor.ts` (types)               | `'policy-pilot-common/types'`   | `'@repo/types'`   |
| `apps/worker/src/__integration__/document-processor.integration.test.ts` | `'policy-pilot-common'`         | `'@repo/types'`   |

**Config / build references (exhaustive, verified by grep):**

| File                       | Reference                                                    |
| -------------------------- | ------------------------------------------------------------ |
| `pnpm-workspace.yaml`      | `- 'packages/common'`                                        |
| `package.json` (root)      | `build` and `test` scripts                                   |
| `lefthook.yml`             | `build` command (line 16)                                    |
| `.github/workflows/ci.yml` | "Build common package" step (lines 50-51)                    |
| `eslint.config.js`         | `parserOptions.project` array (line 96)                      |
| `Dockerfile.server`        | lines 6, 9, 11-12, 27, 29, 33                                |
| `Dockerfile.worker`        | manifest copy, install filter, source copy, build, dist copy |
| `apps/server/package.json` | dependency (line 32)                                         |
| `apps/worker/package.json` | dependency (line 28)                                         |

`apps/client/web` does NOT consume the package (verified: web `src/` has zero references). The `apps/client/web/.next/standalone/package.json` match is generated build output, gitignored, regenerated on build. Do not edit it.

---

### Task 1: Create `@repo/types` package

**Files:**

- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Move: `packages/common/src/types/index.ts` to `packages/types/src/index.ts` (verbatim)

**Interfaces:**

- Produces: package `@repo/types`, default export entry `dist/index.js`. Public types unchanged: `DocumentStatus`, `User`, `Document`, `Chunk`, `Conversation`, `Message`, `Collection`, `DocumentUploadResponse`, `DocumentListResponse`, `QARequest`, `CitedChunk`, `QATokenEvent`, `QACitationsEvent`, `QADoneEvent`, `QAErrorEvent`, `QAStreamEvent`, `DocumentProcessJob`.

- [ ] **Step 1: Move the types module verbatim**

```bash
mkdir -p packages/types/src
git mv packages/common/src/types/index.ts packages/types/src/index.ts
```

- [ ] **Step 2: Create `packages/types/package.json`**

```json
{
  "name": "@repo/types",
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

Note: no `test` script and no `vitest` devDep. `@repo/types` has no tests (none exist in `packages/common/src/types/`).

- [ ] **Step 3: Create `packages/types/tsconfig.json`** (identical to the old common tsconfig)

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

- [ ] **Step 4: Do not commit yet.** The build is intentionally red until Task 3 finishes (consumers still reference `policy-pilot-common`). This package is one half of an atomic rename; the single commit happens in Task 4.

---

### Task 2: Create `@repo/chunker` package

**Files:**

- Create: `packages/chunker/package.json`
- Create: `packages/chunker/tsconfig.json`
- Create: `packages/chunker/vitest.config.ts`
- Move: `packages/common/src/chunker/index.ts` to `packages/chunker/src/index.ts` (verbatim)
- Move: `packages/common/src/chunker/index.test.ts` to `packages/chunker/src/index.test.ts` (verbatim)

**Interfaces:**

- Produces: package `@repo/chunker`, default export entry `dist/index.js`. Public surface unchanged: `chunkText(...)`, `interface ChunkOptions`, `interface TextChunk`.
- Consumes: nothing (self-contained; no dependency on `@repo/types`).

- [ ] **Step 1: Move the chunker module and its test verbatim**

```bash
mkdir -p packages/chunker/src
git mv packages/common/src/chunker/index.ts packages/chunker/src/index.ts
git mv packages/common/src/chunker/index.test.ts packages/chunker/src/index.test.ts
```

The test imports `from './index.js'` (relative) and needs no change.

- [ ] **Step 2: Create `packages/chunker/package.json`**

```json
{
  "name": "@repo/chunker",
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
    "format:check": "prettier --config ../../prettier.config.mjs --check .",
    "test": "vitest run",
    "test:watch": "vitest"
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
    "typescript-eslint": "^8.56.1",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 3: Create `packages/chunker/tsconfig.json`** (identical to the old common tsconfig, same content as Task 1 Step 3)

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

- [ ] **Step 4: Create `packages/chunker/vitest.config.ts`** (identical to the old common vitest config)

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

- [ ] **Step 5: Do not commit yet.** Single commit in Task 4.

---

### Task 3: Rewire all consumers and build references; delete `packages/common`

**Files:**

- Modify: `pnpm-workspace.yaml`
- Modify: `package.json` (root, lines 11 and 16)
- Modify: `lefthook.yml` (line 16)
- Modify: `.github/workflows/ci.yml` (lines 50-51)
- Modify: `eslint.config.js` (line 96)
- Modify: `Dockerfile.server`
- Modify: `Dockerfile.worker`
- Modify: `apps/server/package.json` (line 32)
- Modify: `apps/worker/package.json` (line 28)
- Modify: 7 server source files plus 4 worker source-and-test references (see consumers table)
- Delete: `packages/common/` (remaining `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`)

**Interfaces:**

- Consumes: `@repo/types` (Task 1) and `@repo/chunker` (Task 2).

- [ ] **Step 1: Update `pnpm-workspace.yaml`.** Replace the `packages/common` glob with the two new packages.

```yaml
packages:
  - 'apps/server'
  - 'apps/worker'
  - 'apps/client/web'
  - 'packages/types'
  - 'packages/chunker'
```

- [ ] **Step 2: Update root `package.json` `build` and `test` scripts.**

`build` (line 11) becomes:

```
"build": "pnpm --filter @repo/types build && pnpm --filter @repo/chunker build && pnpm --filter policy-pilot-server build && pnpm --filter policy-pilot-worker build && pnpm --filter policy-pilot-web build",
```

`test` (line 16) becomes (types has no tests, so only chunker runs from the shared packages):

```
"test": "pnpm --filter @repo/chunker run test && pnpm --filter policy-pilot-server run test",
```

- [ ] **Step 3: Update `lefthook.yml` build command (line 16).**

```yaml
run: pnpm --filter @repo/types build && pnpm --filter @repo/chunker build && pnpm --filter policy-pilot-server build && pnpm --filter policy-pilot-worker build
```

- [ ] **Step 4: Update `.github/workflows/ci.yml`.** Rename the build step (lines 50-51) to build both shared packages.

```yaml
- name: Build shared packages
  run: pnpm --filter @repo/types build && pnpm --filter @repo/chunker build
```

- [ ] **Step 5: Update `eslint.config.js` `parserOptions.project` array (line 96).** Replace the single `packages/common` entry with both new packages.

```javascript
        project: [
          './apps/server/tsconfig.json',
          './apps/client/web/tsconfig.json',
          './apps/worker/tsconfig.json',
          './packages/types/tsconfig.json',
          './packages/chunker/tsconfig.json',
        ],
```

- [ ] **Step 6: Update `Dockerfile.server`.** Replace every `packages/common` reference: the base stage manifest-copy, install, source-copy, build; and the production stage manifest-copy, install, dist-copy.

Base stage, replace:

```dockerfile
COPY packages/common/package.json packages/common/
```

with:

```dockerfile
COPY packages/types/package.json packages/types/
COPY packages/chunker/package.json packages/chunker/
```

Replace both `pnpm install --frozen-lockfile --filter policy-pilot-common ...` lines (base line 9 and production line 29), swapping `--filter policy-pilot-common` for `--filter @repo/types --filter @repo/chunker`:

```dockerfile
RUN pnpm install --frozen-lockfile --filter @repo/types --filter @repo/chunker --filter policy-pilot-server --filter policy-pilot-worker --ignore-scripts
```

and the production one:

```dockerfile
RUN pnpm install --frozen-lockfile --filter @repo/types --filter @repo/chunker --filter policy-pilot-server --filter policy-pilot-worker --prod --ignore-scripts
```

Replace the source copy plus build:

```dockerfile
COPY packages/common/ packages/common/
RUN pnpm --filter policy-pilot-common run build
```

with:

```dockerfile
COPY packages/types/ packages/types/
COPY packages/chunker/ packages/chunker/
RUN pnpm --filter @repo/types build && pnpm --filter @repo/chunker build
```

Replace the production dist copy:

```dockerfile
COPY --from=base /app/packages/common/dist packages/common/dist
```

with:

```dockerfile
COPY --from=base /app/packages/types/dist packages/types/dist
COPY --from=base /app/packages/chunker/dist packages/chunker/dist
```

- [ ] **Step 7: Update `Dockerfile.worker`** with the same four substitutions as Step 6 (manifest copy becomes two lines; install filters become `@repo/types` plus `@repo/chunker`; source copy plus build becomes two copies plus chained build; production dist copy becomes two lines). Read the file first and apply the identical pattern; the worker image needs both packages (worker imports `chunkText` and `DocumentProcessJob`).

- [ ] **Step 8: Update `apps/server/package.json` dependency (line 32).** Server uses only types. Replace `"policy-pilot-common": "workspace:*"` with `"@repo/types": "workspace:*"`, keeping the `dependencies` block alphabetically sorted (`@repo/types` sorts to the top).

- [ ] **Step 9: Update `apps/worker/package.json` dependency (line 28).** Worker uses both. Replace `"policy-pilot-common": "workspace:*"` with both, alphabetically (`@repo/chunker` before `@repo/types`):

```json
    "@repo/chunker": "workspace:*",
    "@repo/types": "workspace:*",
```

- [ ] **Step 10: Rewrite the 7 server import specifiers.** In each file below, change `from 'policy-pilot-common'` to `from '@repo/types'` (all are `import type`):
  - `apps/server/src/repositories/conversations/conversations.ts`
  - `apps/server/src/repositories/documents/documents.ts`
  - `apps/server/src/repositories/collections/collections.ts`
  - `apps/server/src/prompts/qa-system.ts`
  - `apps/server/src/prompts/qa-system.test.ts`
  - `apps/server/src/handlers/documents/documents.ts`
  - `apps/server/src/services/retrieval.service.ts`

A single sweep covers all seven:

```bash
grep -rl "from 'policy-pilot-common'" apps/server/src | xargs sed -i '' "s|from 'policy-pilot-common'|from '@repo/types'|g"
```

- [ ] **Step 11: Rewrite the worker import specifiers.**
  - `apps/worker/src/workers.ts`: `'policy-pilot-common/types'` to `'@repo/types'`
  - `apps/worker/src/processors/document-processor.ts`: `'policy-pilot-common/chunker'` to `'@repo/chunker'` AND `'policy-pilot-common/types'` to `'@repo/types'`
  - `apps/worker/src/__integration__/document-processor.integration.test.ts`: `'policy-pilot-common'` to `'@repo/types'`

```bash
grep -rl "policy-pilot-common" apps/worker/src | xargs sed -i '' \
  -e "s|'policy-pilot-common/chunker'|'@repo/chunker'|g" \
  -e "s|'policy-pilot-common/types'|'@repo/types'|g" \
  -e "s|'policy-pilot-common'|'@repo/types'|g"
```

- [ ] **Step 12: Delete the remainder of `packages/common`.**

```bash
git rm packages/common/package.json packages/common/tsconfig.json packages/common/vitest.config.ts packages/common/src/index.ts
rmdir packages/common/src/types packages/common/src/chunker packages/common/src packages/common 2>/dev/null || true
```

(The `src/types` and `src/chunker` dirs are already empty after the Task 1/2 `git mv`s; `src/index.ts` was the barrel re-exporting both, now obsolete.)

- [ ] **Step 13: Reinstall to regenerate the lockfile and workspace symlinks.**

Run: `pnpm install`
Expected: resolves `@repo/types` and `@repo/chunker` as workspace links; `pnpm-lock.yaml` updates (the two new package names replace `policy-pilot-common`).

- [ ] **Step 14: Do not commit yet.** Proceed to verification.

---

### Task 4: Verify and commit

**Files:** none modified; this task runs the regression harness and produces the single atomic commit.

- [ ] **Step 1: Confirm no stale references remain.**

Run:

```bash
grep -rn "policy-pilot-common" . \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=.git
```

Expected: zero matches. (`pnpm-lock.yaml` was regenerated in Task 3 Step 13 and no longer names the old package; the `.next/standalone` generated file is excluded.)

- [ ] **Step 2: Full build.**

Run: `pnpm build`
Expected: all five filters build in order (`@repo/types`, `@repo/chunker`, server, worker, web) with no TypeScript errors. This is the primary proof that every import resolves.

- [ ] **Step 3: Chunker unit test (the moved regression test).**

Run: `pnpm --filter @repo/chunker run test`
Expected: PASS. The `chunkText` test that lived in `packages/common` still passes from its new home.

- [ ] **Step 4: Full unit suite.**

Run: `pnpm test`
Expected: PASS. `@repo/chunker` plus server suites green.

- [ ] **Step 5: Lint and format.**

Run: `pnpm lint && pnpm format:check`
Expected: PASS. ESLint resolves both new tsconfig project paths; Prettier clean.

- [ ] **Step 6: Smoke test (pre-push gate, R-507).**

Run: `npm run smoke`
Expected: all services start and respond (`scripts/smoke-test.sh`).

- [ ] **Step 7: Commit the atomic rename.**

```bash
git branch --show-current   # must print refactor/trackA1-package-split
git add -A
git commit -m "refactor(A1): split packages/common into @repo/types and @repo/chunker

Rescope shared packages to @repo/* per R-236; update all importers, workspace
globs, root/lefthook/CI build scripts, eslint project paths, and both
Dockerfiles. No behavior change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 8: Push and open the PR.** Write the PR doc at `docs/prs/2026-06-22-trackA1-package-split.md` first (project PR Workflow), branch `refactor/trackA1-package-split`, request Copilot review. Do NOT merge without explicit per-turn authorization (R-516). After merge, monitor GitHub Actions plus Railway deploy plus health endpoints green before claiming done.

---

## Self-Review

**1. Spec coverage (spec section 6, A1):**

- "Split `packages/common` into `packages/types` (`@repo/types`) + `packages/chunker` (`@repo/chunker`)" maps to Tasks 1, 2.
- "Update every importer across all apps" maps to Task 3 Steps 8-11 (deps plus source, 11 references).
- "Update `pnpm-workspace.yaml` globs" maps to Task 3 Step 1.
- "Mechanical, broad. No logic changes." All moves are `git mv` verbatim; only specifiers/names/build refs change (Global Constraints).
- "Done when: workspace installs clean, full build passes, all imports resolve, suite green." maps to Task 4 Steps 1-6.
- Beyond the spec's enumerated targets, the grep sweep found additional build references (lefthook, CI, eslint project array, both Dockerfiles), all covered in Task 3 Steps 3-7. These are the stale-assertion surface R-515 demands be fixed in the same commit.

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every config block is shown in full. Dockerfile.worker (Step 7) references "the identical pattern" but enumerates all four substitutions explicitly and instructs reading the file first, acceptable because the file content mirrors Dockerfile.server which is shown in full.

**3. Type consistency:** Package names are consistent everywhere: `@repo/types` and `@repo/chunker`. App package names unchanged (`policy-pilot-server`, `policy-pilot-worker`, `policy-pilot-web`). The `@repo/chunker` test import (`./index.js`) is relative and unchanged. No package depends on the other.

**4. Atomicity:** Tasks 1-3 leave the build red (consumers reference the old name until Steps 10-11); this is inherent to a package rename and the reason A1 is one PR with a single commit (Task 4 Step 7), not per-task commits. Stated in Global Constraints and at each "do not commit yet" step.
