# Track A6 Sweep + Enforcement: Repair Spec

**Date:** 2026-06-23
**Status:** Spec written, pending execution
**Audit input:** `docs/audits/2026-06-23-convention-compliance.md`
**Master index:** `docs/superpowers/plans/2026-06-21-convention-refactor-index.md` (A6 row)

## Goal

Bring policy-pilot's own code to full compliance with the `~/.claude/CLAUDE.md` directory and clean-code rules, then lock that state in with ESLint enforcement and corrected docs. This is the "sweep" half of A6; the audit supplies the inventory the original A6 row lacked.

## Scope note (estimate correction)

The A6 row was scoped at ~1 to 2 hours for "enforcement + sweep." That estimate predated the code-level inventory. The actual sweep is ~36 P2 + ~22 P3 findings across four surfaces plus four P1s, so it is materially larger than the original row. This spec breaks it into 8 sequential, single-scope PRs. Per R-600, calibrated effort is several focused sessions, not one.

## Constraints (project PR Workflow + global rules)

- One PR, one scope. Branch off `main`; zero stacking; each PR merges before the next branches (sequential).
- Branch naming `refactor/<slug>` or `chore/<slug>`. Squash merge, delete branch.
- Behavior-preserving refactors: the existing suite is the safety net; full suite + build green per PR, `npm run smoke` pre-push (R-507).
- Behavior-affecting structural moves (A6.3, A6.4b): write or confirm characterization tests FIRST (R-201/R-511), then refactor, suite stays green.
- R-515: extracting a literal to a named constant must not change its value; if any test asserts the literal, keep it consistent in the same commit.
- Never merge without explicit per-turn authorization (R-516).
- Cross-cutting refactor on a dedicated track, no concurrent feature work (R-213).

## Sequencing

Mechanical and low-risk first, behavior-sensitive in the middle (guarded by tests), enforcement last so the lint rules guard an already-clean tree.

| PR    | Slug                                      | Rules                               | Risk        | Tag      |
| ----- | ----------------------------------------- | ----------------------------------- | ----------- | -------- |
| A6.1  | `refactor/a6-module-headers`              | R-230, R-218 (header position)      | low         | standard |
| A6.2  | `refactor/a6-magic-constants`             | R-219                               | low         | standard |
| A6.3  | `refactor/a6-route-handler-layering`      | R-224                               | medium      | standard |
| A6.4a | `refactor/a6-chunker-decomposition`       | R-218/R-219/R-226/R-227/R-235/R-239 | medium      | complex  |
| A6.4b | `refactor/a6-web-sse-service`             | R-226/R-227/R-234                   | medium-high | complex  |
| A6.4c | `refactor/a6-server-worker-internals`     | R-226/R-227/R-235                   | medium      | standard |
| A6.5  | `refactor/a6-collapse-middleware-folders` | R-223                               | low         | standard |
| A6.6  | `chore/a6-enforcement-and-docs`           | enforcement + CLAUDE.md             | low         | standard |

---

## PR A6.1: Module header sweep (R-230)

**Files:** the ~30 non-exempt files listed in the audit (server: 17 + 5 routes; web: components, `state/*`, pages; worker: `database/pool.ts`; chunker: `index.ts`; optionally `types/src/index.ts`).
**Change:** add a `/** */` header to each stating what the module provides AND why. For self-evident CRUD repositories the "why" can be one clause (the data access boundary it owns). Fix the `ChatAnswer.tsx:12` header position to line 1.
**Exempt (do not touch):** test files, `.d.ts`, barrels/`index.ts` re-exports, single-constant files (`constants/session.ts`, `prompts/qaSystemPrompt.ts`).
**DoD:** `grep` confirms every non-exempt source file opens with `/** */`; build + full suite green; no behavior change.

## PR A6.2: Magic-literal extraction (R-219)

**Change (values unchanged):**

- Server: `DEFAULT_TOP_K = 6` (`qa.ts`); shared `MAX_TITLE_LENGTH = 100` consumed by `qa.ts` + `generateConversationTitle.ts`; shared `MAX_UPLOAD_BYTES = 10 * 1024 * 1024` consumed by `documents.ts` handler + route; finish the `RATE_LIMITED` extraction in `rateLimiter.ts`.
- Worker: `CHUNK_MAX_TOKENS = 500`, `CHUNK_OVERLAP_TOKENS = 50` (`processDocument.ts`); optionally pool numerics.
- Web: `constants/` for `CSRF_TOKEN_PATH`, `QA_STREAM_PATH`, `DEMO_COLLECTION_PATH`, `DOCUMENT_POLL_INTERVAL_MS = 5000`, `SSE_DATA_PREFIX = 'data: '`, a document-status union/const; `QueryProvider` `staleTime`/`retry`.
- Place shared constants per R-222 (`constants.ts`/`constants/`); single-use named locals stay beside their consumer.
  **DoD:** no flagged literal remains inline; build + suite green; R-515 check on any literal-asserting test.

## PR A6.3: Route -> handler layering (R-224)

**Change:** extract `handlers/conversations/conversations.ts` from the inline bodies in `routes/conversations.ts`; move the `/demo` handler out of `routes/collections.ts` into `handlers/collections/`. Routes only wire (validate + delegate). No route reaches `repositories/*` directly afterward.
**Tests first (R-201/R-511):** confirm existing route/integration coverage for conversations + `/demo`; if thin, add handler unit tests asserting the moved behavior before extracting.
**DoD:** no `routes/*` imports `repositories/*`; handler tests + full suite + build green; ESLint `import/no-restricted-paths` (added in A6.6) would pass.

## PR A6.4a: Chunker decomposition (R-218/R-219/R-226/R-227/R-235/R-239)

**Why first among A6.4:** `@repo/chunker` is reused by apps 5 and 7; fix the debt before reuse expands.
**Change:** split `chunker/src/index.ts` into one-function modules: `chunkText.ts` (primary export), `recursiveSplit.ts`, `splitBySeparator.ts`, `estimateTokens.ts`, `hardSplitByChars.ts` (the deduplicated fallback), `constants.ts` (`CHARS_PER_TOKEN = 4`, defaults), `types.ts`. Order helpers caller-above-callee. Update the barrel. Move `index.test.ts` to `src/__tests__/chunkText.test.ts`.
**Tests:** keep the captured-fixture test (R-200); chunk output must be byte-identical before/after.
**DoD:** chunker suite green on identical output; build green; consumers (`@repo/chunker` importers in worker) unaffected.

## PR A6.4b: Web SSE streaming service (R-226/R-227/R-234)

**Change:** extract the duplicated ~130-line CSRF + fetch + SSE-decode + parse loop from `app/demo/page.tsx` and `chat/[collectionId]/page.tsx` into one `services/streamAnswer` (evaluate wiring the already-present unused `streamPost` in `api/request.ts` rather than writing new transport). Both pages call the service; components orchestrate only.
**Tests first:** confirm E2E coverage of the demo + chat streaming flows is green as the regression baseline; add a unit test for the extracted service (SSE chunk parsing, citation handling).
**DoD:** demo + chat answers stream identically; web suite + the streaming E2E green; build green.

## PR A6.4c: Server + worker internals (R-226/R-227/R-235)

**Change:**

- `handlers/qa/qa.ts`: extract `extractCitedChunkIds`, `writeSseEvent`, and the no-context branch; `streamQA` becomes an orchestrator.
- `database/pool.ts` (server AND worker): split the `Pool` singleton into its own module from `query` / `withTransaction`; each function imports the pool.
- `middleware/requireAuth/requireAuth.ts`: split `loadSession` from `requireAuth`; remove the dead `optionalAuth` no-op AFTER confirming `routes/qa.ts:3,8` does not depend on it.
  **DoD:** one exported function per file in the touched trees; suite + build green.

## PR A6.5: Collapse single-file middleware folders (R-223)

**Decision encoded:** collapse only _incidental_ single-file folders, not canonical taxonomy dirs (per `single-file-taxonomy-folder-convention`).

- **Collapse:** the six `middleware/<name>/` folders to flat `middleware/<name>.ts` (each is one concern, unlikely to grow).
- **Keep foldered:** worker `clients/`, `database/`, `processors/`, `types/` (canonical taxonomy dirs).
- **Open question for the user:** the server `handlers/<domain>/` folders also hold one file each (`auth/auth.ts`, `collections/collections.ts`, `documents/documents.ts`, `qa/qa.ts`). Recommend KEEP foldered (real domain seam, expected to grow, and A6.3 adds `conversations/`). Confirm before executing.
  **Change:** `git mv` each middleware folder's file up one level; update imports.
  **DoD:** no incidental single-file folder under `middleware/`; build + suite green; imports resolve.

## PR A6.6: Enforcement + docs (original A6 core)

**ESLint (lock the clean state):**

- Add `import/no-cycle` across all packages.
- Add `import/no-restricted-paths` contracts matching the R-224 layer flow: server `handlers -> services -> repositories -> clients/db` (no `routes -> repositories`, no upward); web `components -> hooks/state -> services/api/clients`. Verify the contracts match the post-A6.3 reality before enabling.
  **Docs (the R-230/R-236 reconciliation from the audit, section 3):**
- `policy-pilot/CLAUDE.md`: rewrite line 11 to `apps/{server,worker,client/web}` + `packages/{chunker,clients,logger,types}` (`@repo/*`); fix line 7 `packages/common/chunker/` to `@repo/chunker`.
- There is no root `README.md`; the A6 row's "fix README" item is moot (confirm no package README drift).
  **Separate change (different repo/tree, own commit):** `personal/.claude/CLAUDE.md` line 7 `Next.js 16 on Railway` -> Vercel for the frontend. Note line 19 `60% coverage minimum` is a sanctioned overridable floor (no action required; optionally raise).
  **DoD:** `eslint` passes on the clean tree and FAILS on a deliberately introduced cycle / layer-skip (prove the rule bites); `npm run smoke` green; docs match the real tree.

---

## Self-review

- **Audit coverage:** every section-2 and section-3 finding maps to a PR above. P1s land in A6.3 (server R-224), A6.4a (chunker R-239), A6.4b (web R-227 x2).
- **Zero stacking:** all eight PRs are sequential off `main`; no two touch the same file in a way that forces a rebase chain, except the `database/pool.ts` pattern (server + worker) which is confined to A6.4c.
- **Test discipline:** the two behavior-affecting PRs (A6.3, A6.4b) require characterization tests first; the rest are behavior-preserving with the existing suite as the net, and the chunker fixture test guards byte-identical output.
- **Decision points surfaced:** handlers single-file folders (A6.5) and the category-file edit being a separate-repo change (A6.6) are flagged for the user, not assumed.
