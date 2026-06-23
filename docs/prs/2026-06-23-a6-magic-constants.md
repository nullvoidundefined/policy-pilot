# PR: A6.2 - Magic-literal extraction (R-219)

**Branch:** `refactor/a6-magic-constants` into `main`
**Date:** 2026-06-23
**Plan:** `docs/superpowers/plans/2026-06-21-trackA6-enforcement.md` (PR A6.2)

## Summary

Second of eight Track A6 PRs. Extracts the audit-flagged magic literals into named constants, values byte-for-byte unchanged. Shared literals (used across 2+ files) move into sibling `constants/` modules; single-use literals become named module locals beside their consumer.

## What changed

**New shared constants modules:**

- `apps/server/src/constants/conversationTitle.ts` -> `MAX_TITLE_LENGTH = 100` (consumed by `handlers/qa/qa.ts` + `services/generateConversationTitle.ts`).
- `apps/server/src/constants/uploadLimits.ts` -> `MAX_UPLOAD_BYTES = 10 * 1024 * 1024` (consumed by `handlers/documents/documents.ts` + `routes/documents.ts`).
- `apps/client/web/src/constants/apiPaths.ts` -> `CSRF_TOKEN_PATH`, `QA_STREAM_PATH` (consumed by `api/request.ts`, `app/demo/page.tsx`, `app/(protected)/chat/[collectionId]/page.tsx`).
- `apps/client/web/src/constants/sse.ts` -> `SSE_DATA_PREFIX = 'data: '` (consumed by both streaming pages; also replaced the matching `.slice(6)` with `.slice(SSE_DATA_PREFIX.length)`).

**Module-local named constants (single-use):**

- Server `qa.ts`: `DEFAULT_TOP_K = 6`.
- Server `rateLimiter.ts`: `RATE_LIMITED_ERROR` (the `'RATE_LIMITED'` code, used twice) and a named `AUTH_RATE_LIMITED_MESSAGE` (previously an inline duplicate).
- Worker `processDocument.ts`: `CHUNK_MAX_TOKENS = 500`, `CHUNK_OVERLAP_TOKENS = 50`.
- Web `demo/page.tsx`: `DEMO_COLLECTIONS_PATH`.
- Web `collections/[id]/page.tsx`: `DOCUMENT_POLL_INTERVAL_MS = 5000`, `PROCESSING_STATUSES`, `STATUS_FAILED`, `STATUS_READY`, `STATUS_REJECTED`.
- Web `QueryProvider.tsx`: `DEFAULT_STALE_TIME_MS = 30_000`, `DEFAULT_QUERY_RETRY = 1`.

## Architectural decisions (chosen / alternative / why)

- **CSRF path is shared, not local.** The plan listed `CSRF_TOKEN_PATH` under "new constants entries"; on grep it appears in three files, so it belongs in `apiPaths.ts` rather than a local const. Same reasoning promoted `QA_STREAM_PATH` and `SSE_DATA_PREFIX` to shared modules.
- **Two web constants files split by responsibility.** `apiPaths.ts` (backend route paths) and `sse.ts` (SSE wire prefix) rather than one grab-bag, per R-226. `sse.ts` is a single-constant file (R-230 header-exempt); `apiPaths.ts` has two and carries a header.
- **Document-status drift preserved, not fixed.** The web page checks `PROCESSING_STATUSES = ['pending', 'chunking', 'embedding']`, but the DB default status is `'uploaded'` and `'pending'` is not in the `DocumentStatus` union. Extraction must be value-neutral (R-219), so the literals were preserved exactly; the latent bug is recorded in `ISSUES.md` for a separate test-first fix (R-201).
- **Out-of-scope literals left alone.** Server-side SSE `data:` writes in `streamQA` and oversized functions belong to A6.4c/A6.4b; `formatSize`'s `1024` was not on the audit list and its lines were not edited, so it stays.

## Testing

- `pnpm build` green (all workspaces; Next.js compiled every route).
- `pnpm test` green across all packages (chunker 13, worker 9, server 116, logger 8, web 137).
- R-515: grepped every test suite for each old literal. No assertion is stale because no value changed - the URL mocks (`url.includes('/qa')`), the `'data: '` SSE framing, `slice(0, 100)`, the rate-limit message object, and the status fixtures all still match the extracted constants exactly. Test-file literals are R-219-exempt and were left in place.
- No U+2014 em dash introduced (R-001).

## Reflection

The grep-before-extract step earned its keep twice: it reclassified `CSRF_TOKEN_PATH` from local to shared, and it surfaced the `'uploaded'` vs `'pending'` status drift that would have been invisible from the page alone. The discipline that mattered was resisting the urge to "fix" that drift inside a value-neutral extraction PR; it is a behavior change and goes through its own test-first path.
