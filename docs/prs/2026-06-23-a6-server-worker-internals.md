# A6.4c: Server + worker internals one-function split

**Date:** 2026-06-23
**Branch:** `refactor/a6-server-worker-internals`
**Rules:** R-226 (one responsibility), R-227 (orchestrator vs atomic), R-235 (one exported function per file)
**Tag:** `[standard]`, behavior-preserving refactor with the existing suite as the net.

## Summary

Sixth PR of Track A6. Splits three multi-function modules in the server and worker
so each file owns a single concern, and turns the Q&A SSE handler into a clean
orchestrator. No behavior change: the existing server (122) and worker (8) unit
suites are the regression net and stay green.

## What changed

### 1. `handlers/qa/qa.ts` to orchestrator + private helpers (R-227)

`streamQA` mixed SSE-string formatting and citation-regex logic into the request
flow. Extracted three unexported helpers (colocated per R-227, since each serves
only `streamQA`):

- `writeSseEvent(res, payload)`: the single `data: ${JSON.stringify(...)}\n\n` writer, replacing six inline copies.
- `extractCitedChunkIds(text, chunks)`: the `[n]` citation-index extraction.
- `respondWithNoContext(res, conversationId)`: the no-relevant-chunks branch.

`NO_CONTEXT_MESSAGE` promoted to a module constant. `streamQA` is now a pure
orchestrator (sequence of calls plus control flow, no inline business logic). SSE
byte output is identical, guarded by the existing `qa.test.ts` which asserts on
the written stream.

### 2. `database/pool.ts` to pool singleton / `query` / `withTransaction` (R-235)

The connection pool is shared module-level state; per R-235 it moves to its own
module that the function helpers import.

- **Server:** `pool.ts` (singleton + `PoolClient` type), `query.ts`, `withTransaction.ts`. ~28 repository/service importers retargeted from `pool.js` to `query.js`/`withTransaction.js`; `PoolClient` type imports and the default-pool import (`app.ts`, integration tests) stay on `pool.js`.
- **Worker:** `pool.ts` (singleton) plus `query.ts`; the two repository importers retargeted.

Four unit-test mocks (`auth`, `conversations`, `documents` repos; `searchChunks`
service) retargeted from `vi.mock('app/database/pool.js')` to the new
`query.js` / `withTransaction.js` module specifiers. Without this the mocks would
no longer intercept the real `query` import.

### 3. `middleware/requireAuth/` to one middleware per file (R-235)

`requireAuth.ts` held three exported middlewares. Split into `loadSession.ts`,
`requireAuth.ts`, `optionalAuth.ts`. Importers retargeted (`app.ts`, `routes/qa.ts`,
the middleware test).

## Architectural decisions

- **Kept `optionalAuth` rather than deleting it (chosen) vs. removing the no-op (alternative).** The A6 spec proposed removing the "dead" `optionalAuth` _after confirming `routes/qa.ts` does not depend on it_. It **does**: `routes/qa.ts` imports it and wires it into the `/qa` chain as a semantic "auth optional here" marker. The removal precondition therefore failed, so it stays, now in its own one-function file (R-235 satisfied either way). Deleting it would have been behavior-preserving (it is a literal `next()` pass-through), but silently altering a route middleware chain on a failed precondition is the wrong call; a deliberate follow-up can remove it if desired.
- **qa helpers colocated, not new files (chosen) vs. extracting to `services/`.** R-235's one-function-per-file scopes to `services/`/`api/`/`clients/`; handlers are exempt, and R-227 explicitly preserves orchestrator-plus-private-helper colocation. The three helpers serve only `streamQA`, so they stay unexported in the same file.
- **`PoolClient` stays in `pool.ts` (chosen).** It is the pool's type, not behavior; co-locating it with the singleton keeps the type import stable for the three repos that use it.

## Testing

- Server build (`tsc`) plus worker build: green.
- Server unit suite: 122 passed (20 files). Worker unit suite: 8 passed.
- Lint: 0 errors (pre-existing `no-unsafe-assignment` warnings only; the `loadSession.ts` `req.user` warning is relocated from the old `requireAuth.ts`, not new).
- Integration suites excluded from the per-package gate (R-239); the pool default-import path is unchanged, so integration wiring is untouched.

## Reflection

The real risk was not the splits themselves but the **`vi.mock` retargets**: four
tests mocked `pool.js` for `query`/`withTransaction`, and moving those functions
out would have silently de-mocked the real DB call (matching the documented
refactor-plan-gap pattern). Grepping every `vi.mock('app/database/pool.js')` site
_before_ writing caught all four. The spec's `optionalAuth` removal step is the
one place reality diverged from the plan: the guard it carried did its job and
told me not to remove it.
