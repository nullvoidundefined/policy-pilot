# PR: A6.4a - Chunker decomposition (R-218/R-219/R-226/R-227/R-235/R-239)

**Branch:** `refactor/a6-chunker-decomposition` into `main`
**Date:** 2026-06-23
**Plan:** `docs/superpowers/plans/2026-06-21-trackA6-enforcement.md` (PR A6.4a)

## Summary

Fourth of eight Track A6 PRs. `@repo/chunker` was a single 125-line `index.ts` holding
the public types, four module constants, three private helpers, and the exported
`chunkText` orchestrator, with the hard-split fallback duplicated across two sites and
four bare `* 4` / `/ 4` magic numbers (R-226/R-227/R-235/R-219). This PR splits it into
one-function modules behind an unchanged barrel and moves the test into `__tests__/`
(R-239). The package is reused by apps 5 and 7, so output must be byte-identical; a golden
snapshot test captured from the pre-split monolith proves it.

## What changed

**New one-function / single-concern modules in `packages/chunker/src/`:**

- `constants.ts` - `CHARS_PER_TOKEN`, `DEFAULT_MAX_TOKENS`, `DEFAULT_OVERLAP_TOKENS`, `DEFAULT_SEPARATORS`.
- `types.ts` - `ChunkOptions`, `TextChunk`.
- `estimateTokens.ts` - the `~ceil(len / CHARS_PER_TOKEN)` heuristic (shared helper; called by both `chunkText` and `recursiveSplit`, so its own module per R-235).
- `splitBySeparator.ts` - per-level split with separator re-attachment.
- `hardSplitByChars.ts` - the deduplicated fixed-width fallback (was inlined twice in `recursiveSplit`).
- `recursiveSplit.ts` - separator-hierarchy recursion; now calls `hardSplitByChars` at both former fallback sites.
- `chunkText.ts` - the primary export: split -> merge -> overlap orchestration.

**Barrel + test:**

- `index.ts` reduced to `export { chunkText }` + `export type { ChunkOptions, TextChunk }`. External surface (`@repo/chunker`) unchanged.
- `git mv src/index.test.ts src/__tests__/chunkText.test.ts`; import retargeted to `../index.js`; removed the lint-flagged unused `hasOverlap` local.

**New golden test (written first, against the monolith):**

- `src/__tests__/chunkText.golden.test.ts` - 6 cases / 7 inline snapshots pinning exact `{ content, index, tokenCount }` output across the merge/overlap loop, custom separators, both hard-split fallback sites, and the empty/whitespace cases.

## Architectural decisions (chosen / alternative / why)

- **Golden snapshot as the byte-identical guard, not the existing suite.** The 13 existing tests assert loose shapes (`toBeGreaterThan`, length bounds) and would not catch a one-character drift in the dedup. I captured inline snapshots from the pre-split code, confirmed GREEN, then refactored; they passing unchanged is the proof of identity. Alternative (rely on the existing suite) was rejected because "byte-identical for a module two other apps embed" needs an exact-output net.
- **`hardSplitByChars` deduplicates both fallback sites.** The two inlined `maxChars`/slice loops were identical logic on `part` vs `text`. One function called from both sites is byte-identical and kills the duplication (R-226). Renamed the local accumulator `result` -> `segments` (R-233) - no output effect.
- **Barrel surface frozen.** `chunkText` + the two types are all that any importer uses (`apps/worker`: `chunkText`, `TextChunk`). Re-exporting exactly those keeps `@repo/chunker` a drop-in; no deep imports past the barrel exist (grep clean).
- **`estimateTokens` is a standalone module, not a `chunkText` private helper.** Two public-path callers (`chunkText` and `recursiveSplit`) share it, so R-235 puts it in its own file rather than colocating.

## Testing

- `pnpm --filter @repo/chunker test`: 19 passing (13 existing + 6 golden). Golden snapshots captured on the monolith, then passed unchanged post-split -> output byte-identical.
- `pnpm --filter @repo/chunker build`: green (`tsc`).
- `pnpm --filter @repo/chunker lint`: 0 errors (the prior unused-var warning at the old `index.test.ts:65` is gone).
- Importers: `grep -rn "@repo/chunker"` -> `apps/worker` only, both via the barrel; no deep imports. Gap-pattern #1 (moved-module importers / `vi.mock` sites): none - the external surface did not move.
- `dist/` format:check warnings are pre-existing (generated output, gitignored, never prettier-formatted); all source files pass.
- No U+2014 em dash introduced (R-001).

## Reflection

The module was authored ~1 day ago (A1 split, `faae304`, 2026-06-22), so this is decomposing freshly-written code rather than archaeology. The real risk was not the mechanical file split but the `hardSplitByChars` dedup: collapsing two inlined loops into one function is exactly where an off-by-one or a `part`-vs-`text` swap hides, and the loose existing tests would have waved it through. Writing the golden snapshot first - and choosing inputs that deliberately drive each fallback site (a separatorless 900-char run for the final fallback, a 600-char "word" inside spaced text for the in-loop fallback) - turned "I believe this is byte-identical" into "the captured output is identical." That is the difference between a refactor and a hope.
