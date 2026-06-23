# A6.6: ESLint layer enforcement + doc reconciliation

**Date:** 2026-06-23
**Branch:** `chore/a6-enforcement-and-docs`
**Rules:** R-224 (layer flow), R-236 (monorepo layout docs)
**Tag:** `[standard]`, the final Track A6 PR; locks the swept tree with enforcement.

## Summary

Eighth and final PR of Track A6. Adds ESLint enforcement so the layer flow the
prior seven PRs established cannot regress, and reconciles the stale monorepo paths
in the project `CLAUDE.md`. Enforcement proven to bite; clean tree passes with 0
errors.

## What changed

### ESLint enforcement (`eslint.config.js`)

Added `eslint-plugin-import` + `eslint-import-resolver-typescript` (new dev deps),
wired into the TypeScript config block:

- **`import/no-cycle`** (`error`) across all packages, catching circular imports.
- **`import/no-restricted-paths`** (`error`) encoding the R-224 layer flow as named zones (`LAYER_CONTRACT_ZONES`):
  - Server: routes must not import repositories; services must not import handlers/routes; repositories and clients must not import upward.
  - Web: `api`/`services`/`state` must not import `app`/`components` (flow is `components -> state -> services/api`).

Two settings were required to make the rules actually enforce, not silently pass:

- `import/resolver: typescript` with every package `tsconfig`, so the `app/*` and `@/*` aliases (and `.js`-on-`.ts` specifiers) resolve.
- `import/parsers: { '@typescript-eslint/parser': ['.ts', '.tsx'] }`, without which `no-cycle`'s graph-builder parses followed `.ts` modules with the default JS parser, fails, and reports no cycles.

### Web: relocate the shared `CitedChunk` type

Enabling the web layer contract surfaced one real R-224 violation introduced in
A6.4b: `services/streamAnswer.ts` imported the `CitedChunk` **type** from
`components/ChatAnswer`. Moved `CitedChunk` to a new shared `src/types.ts`; the
component, both chat pages, and the service now import it from `@/types`. The
component stops defining and exporting its own copy.

### Docs (`CLAUDE.md`)

- `packages/common/chunker/` to `@repo/chunker`.
- Monorepo line rewritten from the stale `packages/api/worker/web/common` to the real `apps/server`, `apps/worker`, `apps/client/web`, `packages/{chunker,clients,logger,types}` (`@repo/*`).

## Decisions

- **Web `CitedChunk` moved to a web-local `@/types`, not pulled from `@repo/types` (chosen) vs. consuming the shared package.** `@repo/types` already defines an identical `CitedChunk`, but the web app depends on no `@repo/*` package and resolves them through none of its config; adding a built workspace package to the Next app is a cross-package build change too heavy for an enforcement PR. A web-local shared type module is consistent with how web already keeps its own `errors/` and `constants/`. Unifying web onto `@repo/types` is a separate, larger decision.
- **Cross-repo doc edit deferred and flagged, not applied.** The spec noted `personal/.claude/CLAUDE.md` line 7 (`Next.js 16 on Railway`) should say Vercel. That file lives one tree above this repo and governs _every_ project in `personal/`, where Railway may be correct for other apps; silently rewriting a shared convention from inside a single project's PR is wrong. Raised with the user as a separate action.
- **No README work.** There is no root README and no package READMEs, so the original A6 row's "fix README" item is moot (confirmed).

## Testing

- `pnpm lint` (the gate, run from repo root): 0 errors, 21 pre-existing warnings.
- Enforcement proven to bite, then reverted:
  - Layer: a temporary `routes/qa.ts` import of `repositories/conversations` errored with the R-224 zone message.
  - Cycle: a temporary `query.ts <-> withTransaction.ts` mutual import (aliased) and a `chunkText.ts <-> estimateTokens.ts` mutual import (relative) both errored `Dependency cycle detected`.
- Web suite: 144 passed (21 files) after the `CitedChunk` relocation; web `tsc --noEmit` clean.

## Reflection

The subtle part was that `no-restricted-paths` worked immediately but `no-cycle`
silently found nothing, on both relative and aliased cycles. The tell was that it
passed _too_ quietly: a rule that never errors on a deliberately planted cycle is
not enforcing. The missing `import/parsers` setting meant the graph-builder could
resolve a module but not parse it, so it saw an empty import graph. Planting both
an aliased and a relative cycle to confirm the fix mattered, since they exercise
different paths through the resolver.
