# PR: Track A4 - Worker Internals Convention Refactor

**Branch:** `refactor/trackA4-worker-internals` off `main` (`e6aba95`)
**Plan:** `docs/superpowers/plans/2026-06-21-trackA4-worker-internals.md`
**Scope:** `apps/worker/**` plus two root one-liners (CI test wiring, prettierignore)

## Summary

Brings `apps/worker` into directory/clean-code convention compliance with zero behavior change, mirroring the A3 server refactor. The monolithic `processors/document-processor.ts` is decomposed into an orchestrator that sequences atomic services and repositories; inline SQL moves to a repository layer; `db/`, `utils/`, the `.service` suffix, the root-level `workers.ts`, and the banned `__integration__/` test dir are all eliminated. Seven tasks, each independently green under the existing `processDocument` integration test as the characterization harness.

## What changed

- **`db/` -> `database/`** (collapsed `pool.ts`); `pool.ts` logger import now `@repo/logger` directly.
- **`utils/` eliminated**: `utils/logger.ts` re-export deleted; every consumer imports `@repo/logger`.
- **`text-extractor.service.ts` -> `services/extractText.ts`** (verb-noun, `.service` suffix dropped; private extract helpers retained per R-235).
- **Relevance check extracted** to `services/checkDocumentRelevance.ts`, consuming a new `clients/anthropic.ts` SDK singleton (the only `new Anthropic()` site; R-222/R-224). Fail-open semantics preserved exactly.
- **Inline SQL -> flat repositories**: `repositories/documents.ts` (`updateDocumentStatus`) and `repositories/chunks.ts` (`insertChunk`).
- **`processors/processDocument.ts`**: renamed verb-noun; now a pure orchestrator (no SQL, no JSON parse, no SDK construction); `NO_TEXT_ERROR` extracted (R-219).
- **`workers.ts` -> `workers/` tree**: `redisConnection.ts` (shared singleton), `documentProcessWorker.ts` (Worker factory + handlers), `startHealthServer.ts`, `startWorker.ts` (orchestrator + graceful shutdown). `index.ts` keeps the dynamic-import dotenv ordering guard.
- **Tests relocated** to the `src/__tests__/` mirror; integration to `src/__tests__/integration/`; fixture to `src/__fixtures__/` (R-239). New unit suite for the worker (extractText 4 + checkDocumentRelevance 4) with a `vitest.config.ts`, wired into the root `test` aggregate so CI runs it.
- **`.prettierignore`**: `.superpowers/` added (next to `.claude/`) so the repo-wide format gate stops checking agent scratch.

## Architectural decisions (chosen vs alternative vs why)

- **D1 - single-file taxonomy folders kept** (`clients/`, `database/`, `processors/`). Chosen: keep them foldered even at one file, mirroring merged A3. Alternative: collapse per a strict R-223 reading. Why: these are the fixed top-level vocabulary, not incidental groupings; re-nest peers when a second module joins. User-approved.
- **D2 - `repositories/` stays flat** (`documents.ts`, `chunks.ts`, one fn each, no subfolders, no barrels). Alternative: server-style `repositories/documents/<fn>.ts` + `index.ts`. Why: the worker has exactly one query per domain, so subfolders would be single-file folders (R-223) plus a redundant barrel. Server nests because it has 2+ per domain. User-approved.
- **D3 - Anthropic stays app-local** (`clients/anthropic.ts`), not promoted to `@repo/clients`. Why: A2 shared only the genuinely-duplicated `r2`/`openai`; promoting Anthropic would touch `packages/clients` + `apps/server`, breaking the single-scope / path-disjoint rule. Noted as possible future consolidation.
- **D4 - `@repo/clients` already consumed** (A2 landed it). The spec's "consume @repo/clients" A4 item required no work; verified by grep.
- **Logger type deviation**: the service's `log` param is typed `typeof logger` from `@repo/logger`, not `import type { Logger } from 'pino'` as the plan example showed, because `pino` is not a direct worker dependency. Adding it solely for a type import would be wrong; `@repo/logger` already resolves the pino type.

## Testing

- Whole-repo `pnpm build` green.
- `pnpm test`: 146 unit (server 116, chunker 13, clients 9, worker 8). The worker's 8 are net-new and now run in CI.
- `pnpm test:integration`: worker `processDocument` 5/5 against live Neon DB (relevance service exercised end-to-end through the ready/failed/rejected paths), server integration green.
- Worker lint: 0 errors. Compliance greps clean (no `db/`/`utils/`/`.service`/`document-processor`/`__integration__`; `new Anthropic(` only in the client; no inline SQL in the processor). Em-dash sweep clean (R-001).
- Process: per-task spec + quality review (all Approved), then a final whole-branch review (Opus, vs `e6aba95`): "Ready to merge: Yes", no Critical/Important. Behavior preservation verified airtight (status transitions, error strings, SQL, fail-open semantics, dotenv ordering, singleton identity).

## Reflection

What I understand now that I did not at the start: the spec listed "consume @repo/clients" under A4, but A2 had already done it, so a literal reading would have wasted a task; the pre-flight grep caught that. The single-file-folder tension (D1/D2) is the real judgment call this track surfaced that A3 did not, because the worker is small enough that several taxonomy dirs hold exactly one module. What I got right first: treating the existing integration test as a characterization harness meant every one of the seven decompositions landed under a green pipeline, so "zero behavior change" was continuously enforced rather than asserted at the end. What I would flag for the next worker change: `repositories/documents.ts` and `repositories/chunks.ts` must re-nest into folders the moment a second query joins each domain.

## Merge

CI must pass (lint-and-test + GitGuardian); request Copilot review (historically not API-addable in this repo, add via the Reviewers panel if needed). Do not merge without explicit per-turn user authorization (R-516). After squash-merge to `main`: verify code on main, then monitor GitHub Actions + Railway (worker) + health endpoints.
