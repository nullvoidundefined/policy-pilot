# Convention Refactor: policy-pilot + rules re-derivation

- **Date:** 2026-06-21
- **Status:** Design approved, pending spec review
- **Baseline commit:** `bce84f0` test(e2e): skip RAG pipeline test when external service creds absent
- **Scale:** Multi-day, multi-PR effort across two repos

## 1. Goal

Bring policy-pilot into compliance with the established directory-organization, folder-structure, and clean-code rules, using the post-cleanup state of Doppelscript and Voyager as the working reference. In the same effort, re-derive the rule files themselves so they accurately and consistently describe both reference repos.

## 2. Deliverables (two tracks, two repos)

| Track | Repo                 | What                                                                                                        |
| ----- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| **B** | `~/.claude` (public) | Full re-derivation of the directory/clean-code rule block against the current state of both reference repos |
| **A** | `policy-pilot`       | Phased structural refactor (6 PRs) to the settled conventions                                               |

**Order: Track B lands first.** The rules PR finalizes the target standard before any policy-pilot code moves, so Track A executes against authoritative rule text.

The two tracks live in different repos and never stack on each other.

## 3. Settled target conventions

Derived from Doppelscript and post-merge Voyager (PR #50 `refactor/convention-cleanup`), which now agree on every previously-conflicting axis.

### Monorepo and packages

- App packages stay **unscoped** (`policy-pilot-server`, `policy-pilot-worker`, `policy-pilot-web`), matching Voyager's `voyager-server`.
- Shared packages take the **`@repo/*`** scope.
- `packages/common` splits into:
  - `@repo/types`: shared TypeScript types (currently the monolithic `packages/common/src/types/index.ts`).
  - `@repo/chunker`: the pure chunking library (no I/O), reused by apps 5 and 7.
- New `@repo/clients`: absorbs the `embedding` and `r2` provider wrappers currently **duplicated** between `apps/server` and `apps/worker`. One module per provider (R-222), consumed by both apps.

### Server `src/` taxonomy

- `db/` becomes `database/`; collapse the double-nested `db/pool/pool.ts` to `database/pool.ts` (R-223, R-229).
- Eliminate `utils/` (R-238): `ApiError` moves to top-level `errors/`; logger moves to its own home (proposed `logging/`, to confirm against Voyager's actual placement during planning).
- Sanctioned domain-named top-level dirs follow the reference repos (`errors/`, and `resilience/` if/when needed).

### Clean-code rules applied

- **One exported function per file** across `services/`, `api/`, `clients/`, and repositories (R-235).
- **Verb-noun filenames** (R-217); drop the `.service.ts` suffix.
- Split multi-export files: repositories (`auth.ts` with 8 exports, etc.), `prompts/qa-system.ts` (constant + function), service files (`retrieval.service.ts`).
- Fix the `handlers/qa/qa.ts` layering violation by extracting the Anthropic call into `clients/llm.ts` (R-224). This is also the exact prerequisite the agentic-conversion plan needs.

### Tests

- Single `src/__tests__/` mirror tree per package.
- `__integration__/` becomes `__tests__/integration/` (R-239).
- Fixtures move to `src/__fixtures__/`.
- No co-located test files.

### Web client `src/` taxonomy

- `lib/api.ts` god file splits into `api/request.ts` (transport) + per-route `api/*.ts` wrappers + client `errors/` (R-220, R-240).
- `context/` + `providers/` unify under `state/` (R-240), matching Voyager.
- Keep `apps/client/web` (both reference repos use it even for a single surface).

## 4. Current-state deviations (baseline)

Condensed from the structural inventory. Full detail lives in the exploration record.

**Packages:** unscoped `policy-pilot-*`; `common` bundles chunker + types; `embedding.service.ts` and `r2.service.ts` duplicated in server and worker with divergent implementations.

**Server:** `db/pool/pool.ts` double-nest; `utils/` catch-all holding `ApiError.ts` + `logs/logger.ts`; repositories and handlers with many exports per file; `.service.ts` suffixes; `prompts/qa-system.ts` mixes constant and function; `handlers/qa/qa.ts` instantiates Anthropic SDK directly (layering violation); integration tests in `src/__integration__/`; unit tests co-located.

**Worker:** `db/` dir; RAG pipeline is a single monolithic `processors/document-processor.ts` with inline SQL; `workers.ts` at `src/` root mixing worker setup, health server, and shutdown; `text-extractor.service.ts` suffix; no unit tests; integration tests in `src/__integration__/`.

**Web client:** `lib/api.ts` god module (transport + CSRF + domain calls); split `context/` + `providers/`; `AuthContext.tsx` bundles context + provider + hook + type; **zero tests**.

**Docs:** policy-pilot `CLAUDE.md` still describes the old `packages/api`, `packages/worker`, `packages/web`, `packages/common` layout, contradicting the actual `apps/` + `packages/` structure.

## 5. Track B: rules re-derivation (`~/.claude`)

One focused PR-equivalent on the public rules repo.

**Process:**

1. Systematic audit of the directory/clean-code rule block (R-217 through R-241, plus R-220, R-222, R-238, R-239, R-240) against the current state of Doppelscript and post-merge Voyager.
2. Produce a reconciliation note: for each rule, does each repo comply, diverge, or extend?
3. Rewrite rule text for consistency where repos have settled on a clearer pattern.

**Known amendments to incorporate:**

- Record `utils/`-elimination as the canonical resolution; retire any "subdivided `utils/` tolerated" reading. (Voyager deleted `utils/` entirely; Doppelscript's surviving `utils/` is the laggard, not the model.)
- Sanction top-level `errors/` and `resilience/` as examples of domain-named server dirs already permitted by R-238.
- Add `@repo/clients` to the canonical shared-package list in R-236.
- Confirm `apps/client/web` for single-surface repos.

**Constraints:** Honors R-108 (public repo). Before push: `git diff origin/main`, verify no secrets, no local filesystem paths, no client-identifying content. Enforced by `global-repo-push-guard.sh`.

## 6. Track A: phased PRs

Each phase is **one PR, branched off `main`, standing alone.** Cross-cutting changes (A1, A2) land first; the per-surface phases (A3, A4, A5) touch disjoint paths and are order-independent.

### A1: Package split and rescope

- Split `packages/common` into `packages/types` (`@repo/types`) + `packages/chunker` (`@repo/chunker`).
- Update every importer across all apps; update `pnpm-workspace.yaml` globs.
- Mechanical, broad. No logic changes.
- **Paths:** `packages/**` + all importers.
- **Done when:** workspace installs clean, full build passes, all imports resolve, suite green.

### A2: Shared clients de-duplication

- Create `packages/clients` (`@repo/clients`) with one module per provider (`embedding`, `r2`), one exported function per file.
- Migrate both `apps/server` and `apps/worker` off their duplicated `embedding`/`r2` implementations to the shared package.
- Reconcile the two divergent implementations into one (server's superset for r2; batched embedding).
- **Paths:** `packages/clients`, server + worker service layers.
- **Done when:** zero duplicated client code remains, both apps import from `@repo/clients`, suite + integration green.

### A3: Server internals

- `db/` becomes `database/`; collapse `database/pool.ts`.
- Eliminate `utils/`: `ApiError` to `errors/`; logger to `logging/`.
- Repositories: one function per file (R-235); verb-noun names.
- Handlers: one function per file; extract the Anthropic call from `handlers/qa/qa.ts` into `clients/llm.ts`.
- Split `prompts/qa-system.ts` into constant module + builder function.
- Split `services/retrieval.service.ts` into `services/retrieval/<fn>.ts`; remove the now-shared embedding/r2 service files.
- Test consolidation: `__integration__/` to `__tests__/integration/`; co-located to `__tests__/` mirror; fixtures to `__fixtures__/`.
- **Paths:** `apps/server/**`.
- **Done when:** no `utils/`, no `db/`, no multi-export function-tree files, tests relocated and green.

### A4: Worker internals

- `db/` becomes `database/`.
- Decompose `processors/document-processor.ts` into an orchestrator plus atomic steps (download, extract, chunk, embed, store) per R-227.
- Move inline SQL into a repository layer.
- Restructure `workers.ts` into a `workers/` tree (worker setup, health server, shutdown as separate concerns).
- `text-extractor.service.ts` becomes verb-noun, one function per file.
- Consume `@repo/clients` for embedding/r2.
- Test consolidation as A3; add unit tests for the newly-extracted atomic steps.
- **Paths:** `apps/worker/**`.
- **Done when:** processor decomposed, no inline SQL, tests relocated, new step tests green.

### A5: Web client refactor + net-new tests

- `lib/api.ts` splits into `api/request.ts` (transport) + per-route `api/*.ts` wrappers + client `errors/`.
- `context/` + `providers/` unify under `state/`.
- Split `AuthContext.tsx` per the reference pattern (confirm Voyager's single-file-in-`state/` vs split during planning).
- Establish `src/__tests__/` mirror.
- **Add net-new tests:** characterization tests against current behavior first (so the refactor stays green), then component/unit coverage for the refactored modules. Target the project 60% coverage minimum. Vitest for component/unit; Playwright already covers E2E.
- **Paths:** `apps/client/web/**`.
- **Done when:** no `lib/`, no split `context/`+`providers/`, `__tests__/` populated, coverage threshold met, suite green.

### A6: Enforcement and sweep

- Add `import/no-cycle` and `import/no-restricted-paths` eslint rules to enforce layer direction (R-224) going forward.
- Update `README.md` and `CLAUDE.md` to the actual `apps/` + `packages/` structure.
- Full smoke verification (`npm run smoke`).
- **Paths:** root config, docs.
- **Done when:** lint rules active and passing, docs accurate, smoke green.

## 7. Sequencing and PR discipline

- **Order:** Track B, then A1, then A2, then A3/A4/A5 (any order, path-disjoint), then A6.
- **Zero stacking.** Every branch starts from updated `main`; later PRs rebase. No PR depends on another's unmerged branch.
- A3/A4/A5 touch disjoint paths (`apps/server`, `apps/worker`, `apps/client/web`) and could run in parallel worktrees.
- Where a change genuinely cannot be split (a package rename plus all its importers), it stays one larger atomic PR rather than a base+dependent chain.
- Branch naming: `refactor/<slug>`. One PR per scope. Squash merge, delete branch.
- `fix:`-class corrections inside a refactor PR include a failing test first per project rules.

## 8. Testing and verification

- Per-PR: changed-file tests + build (R-507).
- Pre-push: full suite + `npm run smoke` (R-507, project default).
- Integration tests hit the real database, not mocks.
- **R-515:** package-name and path changes break test imports and assertions; each PR updates every stale assertion in the same commit as the source change.
- Deploy monitoring after any merge to `main`: GitHub Actions, Railway, health endpoints green before claiming done.

## 9. Risks and mitigations

| Risk                                            | Mitigation                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A1 import rename is broad                       | Purely mechanical; lands before logic refactors; relies on compiler + suite to catch misses  |
| Reconciling divergent embedding/r2 impls (A2)   | Adopt server's superset for r2, batched embedding; integration test covers worker path       |
| Worker processor decomposition changes behavior | Characterization integration test first; decompose under green                               |
| Web refactor without prior tests (A5)           | Write characterization tests against current behavior before moving code                     |
| Public rules repo leak (Track B)                | R-108 push guard; manual diff for client-identifying content                                 |
| Agentic-conversion plan path collisions         | Refactor-first ordering hands that plan a clean foundation; `clients/llm.ts` extracted in A3 |

## 10. Open items to confirm during plan-writing

- Logger home after `utils/` removal: verify where Voyager placed its logger; default proposal `logging/`.
- Handler granularity: confirm one-function-per-file vs domain-grouped handler files against both reference repos.
- `AuthContext.tsx`: single-file-in-`state/` (Voyager) vs split context/provider/hook.
- `@repo/clients` exact module layout (`embedding/`, `r2/`) and whether embedding belongs with the RAG packages instead.
- Whether A5's net-new tests warrant splitting into a separate follow-up PR if size grows beyond one reviewable unit (still sequenced off `main`, never stacked).
