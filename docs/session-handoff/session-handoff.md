# Session Handoff

## 1. Last commit

`faae304` refactor(A1): split packages/common into @repo/types and @repo/chunker (#15) -- on `main`.

This handoff sits on branch `refactor/trackA2-shared-clients` (the A2 execution branch, off `main`), which also carries the unmerged A2 plan + index update. The working tree is left checked out here so the next session resumes A2 directly.

## 2. Production state

A1 deployed and verified. Railway built both updated Dockerfiles; Post-Deploy Health Check green (`/health`, `/health/ready`, CSRF, CORS). No outstanding production issues.

## 3. What shipped

Convention refactor: planning landed on `main`, then Track A1 executed end-to-end.

- **PR #14 (merged):** planning set on `main` -- spec, master index + locked decisions, rules-reconciliation audit, A1 plan.
- **PR #15 (merged, deployed):** A1 -- split `packages/common` into `@repo/types` + `@repo/chunker` (R-236); 11 importers + all build refs (deps, workspace, root/lefthook/CI scripts, eslint project paths, both Dockerfiles) rewired; sources moved byte-identical. Task review caught + fixed two R-231 dep-sort violations; ghost `packages/common/` removed.
- **A2 plan authored (this branch, uncommitted->committed here):** `docs/superpowers/plans/2026-06-21-trackA2-shared-clients.md`.

Track B (rules) was merged in a prior session (`~/.claude` PR #1, `f0bd66a`).

## 4. Pending (by urgency)

Each remaining unit is one PR off updated `main`, zero stacking (master index).

- **A2 (next, plan ready on this branch):** create `@repo/logger` + `@repo/clients` (OpenAI embedding + R2, strict R-235 one-fn-per-file); adopt batched-embedding + full-R2 supersets; migrate server + worker; app loggers become `@repo/logger` re-exports; drop unused `@aws-sdk` direct deps. Atomic, ~18 new files. Est: 1-2 hrs via SDD.
- **A3 (server, path-disjoint):** `db/`->`database/`, kill `utils/` (ApiError->`errors/`, logger->`logging/`), repos+handlers one-fn-per-file, Anthropic call->`clients/`, split `prompts/qa-system.ts`, tests->`__tests__/` mirror.
- **A4 (worker, path-disjoint):** `db/`->`database/`, decompose `document-processor.ts`, inline SQL->repository, `workers/` tree.
- **A5 (web, path-disjoint):** `lib/api.ts`->`api/`+`errors/`, `context/`+`providers/`->`state/`, NET-NEW tests to 60%.
- **A6:** eslint `import/no-cycle`+`no-restricted-paths`, fix CLAUDE.md/README, smoke.
- **Tracks C/D:** Doppelscript + Voyager cleanups (independent repos).

A3/A4/A5 are path-disjoint and order-independent.

## 5. Next session tasks

1. You are on `refactor/trackA2-shared-clients`. Commit the staged A2 plan + index + this handoff if not already (see below), then execute A2 via subagent-driven-development.
2. **Read first:** `docs/superpowers/plans/2026-06-21-trackA2-shared-clients.md` (the full A2 plan, no placeholders), then `docs/superpowers/plans/2026-06-21-convention-refactor-index.md` (locked decisions).
3. A2 design decision already made: shared `@repo/logger` (clients import it; apps re-export it).
4. Execute, task-review the full diff, fix, then PR + request review. Do NOT merge without per-turn authorization (R-516). Monitor Railway after merge.

## Process notes for A-phase execution

- **`git add -A` is unsafe here:** an untracked `docs/agentic-conversion-plan.md` (separate workstream) lives in the tree and was swept into A1's first commit. Use scoped `git add` with a `':!docs/agentic-conversion-plan.md'` pathspec (the A2 plan's Task 4 Step 7 already does this).
- **Pre-commit `format:check` is repo-wide** and trips on unformatted scratch under `.superpowers/` (git-excluded but prettier still scans it). Run `prettier --write` on any touched `.superpowers/*.md` before committing, or it blocks the commit AND the pre-push.
- **SDD ledger:** `.superpowers/sdd/progress.md` (git-excluded via `.git/info/exclude`).
