# Convention-Compliance Audit: policy-pilot

**Date:** 2026-06-23
**Role:** Engineering (convention compliance only; not a full CTO sweep)
**Scope:** policy-pilot's own code (`apps/server`, `apps/worker`, `apps/client/web`, `packages/{chunker,clients,logger,types}`) plus the local `CLAUDE.md` files.
**Rule source:** `~/.claude/CLAUDE.md` (R-001 through R-241).
**Method:** Four read-only audit subagents, one per surface, against the full rule checklist; findings consolidated here. No code modified.

> **Relationship to Track A:** The prior compliance audit (`2026-06-21-rules-reconciliation.md`) covered the _reference_ repos (Doppelscript, Voyager), never policy-pilot's own code. This audit is the missing code-level inventory that the pending **A6 (enforcement + sweep)** track needs. Repair plan: `docs/superpowers/specs/2026-06-23-trackA6-sweep-design.md`.

---

## 1. Headline

The codebase is **structurally sound**. Taxonomy (R-220/R-238/R-240), dependency direction (R-224), package scoping (R-225/R-236), em-dash (R-001), and IIFE (R-215) rules are almost entirely clean. `@repo/clients` is exemplary: one function per file, factory/singleton/lifecycle correctly split, headers everywhere. It is the template for the rest.

Findings cluster in five repairable areas:

1. **Missing R-230 module headers:** ~30 non-exempt source files (largest single category).
2. **Magic literals (R-219):** pipeline tuning constants, route paths, intervals, the SSE `'data: '` prefix.
3. **Oversized / mixed functions (R-226/R-227):** duplicated SSE streaming in the web client, `streamQA`, the chunker core.
4. **Layer skips (R-224):** two route files call repositories directly instead of delegating to handlers.
5. **Structural nits (R-223/R-235/R-239):** single-file middleware folders, `api/request.ts` multi-export, a co-located chunker test.

**Severity totals:** P0: 0 · P1: 4 · P2: ~36 · P3: ~22.

---

## 2. Findings by surface

### 2.1 `apps/server` (61 src files)

| Rule        | Sev    | Location                                                                                                                                                                                                                                                         | Problem                                                                                                                                                           |
| ----------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-224       | **P1** | `routes/conversations.ts:11-29`                                                                                                                                                                                                                                  | Route contains inline handler bodies (repo calls, validation, 404) and reaches `repositories/conversations` directly, skipping the handlers layer.                |
| R-224       | P2     | `routes/collections.ts:9-16`                                                                                                                                                                                                                                     | `/demo` route handler inline, calls `repositories/collections` directly.                                                                                          |
| R-230       | P2     | `config/env.ts`, `config/corsConfig.ts`, `config/queue.ts`, `errors/ApiError.ts`, `schemas/auth.ts`, `handlers/auth/auth.ts`, `handlers/collections/collections.ts`, `handlers/documents/documents.ts`, `database/pool.ts`, `app.ts`, all 6 `middleware/*` files | No `/** */` header (17 files).                                                                                                                                    |
| R-230       | P3     | all `routes/*.ts` (5)                                                                                                                                                                                                                                            | No header on route modules.                                                                                                                                       |
| R-230       | P3     | every `repositories/*` + `services/*` + `prompts/buildContextPrompt.ts`                                                                                                                                                                                          | Header states "what" but not "why" (R-230 requires both). Defensible for self-evident CRUD; flagged for completeness.                                             |
| R-226       | P2     | `middleware/requireAuth/requireAuth.ts:6,26,38`                                                                                                                                                                                                                  | Three concerns: `loadSession`, `requireAuth`, `optionalAuth` (the last is a dead no-op).                                                                          |
| R-226/R-235 | P2     | `database/pool.ts:8,28,46`                                                                                                                                                                                                                                       | Pool singleton + `query` + `withTransaction` in one file; shared state should be its own module.                                                                  |
| R-227       | P2     | `handlers/qa/qa.ts:17-193`                                                                                                                                                                                                                                       | `streamQA` (~175 lines) mixes orchestration with inline SSE assembly, citation-regex extraction, no-context branch, error serialization.                          |
| R-219       | P2     | `handlers/qa/qa.ts:94`                                                                                                                                                                                                                                           | `topK = 6` inline.                                                                                                                                                |
| R-219       | P2     | `handlers/qa/qa.ts:54,105` + `services/generateConversationTitle.ts:26,29`                                                                                                                                                                                       | Title-length `100` duplicated cross-file.                                                                                                                         |
| R-219       | P2     | `handlers/documents/documents.ts:39,44` + `routes/documents.ts:8`                                                                                                                                                                                                | `10 * 1024 * 1024` (10 MB upload cap) duplicated.                                                                                                                 |
| R-219       | P3     | `middleware/rateLimiter/rateLimiter.ts:21-24`                                                                                                                                                                                                                    | `'RATE_LIMITED'` partly extracted, re-inlined for the message.                                                                                                    |
| R-223       | P2     | `middleware/{requireAuth,csrfGuard,errorHandler,notFoundHandler,rateLimiter,requestLogger}/`                                                                                                                                                                     | Six single-source-file folders. _Incidental_ sub-groupings (not canonical taxonomy dirs), so collapse to flat files per `single-file-taxonomy-folder-convention`. |
| R-218       | P3     | `app.ts:36-38`, `errors/ApiError.ts:2-4`                                                                                                                                                                                                                         | Constant placement / non-alphabetized class fields (semantically free).                                                                                           |
| R-231       | P3     | `errors/ApiError.ts:2-4`                                                                                                                                                                                                                                         | Instance fields `statusCode, code, details` not alphabetized.                                                                                                     |
| R-233       | P3     | `handlers/collections/collections.ts:36`                                                                                                                                                                                                                         | Single-letter `c` map param.                                                                                                                                      |

Clean: R-217/R-232, R-228, R-238, R-220, R-222, R-229/R-237, R-241, R-239, R-225/R-236, R-001, R-215, R-214 (n/a).

### 2.2 `apps/worker` (13 src files)

| Rule        | Sev | Location                           | Problem                                                                                 |
| ----------- | --- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| R-219       | P2  | `processors/processDocument.ts:58` | `{ maxTokens: 500, overlapTokens: 50 }` inline, the prime pipeline tuning knobs.        |
| R-235/R-226 | P2  | `database/pool.ts:25,41`           | Exports `query` + default `pool`; split state from function (same pattern as server).   |
| R-230       | P3  | `database/pool.ts:1`               | Only file missing a header (other 9 compliant).                                         |
| R-218       | P3  | `database/pool.ts:1-23`            | Config logic in const initializer before primary export; resolves with the R-235 split. |
| R-219       | P3  | `database/pool.ts:8-10`            | Connection numerics (`max: 5`, timeouts) inline on SDK options literal (soft).          |

Clean (with carve-out): R-223 single-file folders `clients/`, `database/`, `processors/`, `types/` are **canonical taxonomy dirs**, so keep foldered per `single-file-taxonomy-folder-convention` (NOT violations). Everything else complies: R-217/R-232, R-226, R-228, R-227, R-233, R-238, R-220, R-222, R-229/R-237, R-241, R-239, R-224, R-225/R-236, R-001, R-215, R-231.

### 2.3 `apps/client/web` (14 src modules)

| Rule        | Sev    | Location                                                                                                                                         | Problem                                                                                                                                              |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-227       | **P1** | `app/demo/page.tsx:83-224`                                                                                                                       | `sendQuestion` (~140 lines): CSRF fetch + raw fetch + SSE decode loop + JSON parse + state transforms inline.                                        |
| R-227       | **P1** | `app/(protected)/chat/[collectionId]/page.tsx:86-217`                                                                                            | `handleSubmit` (~130 lines): near-identical streaming logic, duplicated from demo page. (`streamPost` already exists in `request.ts` and is unused.) |
| R-235/R-226 | P2     | `api/request.ts:10,61,65,72,76,108,152`                                                                                                          | One module exports 7+ symbols (`ensureCsrfToken`, `get`, `post`, `del`, `uploadFile`, `streamPost`, `API_BASE`), four concerns.                      |
| R-219       | P2     | `app/demo/page.tsx:69,97,104` + `chat/[collectionId]/page.tsx:101,106`                                                                           | Route paths `/collections/demo`, `/api/csrf-token`, `/qa` hardcoded; last two duplicated.                                                            |
| R-219       | P2     | `collections/[id]/page.tsx:57`                                                                                                                   | Poll interval `5000`.                                                                                                                                |
| R-219       | P2     | `collections/[id]/page.tsx:54,128,141`                                                                                                           | Status strings inline + repeated across switch helpers.                                                                                              |
| R-219       | P2     | `demo/page.tsx:141,191` + chat page                                                                                                              | SSE prefix `'data: '` and `.slice(6)` duplicated.                                                                                                    |
| R-219       | P3     | `state/QueryProvider.tsx:14`                                                                                                                     | `staleTime: 30_000`, `retry: 1`.                                                                                                                     |
| R-230       | P2     | `components/{Captain,CitationPanel,ErrorBoundary,Header}/*.tsx`, `state/AuthContext.tsx`, `state/QueryProvider.tsx`, `collections/[id]/page.tsx` | No header (components not exempt).                                                                                                                   |
| R-230       | P3     | remaining `app/**/page.tsx` + `layout.tsx` (~10)                                                                                                 | No header.                                                                                                                                           |
| R-218       | P3     | `collections/[id]/page.tsx:128-158`, `dashboard/page.tsx:90`                                                                                     | In-component helpers (`getStatusLabel`, `getStatusClass`, `formatSize`, `formatDate`) are arrow-assigned consts, not `function` declarations.        |
| R-218       | P3     | `components/ChatAnswer/ChatAnswer.tsx:12`                                                                                                        | Header sits between imports and interfaces, not line 1.                                                                                              |
| R-233       | P3     | demo/chat/dashboard/collections pages                                                                                                            | Abbreviated map params (`msg`, `i`, `col`, `doc`); generic `data`/`body` in `request.ts`.                                                            |

Clean: R-217/R-232, R-228, R-240/R-220/R-237, R-223, R-241, R-224, R-225/R-236, R-231, R-001 (em dashes are escapes / `&mdash;` entities, not raw codepoints), R-215.

### 2.4 `packages/*`

Inventory: `@repo/chunker` (1 module), `@repo/clients` (openai 3 + r2 7), `@repo/logger` (1), `@repo/types` (1, pure types).

| Rule        | Sev    | Location                            | Problem                                                                                                     |
| ----------- | ------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R-239       | **P1** | `chunker/src/index.test.ts`         | Test co-located beside source; must move to `src/__tests__/`. (`@repo/clients` does this correctly.)        |
| R-227       | P2     | `chunker/src/index.ts:30-73`        | `recursiveSplit` (~44 lines) mixes steps; hard-split fallback duplicated (54-59, 67-72).                    |
| R-227       | P2     | `chunker/src/index.ts:75-119`       | `chunkText` (~44 lines) mixes orchestration + inline merge/overlap; chunk-push duplicated (94-98, 111-115). |
| R-218       | P2     | `chunker/src/index.ts:13-119`       | Helpers declared before primary export `chunkText`.                                                         |
| R-219       | P2     | `chunker/src/index.ts:19,55,67,101` | "4 chars per token" ratio repeated 4 times; extract `CHARS_PER_TOKEN`.                                      |
| R-226/R-235 | P2     | `chunker/src/index.ts`              | One file holds 4 functions + 2 types + 3 constants; decompose into named modules.                           |
| R-230       | P2     | `chunker/src/index.ts:1`            | No header.                                                                                                  |
| R-230       | P3     | `types/src/index.ts:1`              | No header (near-exempt: pure type declarations).                                                            |

Clean & exemplary: `@repo/clients` (all rules), `@repo/logger`, R-236, R-225, R-220/R-238, R-229/R-237, R-001, R-215, R-228, R-231.

---

## 3. CLAUDE.md reconciliation (local vs global)

Global rule: _"Project-level CLAUDE.md adds guidance but does not override these unless it explicitly says so."_

| File                         | Line | Finding                                                                                                                | Action                                                                                                |
| ---------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `policy-pilot/CLAUDE.md`     | 11   | `Monorepo: packages/api, packages/worker, packages/web, packages/common`. **False**; conflicts with reality and R-236. | Rewrite to `apps/{server,worker,client/web}` + `packages/{chunker,clients,logger,types}` (`@repo/*`). |
| `policy-pilot/CLAUDE.md`     | 7    | `packages/common/chunker/`. Stale path.                                                                                | Change to `@repo/chunker` (`packages/chunker`).                                                       |
| `personal/.claude/CLAUDE.md` | 7    | `Frontend: Next.js 16 on Railway`. Web deploys on **Vercel** (handoff + project file).                                 | Correct host to Vercel (or make per-project).                                                         |
| `personal/.claude/CLAUDE.md` | 19   | `60% coverage minimum`. Stale floor; actual web gate is 90/80/85/90.                                                   | Not a violation (line 16 marks defaults overridable); optionally raise the floor.                     |
| `personal/.claude/CLAUDE.md` | 10   | `Auth: ... (project CLAUDE.md overrides)`.                                                                             | **No action.** Explicitly-sanctioned override per the global carve-out.                               |

No other hard rule-conflicts: the category file's Naming/PR sections defer to or mirror global (R-217/R-232/R-233, R-516, R-212, R-108).

---

## 4. Highest-leverage fixes (cross-surface)

1. **R-230 header sweep** (~30 files, mechanical): single largest count; clears in one pass.
2. **Extract a shared SSE-streaming service** for the web client (web P1 x2): kills the ~130-line duplication across demo + chat pages; consider the already-present unused `streamPost`.
3. **Decompose `chunker/src/index.ts`:** one pass clears R-218, R-219, R-227, R-226, and the R-235 smell; debt propagates to apps 5/7 that reuse it, so fix before reuse expands.
4. **Fix the two R-224 layer skips:** extract `handlers/conversations/`, move the `/demo` collection handler out of `routes/collections.ts`.
5. **Extract magic literals (R-219)** repo-wide: pipeline tuning (`500`/`50`, `CHARS_PER_TOKEN=4`), upload cap, route paths, poll interval, SSE prefix.

P0/P1 are current-effort; P2/P3 are tracked in the repair spec. This is a deliberate cleanup track, so the spec covers all severities rather than deferring P2/P3 to `ISSUES.md`.
