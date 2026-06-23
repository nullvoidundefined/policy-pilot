# Track A6: Compliance Sweep + Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan PR-by-PR, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every remaining directory/clean-code violation in policy-pilot's own code, then lock the clean state in with ESLint enforcement and corrected docs. This is the final A-track unit (master index row A6, "enforcement + sweep").

**Inputs:**

- Audit inventory: `docs/audits/2026-06-23-convention-compliance.md` (every finding, file:line, severity).
- Design rationale: `docs/superpowers/specs/2026-06-23-trackA6-sweep-design.md` (PR sequencing, DoD, decisions).
- Master index: `docs/superpowers/plans/2026-06-21-convention-refactor-index.md` (A6 row).

**Architecture:** Eight sequential, single-scope PRs branched off updated `main`, zero stacking (each merges before the next branches). Ordered mechanical-and-low-risk first, behavior-sensitive in the middle (guarded by characterization tests written before the refactor), enforcement last so the lint rules guard an already-clean tree. A6.1, A6.2, A6.5, A6.6 are behavior-preserving with the existing suite as the net. A6.3 and A6.4b change structure around live behavior and require characterization tests first (R-201/R-511).

**Tech Stack:** pnpm workspaces; `apps/server` (Express 5 + TS, Vitest, integration tests on real Postgres); `apps/worker` (BullMQ, Vitest); `apps/client/web` (Next.js App Router, React 19, TanStack Query, Vitest + jsdom + Testing Library, Playwright E2E); `packages/{chunker,clients,logger,types}` (`@repo/*`); ESLint flat config at `eslint.config.js` with `eslint-plugin-import`.

## Global Constraints

- No U+2014 em dash anywhere (R-001).
- One PR per unit, branched off updated `main`; zero stacking (R-213). Branch names in the sequencing table below.
- Each PR touches only its declared paths; do not fold a later PR's scope into an earlier one (R-204, one scope per PR).
- New/edited source files carry a `/** */` header (R-230); test files, `.d.ts`, barrels, single-constant files, and pure type re-exports are exempt.
- No magic strings/numbers in edited code: single-use literals become a named local `const`; values used 2+ times become a module `ALL_CAPS` const or union (R-219).
- Extracting a literal to a named constant must not change its value. After any constant extraction, grep the test suite for the old literal and update stale assertions in the same commit (R-515).
- Tests assert behavior, not mocks (R-200). Behavior-affecting PRs (A6.3, A6.4b) write characterization tests capturing current behavior FIRST, confirm green, then refactor (R-201/R-511).
- Gap-pattern #1: when a module moves or splits, grep every importer AND every `vi.mock(`/`vi.importActual(` of its OLD specifier across all tests and retarget each in the same commit (project memory `refactor-plan-gap-patterns`).
- Per-PR gates: changed-package `test` + `build` green before each task commit. Pre-push: full `pnpm test`, `pnpm build`, `pnpm run smoke` (R-507).
- Conventional commit per task; squash merge, delete branch. Never merge without explicit per-turn authorization (R-516).
- Deploy monitoring after each merge: GitHub Actions, Railway (server/worker), Vercel (web), health endpoints green (project CLAUDE.md).
- `git add` is scoped, never blind `git add -A`: the untracked `docs/agentic-conversion-plan.md` must never be committed. Every commit uses `git add -A -- ':!docs/agentic-conversion-plan.md'` (project memory `commit-hygiene-gotchas`).
- If the pre-commit `format:check` (repo-wide) trips on new markdown, `npx prettier --config prettier.config.mjs --write <file>` before committing.

## Decisions (from the design spec)

- **D1. Single-file folder collapse is selective (R-223).** Collapse only _incidental_ single-file folders, not canonical taxonomy dirs (project memory `single-file-taxonomy-folder-convention`). Collapse the six `middleware/<name>/` folders. Keep worker `clients/`, `database/`, `processors/`, `types/` foldered.
- **D2. Server `handlers/<domain>/` folders stay foldered (open, confirm before A6.5).** They hold one file each today but are a real domain seam expected to grow, and A6.3 adds `handlers/conversations/`. Recommend KEEP. Confirm with the user before executing A6.5.
- **D3. `database/pool.ts` split mirrors the A3/A5 transport carve-out inverted.** Unlike `api/request.ts` (a transport primitive that stays one module), `pool.ts` holds a stateful singleton PLUS two functions; R-235 requires the shared `Pool` state in its own module that `query` and `withTransaction` each import. Applies to both server and worker.
- **D4. Web SSE: prefer reusing the existing unused `streamPost` in `api/request.ts`** over writing new transport. The new `services/streamAnswer` orchestrates `streamPost` + SSE decode + parse; both pages call it.
- **D5. Category-file edit is a separate-repo change.** `personal/.claude/CLAUDE.md` lives in the parent `personal/` tree, not policy-pilot. Its frontend-host fix (Railway -> Vercel) is its own commit in that repo, noted in A6.6, not bundled into a policy-pilot PR.

## Sequencing

| PR    | Branch                                    | Scope                               | Risk        |
| ----- | ----------------------------------------- | ----------------------------------- | ----------- |
| A6.1  | `refactor/a6-module-headers`              | R-230 headers + header-position nit | low         |
| A6.2  | `refactor/a6-magic-constants`             | R-219 literal extraction            | low         |
| A6.3  | `refactor/a6-route-handler-layering`      | R-224 route -> handler              | medium      |
| A6.4a | `refactor/a6-chunker-decomposition`       | chunker split + test move           | medium      |
| A6.4b | `refactor/a6-web-sse-service`             | web SSE service extraction          | medium-high |
| A6.4c | `refactor/a6-server-worker-internals`     | qa/pool/requireAuth splits          | medium      |
| A6.5  | `refactor/a6-collapse-middleware-folders` | R-223 folder collapse               | low         |
| A6.6  | `chore/a6-enforcement-and-docs`           | ESLint import rules + doc fixes     | low         |

---

## PR A6.1: Module header sweep (R-230)

**Scope:** add a `/** */` header (what AND why) to every non-exempt headerless source file; fix one header-position nit. No behavior change.

**Files (from audit section 2):**

- Server (17): `config/env.ts`, `config/corsConfig.ts`, `config/queue.ts`, `errors/ApiError.ts`, `schemas/auth.ts`, `handlers/auth/auth.ts`, `handlers/collections/collections.ts`, `handlers/documents/documents.ts`, `database/pool.ts`, `app.ts`, and all 6 `middleware/*/*.ts`. Plus the 5 `routes/*.ts`.
- Web: `components/{Captain,CitationPanel,ErrorBoundary,Header}/*.tsx`, `state/AuthContext.tsx`, `state/QueryProvider.tsx`, `app/(protected)/collections/[id]/page.tsx`, and the remaining `app/**/page.tsx` + `layout.tsx`.
- Worker: `database/pool.ts`.
- Packages: `chunker/src/index.ts`; optionally `types/src/index.ts` (near-exempt, pure types).

**Exempt (do not touch):** test files, `.d.ts`, `index.ts` barrels, single-constant files (`constants/session.ts`, `prompts/qaSystemPrompt.ts`).

- [ ] **Step 1:** For each file above, add a one-line `/** ... */` header at line 1 stating what the module provides and why it exists. For self-evident CRUD repositories the "why" is the data-access boundary it owns. Keep each header to one or two sentences (R-512).
- [ ] **Step 2:** Fix `apps/client/web/src/components/ChatAnswer/ChatAnswer.tsx` so its existing header sits at line 1 (currently at line 12, between imports and interfaces).
- [ ] **Step 3:** Verify every non-exempt source file now opens with a header:

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot
# spot-check: list source files whose first line is not a comment
for f in $(git ls-files 'apps/**/src/**/*.ts' 'apps/**/src/**/*.tsx' 'packages/**/src/**/*.ts' | grep -vE '\.test\.|\.d\.ts$|/index\.ts$|__tests__|__fixtures__'); do head -1 "$f" | grep -q '^/\*\*' || echo "MISSING: $f"; done
```

Expected: only the sanctioned single-constant files (`constants/session.ts`, `prompts/qaSystemPrompt.ts`) may appear; confirm each is genuinely exempt.

- [ ] **Step 4:** Gate + commit.

```bash
pnpm build && pnpm test
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "docs(A6): add module headers across all packages (R-230)"
```

---

## PR A6.2: Magic-literal extraction (R-219)

**Scope:** extract flagged literals to named constants; values unchanged. Excludes the chunker (handled in A6.4a).

- [ ] **Step 1 (server):** `DEFAULT_TOP_K = 6` in `handlers/qa/qa.ts`; shared `MAX_TITLE_LENGTH = 100` (new `constants/` module) consumed by `handlers/qa/qa.ts` + `services/generateConversationTitle.ts`; shared `MAX_UPLOAD_BYTES = 10 * 1024 * 1024` consumed by `handlers/documents/documents.ts` + `routes/documents.ts`; finish the `RATE_LIMITED` message extraction in `middleware/rateLimiter/rateLimiter.ts`.
- [ ] **Step 2 (worker):** `CHUNK_MAX_TOKENS = 500`, `CHUNK_OVERLAP_TOKENS = 50` in `processors/processDocument.ts` (module `ALL_CAPS` or a named config object).
- [ ] **Step 3 (web):** new `constants/` entries for `CSRF_TOKEN_PATH`, `QA_STREAM_PATH`, `DEMO_COLLECTION_PATH`, `DOCUMENT_POLL_INTERVAL_MS = 5000`, `SSE_DATA_PREFIX = 'data: '`, and a document-status union/const; name the `QueryProvider` `staleTime`/`retry` values. Place shared constants per R-222; single-use named locals stay beside their consumer.
- [ ] **Step 4 (R-515):** grep tests for each old literal and update stale assertions in the same commit.

```bash
grep -rn "1024 \* 1024\|topK\|'data: '\|5000" apps/*/src/__tests__ apps/client/web/src/__tests__
```

- [ ] **Step 5:** Gate + commit (one commit; the scope is "extract magic literals").

```bash
pnpm build && pnpm test
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A6): extract magic literals to named constants (R-219)"
```

---

## PR A6.3: Route -> handler layering (R-224)

**Scope:** routes only wire; no route imports `repositories/*`. The two P1/P2 layer skips.

**Files:** create `apps/server/src/handlers/conversations/conversations.ts` (+ `__tests__/handlers/conversations/conversations.test.ts`); edit `routes/conversations.ts`, `routes/collections.ts`, `handlers/collections/collections.ts`.

- [ ] **Step 1 (tests first, R-201/R-511):** confirm existing coverage for the conversations routes and the `/demo` collections route (`__tests__/integration/collections.test.ts`, any conversations route/integration test). If a moved behavior is uncovered, write a handler unit test asserting it BEFORE extracting; confirm it passes against current inline code.
- [ ] **Step 2:** extract the inline bodies of `routes/conversations.ts:11-29` into `handlers/conversations/conversations.ts` (one handler per route operation, calling `repositories/conversations`). Route file imports the handlers and only wires verb + path + middleware.
- [ ] **Step 3:** move the `/demo` handler out of `routes/collections.ts:9-16` into `handlers/collections/collections.ts`; route wires only.
- [ ] **Step 4:** verify no route reaches a repository:

```bash
grep -rn "repositories/" apps/server/src/routes   # expect: no matches
```

- [ ] **Step 5:** gate + commit.

```bash
pnpm --filter policy-pilot-server test && pnpm --filter policy-pilot-server build
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A6): route bodies into handlers; routes only wire (R-224)"
```

---

## PR A6.4a: Chunker decomposition (R-218/R-219/R-226/R-227/R-235/R-239)

**Scope:** split the chunker god-module into one-function modules; move its test. Output must be byte-identical (reused by apps 5/7).

**Files:** in `packages/chunker/src/`, create `chunkText.ts` (primary export), `recursiveSplit.ts`, `splitBySeparator.ts`, `estimateTokens.ts`, `hardSplitByChars.ts` (the deduplicated fallback from `index.ts:54-59`/`67-72`), `constants.ts` (`CHARS_PER_TOKEN = 4`, default token/overlap), `types.ts`; update the barrel `index.ts` to re-export `chunkText` + public types; `git mv index.test.ts __tests__/chunkText.test.ts`; delete the old monolithic `index.ts` body.

- [ ] **Step 1:** extract `constants.ts` and `types.ts`; replace the four `* 4` / `/ 4` sites with `CHARS_PER_TOKEN`.
- [ ] **Step 2:** extract `estimateTokens.ts`, `splitBySeparator.ts`, `hardSplitByChars.ts` (used by both former fallback sites), `recursiveSplit.ts`, and `chunkText.ts`; order each file imports -> types -> consts -> export -> helpers; helpers caller-above-callee (R-218).
- [ ] **Step 3:** rewrite `index.ts` as a barrel re-exporting `chunkText` and the public types only.
- [ ] **Step 4 (R-239):** `git mv packages/chunker/src/index.test.ts packages/chunker/src/__tests__/chunkText.test.ts`; retarget its import to the barrel or `chunkText.ts`; remove the unused `hasOverlap` var the linter already flags (`index.test.ts:65`).
- [ ] **Step 5:** confirm byte-identical output and no stale importers.

```bash
grep -rn "@repo/chunker" apps/worker/src   # importers unaffected (barrel unchanged surface)
pnpm --filter @repo/chunker test && pnpm --filter @repo/chunker build
```

Expected: the captured-fixture test (R-200) passes on identical chunk output.

- [ ] **Step 6:** commit.

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A6): decompose chunker into one-function modules (R-235/R-227/R-239)"
```

---

## PR A6.4b: Web SSE streaming service (R-226/R-227/R-234)

**Scope:** extract the duplicated ~130-line streaming loop from the demo and chat pages into one service; components orchestrate only. Behavior-sensitive.

**Files:** create `apps/client/web/src/services/streamAnswer.ts` (+ `__tests__/services/streamAnswer.test.ts`); edit `app/demo/page.tsx`, `app/(protected)/chat/[collectionId]/page.tsx`; reuse `api/request.ts` `streamPost` (D4).

> **Authoring note (R-511):** read both page bodies and the existing `streamPost` before dispatch. Write the failing `streamAnswer` unit test (SSE chunk parsing, `data:` framing, citation extraction, done/abort) FIRST and the streaming E2E baseline must be green before extracting.

- [ ] **Step 1 (baseline):** run the demo + chat streaming E2E (`e2e/rag-pipeline.spec.ts` and any chat E2E); confirm green as the regression baseline. Record pass count.
- [ ] **Step 2:** author `services/streamAnswer.ts`: an orchestrator taking the question + collection context, calling `streamPost` (D4), decoding the SSE stream with `SSE_DATA_PREFIX` (from A6.2), parsing tokens + citations, and yielding/emitting to a callback. One exported function; helpers below it (R-218/R-235).
- [ ] **Step 3:** write `__tests__/services/streamAnswer.test.ts` asserting parse behavior against a `ReadableStream` of SSE-shaped chunks; confirm PASS.
- [ ] **Step 4:** replace the inline loop in `app/demo/page.tsx:83-224` and `chat/[collectionId]/page.tsx:86-217` with a call to `streamAnswer`; the page only manages component state. Remove the now-dead `console.info` the linter flags (`demo/page.tsx:152`).
- [ ] **Step 5:** verify identical streaming behavior.

```bash
pnpm --filter policy-pilot-web test && pnpm --filter policy-pilot-web build
# re-run the streaming E2E; answers must stream + cite identically to Step 1
```

- [ ] **Step 6:** commit.

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A6): extract shared SSE streamAnswer service (R-227/R-234)"
```

---

## PR A6.4c: Server + worker internals (R-226/R-227/R-235)

**Scope:** three one-function-per-file splits; behavior-preserving.

- [ ] **Step 1 (qa, R-227):** in `apps/server/src/handlers/qa/qa.ts` extract `extractCitedChunkIds`, `writeSseEvent`, and the no-context branch into named helpers; `streamQA` becomes an orchestrator (control flow only).
- [ ] **Step 2 (pool, R-235/D3):** in both `apps/server/src/database/pool.ts` and `apps/worker/src/database/pool.ts`, move the `Pool` singleton into its own module (`pool.ts` exports the instance only); put `query` (and server's `withTransaction`) in their own files importing the pool. Update importers (repositories). Confirm `database/` now holds 2+ files, so it stays foldered (no R-223 issue).
- [ ] **Step 3 (requireAuth, R-226):** in `apps/server/src/middleware/requireAuth/requireAuth.ts` split `loadSession` from `requireAuth`. Before removing the dead `optionalAuth` no-op, confirm nothing depends on it:

```bash
grep -rn "optionalAuth" apps/server/src   # if only the definition + a dead route import, remove both
```

Check `routes/qa.ts:3,8` specifically.

- [ ] **Step 4:** gate + commit.

```bash
pnpm --filter policy-pilot-server test && pnpm --filter policy-pilot-worker test && pnpm build
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A6): split qa helpers, pool state, and requireAuth (R-227/R-235)"
```

---

## PR A6.5: Collapse single-file middleware folders (R-223)

**Scope:** collapse only the six incidental `middleware/<name>/` folders (D1). Keep canonical taxonomy dirs foldered.

> **Blocking pre-check (D2):** confirm with the user whether the server `handlers/<domain>/` single-file folders should also collapse. Recommended: KEEP (domain seam, growing, A6.3 added `conversations/`). Do not collapse handlers unless the user agrees.

- [ ] **Step 1:** for each of `csrfGuard`, `errorHandler`, `notFoundHandler`, `rateLimiter`, `requestLogger`, `requireAuth` (note: after A6.4c, `requireAuth/` holds 2+ files and is NOT collapsed; re-check the count), `git mv` the single source file up one level to `middleware/<name>.ts` and move its test to mirror.

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot/apps/server/src
# example for one folder; repeat only for folders that still hold exactly one source file
git mv middleware/csrfGuard/csrfGuard.ts middleware/csrfGuard.ts && rmdir middleware/csrfGuard 2>/dev/null || true
```

- [ ] **Step 2 (gap-pattern #1):** update every importer of each moved file and any `vi.mock` of the old path.

```bash
grep -rn "middleware/csrfGuard/\|middleware/errorHandler/\|middleware/notFoundHandler/\|middleware/rateLimiter/\|middleware/requestLogger/" apps/server/src
```

- [ ] **Step 3:** verify no incidental single-file folder remains under `middleware/`; build + suite green.
- [ ] **Step 4:** commit.

```bash
pnpm --filter policy-pilot-server test && pnpm --filter policy-pilot-server build
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A6): collapse single-file middleware folders (R-223)"
```

---

## PR A6.6: Enforcement + docs

**Scope:** ESLint import contracts that lock the clean tree, plus the doc reconciliation from audit section 3.

- [ ] **Step 1 (ESLint, import/no-cycle):** in `eslint.config.js`, enable `import/no-cycle` across all packages.
- [ ] **Step 2 (ESLint, import/no-restricted-paths):** add contracts matching the post-A6.3 R-224 layer flow: server `handlers -> services -> repositories -> clients/database` (deny `routes -> repositories`, deny upward); web `components -> state/hooks -> services/api/clients`. Verify the contracts match reality before enabling.
- [ ] **Step 3 (prove the rule bites):** temporarily introduce a deliberate cycle and a `routes -> repositories` import; confirm `pnpm lint` FAILS; revert.
- [ ] **Step 4 (docs, R-236):** in `policy-pilot/CLAUDE.md`, rewrite line 11 to `apps/{server,worker,client/web}` + `packages/{chunker,clients,logger,types}` (`@repo/*`); change line 7 `packages/common/chunker/` to `@repo/chunker`. Confirm no root `README.md` exists (the index's "fix README" item is moot); check for package-level README drift.
- [ ] **Step 5 (separate repo, D5):** in `/Users/iangreenough/Desktop/code/personal/.claude/CLAUDE.md`, fix line 7 `Next.js 16 on Railway` to Vercel for the frontend. This is its own commit in the `personal/` tree, not part of the policy-pilot PR. Note line 19 `60% coverage minimum` is a sanctioned overridable floor (no change required).
- [ ] **Step 6:** gate + commit + smoke.

```bash
pnpm lint && pnpm build && pnpm test && pnpm run smoke
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "chore(A6): enforce import contracts and correct layout docs"
```

- [ ] **Step 7 (close the track):** update the A6 row in `docs/superpowers/plans/2026-06-21-convention-refactor-index.md` to "Shipped" once all eight PRs are merged and deployed. Refresh the session handoff.

---

## Per-PR PR-doc + merge protocol (all eight)

For each PR: write `docs/prs/YYYY-MM-DD-<branch-slug>.md` before opening (summary, what-changed, decisions chosen-vs-alternative-vs-why, testing, reflection). Push, open the PR, request Copilot review via the Reviewers panel UI (the API add is unavailable in this repo) or skip with user authorization. Do NOT merge without explicit per-turn authorization (R-516). After merge, monitor GitHub Actions + Railway/Vercel + health endpoints, then branch the next PR off the updated `main`.

## Self-Review

**Audit coverage:** every audit section-2 finding maps to a PR. R-230 -> A6.1. R-219 -> A6.2 (+ chunker in A6.4a). R-224 (both P1/P2 skips) -> A6.3. Chunker R-218/R-227/R-235/R-239 -> A6.4a. Web R-227 P1 x2 -> A6.4b. Server R-227/R-235 + both pool R-235 + requireAuth R-226 -> A6.4c. R-223 middleware -> A6.5. Section-3 CLAUDE.md reconciliation -> A6.6. P3 nits (R-218 arrow-helpers, R-231 field order, R-233 map params) are folded into the PR that already edits the file (A6.1 for headers-adjacent, A6.4b/c for the touched functions); none are deferred to `ISSUES.md` because this is a deliberate full-compliance track.

**Sequencing safety:** all eight PRs are sequential off `main`; the only file touched by two PRs is `database/pool.ts` (A6.4c splits it; A6.5 re-checks its folder count after), and `middleware/requireAuth/` (A6.4c splits it into 2 files, so A6.5 correctly skips collapsing it). Both are called out in-step.

**Test discipline:** A6.3 and A6.4b write characterization/baseline tests before refactoring (R-201/R-511); A6.4a guards byte-identical chunk output via the fixture test; the rest rely on the existing suite with per-PR build + test gates.

**Decision points surfaced, not assumed:** D2 (handlers folder collapse) is a blocking user check in A6.5; D5 (category-file edit) is flagged as a separate-repo commit.

**Gap-patterns (project memory):** #1 (moved-module importers + `vi.mock` sites) is an explicit grep step in A6.4a, A6.4c, A6.5. #2 (orphaned deps) is N/A: no module becomes a re-export except the chunker barrel, whose external surface (`@repo/chunker`) is unchanged.
