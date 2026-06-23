# A6.5: Collapse single-file middleware folders (R-223)

**Date:** 2026-06-23
**Branch:** `refactor/a6-collapse-middleware-folders`
**Rules:** R-223 (no single-file folders), R-239 (test tree mirrors source)
**Tag:** `[standard]`, pure structural move; no content change.

## Summary

Seventh PR of Track A6. Collapses the five incidental single-file middleware
folders to flat modules, per R-223. All moves are byte-identical renames (`git`
reports `R100`); only import specifiers changed. Server suite (122) stays green.

## What changed

Five `middleware/<name>/<name>.ts` folders flattened to `middleware/<name>.ts`:

- `csrfGuard/csrfGuard.ts` to `csrfGuard.ts`
- `errorHandler/errorHandler.ts` to `errorHandler.ts`
- `notFoundHandler/notFoundHandler.ts` to `notFoundHandler.ts`
- `rateLimiter/rateLimiter.ts` to `rateLimiter.ts`
- `requestLogger/requestLogger.ts` to `requestLogger.ts`

Their four test folders flattened to mirror (R-239); `requestLogger` has no test.
Import specifiers updated in `app.ts`, `routes/qa.ts`, `routes/auth.ts`, the
`requireAuth` test, and the four moved test files' self-imports.

## Decisions

- **`requireAuth/` stays foldered (chosen).** The A6 spec listed _six_ single-file middleware folders, but A6.4c (the prior PR) split `requireAuth` into three files (`loadSession`, `requireAuth`, `optionalAuth`). It is now a justified multi-file folder (R-223), so only five folders collapsed, not six.
- **`handlers/<domain>/` folders kept foldered (chosen) vs. collapsing them too.** The five handler folders (`auth`, `collections`, `conversations`, `documents`, `qa`) each hold one file, but they are a canonical domain seam expected to grow (A6.3 added `conversations/`), so per the single-file-taxonomy-folder convention they stay foldered. The R-223 collapse applies only to _incidental_ single-file folders, which the middleware ones are (one concern each, unlikely to grow).

## Testing

- Server build (`tsc`): green.
- Server unit suite: 122 passed (20 files), now at flat `__tests__/middleware/<name>.test.ts` paths.
- Lint: 0 errors (pre-existing warnings only); import ordering unaffected since the sort keys preserve sibling order.

## Reflection

The spec's "six folders" count was stale by one PR: A6.4c had just turned
`requireAuth` into a legitimate three-file folder. Inventorying the actual file
counts before moving caught that, so `requireAuth` was correctly left alone rather
than mechanically collapsed back. The `handlers/` question the spec flagged for the
user resolves cleanly under the existing taxonomy convention: incidental folders
collapse, canonical domain seams stay.
