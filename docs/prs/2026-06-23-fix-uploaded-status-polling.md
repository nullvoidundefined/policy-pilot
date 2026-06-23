# fix: poll freshly-uploaded documents on the collection detail page

**Date:** 2026-06-23
**Branch:** `fix/uploaded-status-polling`
**Rules:** R-201 (bug fix test-first), R-220/R-235 (logic in a one-function service)
**Tag:** `[standard]`

## Summary

Fixes a P2 frontend bug: a freshly uploaded document (status `'uploaded'`) did
not trigger the collection document-list polling, so the UI could stall on the
just-uploaded state until the worker flipped it to `'chunking'`.

## Root cause

`apps/client/web/src/app/(protected)/collections/[id]/page.tsx` gated its
`refetchInterval` on `PROCESSING_STATUSES = ['pending', 'chunking', 'embedding']`.
But `'pending'` is not a member of the `@repo/types` `DocumentStatus` union
(`uploaded | chunking | embedding | ready | failed | rejected`), and the DB
default for `documents.status` is `'uploaded'` (migration `1711900000002`). The
non-terminal "still processing" set was therefore wrong: it listed a status that
never occurs and omitted the one a new upload actually has.

## Fix (test-first, R-201)

1. Extracted the polling predicate into `services/shouldPollDocuments.ts` (a single exported function, R-235), with `PROCESSING_DOCUMENT_STATUSES` as a named constant.
2. Wrote `__tests__/services/shouldPollDocuments.test.ts` asserting an `'uploaded'` document triggers polling; confirmed it FAILED against the original `'pending'` list (1 failed / 3 passed).
3. Corrected the set to `['uploaded', 'chunking', 'embedding']` (the three non-terminal `DocumentStatus` values; `'embedding'` is set by the worker, terminal states `ready`/`failed`/`rejected` stop polling). Test went GREEN (4/4).
4. The page now imports `shouldPollDocuments` and uses it in `refetchInterval`, dropping the inline buggy constant.

## Testing

- `shouldPollDocuments` suite: 4 passed (RED confirmed before the fix).
- Full web suite: 148 passed (22 files); web `tsc --noEmit` clean.

## Reflection

The literal was preserved as-is during Track A6.2 (a value-neutral extraction),
which correctly declined to change behavior in a refactor PR and logged the bug
to `ISSUES.md` instead. Pulling the predicate into a service made the bug
unit-testable rather than buried in a TanStack Query `refetchInterval` closure,
and `app -> services` keeps the new R-224 layer contract satisfied.
