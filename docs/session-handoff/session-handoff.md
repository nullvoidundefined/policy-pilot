# Session Handoff

## 1. Last commit

`f74d496` docs(plan): expand scope to three repos (Tracks C, D); record locked decisions

- On branch `docs/convention-refactor-spec` (NOT merged to `main`; holds all spec/plan/audit docs).
- `main` is at `bce84f0` (unchanged this session).
- `~/.claude` repo: `main` at `f0bd66a` (Track B merged via PR #1).

## 2. Production state

Unchanged this session. No code deployed. Live on Railway project `policy-pilot`, all services green at the prior production commit.

## 3. What shipped

Planning + Track B of a multi-day, three-repo convention refactor.

- **Spec:** `docs/superpowers/specs/2026-06-21-convention-refactor-design.md`
- **Master plan + scope + locked decisions:** `docs/superpowers/plans/2026-06-21-convention-refactor-index.md`
- **Rules reconciliation audit:** `docs/audits/2026-06-21-rules-reconciliation.md`
- **Track B SHIPPED (merged):** `~/.claude` PR #1 `f0bd66a`. Three rule edits: R-238 sanctions `errors/`+`resilience/`; R-236 adds `@repo/clients`, confirms single-surface `apps/client/web`; R-235 splits client factory/singleton/lifecycle into separate files.

## 4. Pending (by urgency)

The rules (target standard) are final. Remaining work, each one PR, branched off updated `main`, zero stacking:

- **A1 (next, policy-pilot):** split `packages/common` -> `@repo/types` + `@repo/chunker`; rescope shared pkgs to `@repo/*` (apps stay unscoped); update every importer + `pnpm-workspace.yaml`. Mechanical, broad.
- **A2:** create `@repo/clients`; migrate server + worker off duplicated `embedding`/`r2` impls.
- **A3 (server, path-disjoint):** `db/`->`database/`, kill `utils/` (ApiError -> `errors/`, logger -> `logging/`), repos+handlers one-fn-per-file, extract Anthropic call to `clients/llm.ts`, split `prompts/qa-system.ts`, tests -> `__tests__/` mirror.
- **A4 (worker, path-disjoint):** `db/`->`database/`, decompose `document-processor.ts` monolith, inline SQL -> repository, `workers/` tree, tests consolidated.
- **A5 (web, path-disjoint):** `lib/api.ts` -> `api/`+`errors/`, `context/`+`providers/` -> `state/`, plus NET-NEW tests (characterization first, then coverage to 60%).
- **A6:** eslint `import/no-cycle`+`no-restricted-paths`, fix `CLAUDE.md`/`README.md` (still say `packages/api...`), smoke.
- **Track C (doppelscript):** finish abandoned `teardown-lib-utils`, kill 4 single-file folders (R-223), `features/document-type/`->camelCase (R-237), regroup `repositories/`(34)/`routes/`(24)/`handlers/`(22) under R-241, split client singletons (R-235).
- **Track D (voyager):** split `handlers/chat/helpers.ts` (8 exports), split `clients/redis.ts`, delete stale `packages/shared-types/` dir.

A3/A4/A5 path-disjoint, order-independent. C/D independent repos, parallelizable.

## 5. Next session tasks

1. Merge `docs/convention-refactor-spec` to `main` (or keep as the working docs branch) so the plans are on `main`.
2. Author `docs/superpowers/plans/2026-06-21-trackA1-package-split.md` (writing-plans skill), then execute via subagent-driven-development.
3. Read first: `docs/superpowers/plans/2026-06-21-convention-refactor-index.md` (locked decisions), `docs/audits/2026-06-21-rules-reconciliation.md`, and the current `packages/common/` layout.
4. A-phases target the merged rule text in `~/.claude` (R-238 `errors/`, R-235 client splits, R-236 `@repo/clients`).
