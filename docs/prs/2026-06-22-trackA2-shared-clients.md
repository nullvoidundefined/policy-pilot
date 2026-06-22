# PR: Track A2 - extract shared @repo/clients and @repo/logger

## Summary

Track A2 of the convention refactor. The OpenAI embedding client and the Cloudflare R2 client were copied near-verbatim across `apps/server` and `apps/worker`, and the pino logger config was byte-identical in both. This PR extracts them into two shared packages: `@repo/logger` (the pino logger) and `@repo/clients` (third-party provider wrappers, one provider folder, one exported function per file per R-235). Both apps now import from the packages; their local logger modules become thin re-exports so existing import sites are untouched. No behavior change.

Time since implementation: written immediately after the implementation commit (`9d451d0`, 2026-06-22 13:20 +07); doc authored ~2 minutes later.

## What changed

**New `@repo/logger`** (`packages/logger`): single `src/index.ts` holding the pino config (pretty in dev, JSON in prod). Declares `pino`, `pino-pretty`, and `@types/node`.

**New `@repo/clients`** (`packages/clients`):

- `openai/`: `constants.ts` (`EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `BATCH_SIZE`), `generateEmbeddings.ts` (batched), `generateEmbedding.ts` (single-text convenience), barrel.
- `r2/`: `constants.ts` (`BUCKET`), `s3Client.ts` (the configured singleton), `uploadFile`/`downloadFile`/`deleteFile`/`checkConnection`/`getSignedDownloadUrl` (one file each), barrel.
- Tests ported from the server's embedding + r2 service tests, plus a new batching-loop test.

**Superset adoption**: the embedding client is the worker's batched loop plus the server's single-text convenience; the worker's `generateEmbeddingsBatch` is renamed `generateEmbeddings`. R2 is the server's full five-function set.

**Migrations**: `apps/server` (`app.ts`, `handlers/qa/qa.ts`, `handlers/documents/documents.ts`) and `apps/worker` (`processors/document-processor.ts`) import from `@repo/clients/*`. Both apps' logger modules become `export { logger } from '@repo/logger'`. Consumer test mocks (`qa.test.ts`, `documents.test.ts`, worker integration test) retargeted to the new specifiers.

**Dependency hygiene**: dropped the now-unused `@aws-sdk/*` direct deps from both apps (moved to `@repo/clients`); dropped the orphaned `pino`/`pino-pretty` direct deps from both apps (now owned by `@repo/logger` and resolved transitively); the server keeps `pino-http` (still directly imported by `requestLogger`).

**Build wiring**: `pnpm-workspace.yaml`, root `package.json` build/test scripts, `lefthook.yml`, `.github/workflows/ci.yml`, `eslint.config.js` project paths, and both Dockerfiles include the two new packages, built `@repo/logger` before `@repo/clients` (clients depends on logger).

**Deleted**: `embedding.service.ts` and `r2.service.ts` in both apps (the two server service tests were `git mv`'d into `@repo/clients`).

## Architectural decisions

- **Shared `@repo/logger` rather than letting `@repo/clients` carry its own logger or having clients accept an injected logger.** Chosen: a dedicated logger package the clients import and the apps re-export. Alternative considered: inject a logger into each client function (dependency injection). Why: the logger config was already byte-identical everywhere, so a single source of truth removes duplication with zero call-site churn; DI would have added a parameter to every client function for no current benefit (YAGNI). The apps re-export so no existing `import { logger }` site changes.
- **R-235 strict: one exported function per file, the `s3` singleton in its own file.** Alternative: group the five R2 functions in one `r2.ts` (as the original service did). Why: the locked convention-refactor decision mandates one-function-per-file for the `clients/` tree; it also makes each provider call independently testable and keeps the export surface explicit via barrels.
- **Batching lives in the client, not a service.** Alternative: keep batching in a `services/` orchestrator and have the client do a single API call. Why: batching exists to respect the OpenAI API's per-request input limit, which is a provider-API constraint, not business logic (R-222) - so it belongs in the client.
- **Single atomic commit.** The build is intentionally red between creating the packages and finishing the migration (deleting the local services breaks the apps until imports are rewired), so the change ships as one commit.

## Testing

- `pnpm build`: green across all 7 filters (types, logger, chunker, clients, server, worker, web).
- `pnpm test`: 138 unit tests pass (chunker 13, clients 9, server 116).
- New behavior test: `generateEmbeddings` with 150 texts asserts two `fetch` calls (two batches) and that the 150 results concatenate in order - covers the one piece of logic new to the shared package.
- `pnpm lint`: 0 errors (28 pre-existing warnings in unrelated files). `pnpm format:check`: clean.
- pino-pretty resolution after dropping it from the apps: dev-mode `import('@repo/logger')` boot-check printed a pretty log line and exited 0, confirming the transport resolves via `@repo/logger`.
- Stale-reference grep (`services/embedding.service`, `services/r2.service`, `generateEmbeddingsBatch`): zero matches in `apps`.

## Reflection

What I understand now: the plan's "Deleted" list only accounted for the two server _service_ tests, but three _consumer_ tests (`qa.test.ts`, `documents.test.ts`, and the worker integration test) also mocked the deleted service module specifiers. Those mocks had to be retargeted to `@repo/clients/*` (and `generateEmbeddingsBatch` renamed) in the same commit, or vitest would have silently failed to intercept the now-nonexistent modules. The plan missed this because it reasoned about _imports_ of the services, not _mocks_ of them.

What I got wrong first: the plan said "Keep `pino`" for the apps, written against the pre-re-export state. Once the logger modules became re-exports, the apps no longer imported `pino`/`pino-pretty` directly, so those direct deps were orphaned - the same class of dead dependency as the `@aws-sdk` entries the plan did drop. The final review caught the inconsistency; the fix was to drop them and verify the pino-pretty transport still resolves through `@repo/logger`.
