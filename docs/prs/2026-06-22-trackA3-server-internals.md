# PR: Track A3 - Server Internals Convention Refactor

**Branch:** `refactor/trackA3-server-internals` -> `main`
**Date:** 2026-06-22
**Scope:** `apps/server/**` only. Pure internal refactor, no behavior change, no API change, no DB change.

## Summary

Brings `apps/server/src` into directory/clean-code compliance (the fourth unit of the convention refactor, after A1 package split and A2 shared clients). Eleven mechanical commits plus one cleanup commit, each independently green, executed via subagent-driven development with a per-task spec+quality review and a final whole-branch review (Opus).

## What changed

1. **`db/` -> `database/`** (R-223/R-229): collapsed the double-nested `db/pool/pool.ts` to `database/pool.ts`; updated all consumers, mocks, and integration setup.
2. **`utils/` eliminated** (R-220/R-238): `ApiError` moved to top-level `errors/`; the logger re-export was removed in favor of importing `@repo/logger` directly at every site; the `utils/` tree is gone.
3. **Repositories split to one exported function per file** (R-235): `auth` (8 fns + a private `hashSessionToken` helper in its own file, excluded from the barrel), `collections` (7), `conversations` (6), `documents` (5). Each folder gained an `index.ts` barrel; `import * as xRepo` call sites repoint at the barrel.
4. **Anthropic SDK extracted** (R-222/R-224): `clients/anthropic.ts` is now the only place `new Anthropic()` is constructed (mirrors `@repo/clients/r2/s3Client.ts`); `generateConversationTitle` moved into `services/generateConversationTitle.ts`. The qa handler imports the singleton and the service.
5. **`retrieval.service.ts` -> `services/searchChunks.ts`** (R-217): dropped the `.service` suffix, verb-noun filename.
6. **`prompts/qa-system.ts` split** (R-222): `qaSystemPrompt.ts` (constant) + `buildContextPrompt.ts` (function).
7. **Tests consolidated** (R-221/R-239): every co-located `*.test.ts` moved into a single `src/__tests__/` mirror; `__integration__/` renamed to `__tests__/integration/`; both vitest configs updated.

## Architectural decisions (chosen vs alternative vs why)

These resolve the spec's section 10 open items via the reference-repo process (both Voyager and Doppelscript agree, so no user conflict).

- **D1 - Handlers stay domain-grouped** (NOT one-function-per-file). _Alternative:_ split handlers like repositories. _Why:_ R-235's one-function-per-file scope is services/api/clients/repositories/stores; handlers are R-227 orchestrators and excluded. Both reference repos keep handlers grouped. The spec's "no multi-export function-tree files" done-condition is met without splitting handlers. This materially reduced scope vs the spec's literal wording.
- **D2 - Logger imported directly** from `@repo/logger`, no `logging/` dir. _Alternative:_ the spec's proposed `logging/` dir. _Why:_ the file was already a pure re-export post-A2; a dir holding one re-export is a single-file folder (R-223) plus needless indirection.
- **D3 - `clients/anthropic.ts` is singleton-only** (no call-wrapping). _Alternative:_ the spec shorthand `clients/llm.ts` wrapping the `.messages.*` calls. _Why:_ provider-named per R-222; both reference repos make the LLM client only the SDK construction; avoids fragile SDK param types. The qa handler already imports `@repo/clients/openai` directly, so handler-to-client is the established pattern.
- **D4 - `database/pool.ts` stays a single module** (`pool` + `query` + `withTransaction` together). _Alternative:_ R-235 strict split. _Why:_ the spec explicitly says collapse to `database/pool.ts`; a connection pool is the R-220 own-top-level-tree carve-out; R-235's strict split was the locked decision for clients, not the pool.

## Testing

- Per task: changed-file server tests + build green before each commit.
- Whole branch: full monorepo `pnpm build` green; `pnpm test` = 138 (chunker 13 + clients 9 + server 116); integration suite 14/14 against a live DB; server `tsc` (which type-checks test files via `include: src/**/*.ts`) exit 0; `pnpm --filter policy-pilot-server lint` 0 errors (28 pre-existing `any`/floating-promise warnings, unchanged from baseline).
- Compliance greps all clean: no `app/db/` or `app/utils/` imports, no `db/`/`utils/` dirs, no `.service` files, `new Anthropic(` only in `clients/anthropic.ts`, no co-located tests.
- Gap-pattern checks (per project memory `refactor-plan-gap-patterns`): every `vi.mock` of a moved/deleted specifier was retargeted in the same commit; `apps/server/package.json` is unchanged vs `main` (no orphaned deps).
- Behavior preservation verified by diff: moved function bodies (`updateDocumentStatus` dynamic SQL, `generateConversationTitle` fallback, `searchChunks` query) are byte-identical.

## Reflection

- **What I understand now:** R-235's function-tree scope deliberately excludes handlers; applying it to handlers would have fought both reference repos and R-227. Confirming open items against the reference repos (rather than the spec's tentative wording) was the right call and shrank the change surface.
- **What I got wrong first:** the spec's "logger to `logging/`" and "`clients/llm.ts`" were taken at face value in early planning; reading the actual post-A2 re-export and the reference repos' LLM clients corrected both to simpler, more compliant forms (D2, D3).
- **Mechanical note:** vitest silently no-ops a `vi.mock` against a nonexistent specifier, so every module move enumerated its mock sites up front. The final review also caught three pre-existing em dashes (R-001) riding along on renamed files; cleaned up in the same branch.

## Merge

Squash merge, delete branch. Do not merge without explicit authorization after CI + Copilot review are green (R-516).
