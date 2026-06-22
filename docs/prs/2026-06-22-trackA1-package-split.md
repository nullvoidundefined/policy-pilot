# PR: Track A1 - split packages/common into @repo/types + @repo/chunker

- **Branch:** `refactor/trackA1-package-split` -> `main`
- **Date:** 2026-06-22
- **Scope:** Mechanical monorepo package split. No behavior change.
- **Plan:** `docs/superpowers/plans/2026-06-21-trackA1-package-split.md`

## Summary

First execution phase of the convention refactor. `packages/common` (`policy-pilot-common`) held two self-contained concerns, `types/` and `chunker/`. This splits them into two canonical scoped packages, `@repo/types` and `@repo/chunker` (R-236), and rewires every consumer and build reference. One atomic commit: the build is red between the first file move and the final rewire, so the change cannot be split into independently-building commits.

## What changed

- New `packages/types` (`@repo/types`): `src/index.ts` moved verbatim from `packages/common/src/types/`.
- New `packages/chunker` (`@repo/chunker`): `src/index.ts` + `src/index.test.ts` moved verbatim from `packages/common/src/chunker/`. Self-contained; does not depend on `@repo/types`.
- Deleted `packages/common` (the old `policy-pilot-common`, including its barrel `src/index.ts`).
- Rewired 11 import specifiers: 7 server (type-only), 4 worker (`chunkText` value + types).
- Updated dependency manifests: `apps/server` (`@repo/types`), `apps/worker` (`@repo/chunker` + `@repo/types`).
- Updated all build plumbing: `pnpm-workspace.yaml`, root `package.json` build/test scripts, `lefthook.yml`, `.github/workflows/ci.yml`, `eslint.config.js` project paths, `Dockerfile.server`, `Dockerfile.worker`.

## Architectural decisions

- **Chosen:** one atomic PR (rename plus all importers). **Alternative:** split the new packages from the consumer rewrite. **Why:** intermediate states do not build; the spec sanctions a single larger PR for a rename-plus-importers change.
- **Chosen:** `@repo/chunker` declares no dependency on `@repo/types`. **Alternative:** a shared base package. **Why:** the two modules are genuinely independent (zero cross-imports); adding an edge would be premature coupling.
- **Chosen:** `@repo/types` ships no test harness (no `vitest`, no `test` script). **Alternative:** parity with chunker. **Why:** the types module has no behavior to test and never did; adding a harness would be dead config.
- **Chosen:** no new tests written (R-511 exception). **Why:** pure structural refactor, no new behavior. The regression harness is the existing chunker unit test (moved), the full build, the server/worker suites, and smoke.

## Testing

- `pnpm build`: green across all five packages (the primary proof every import resolves).
- Full unit suite: 137 pass (13 chunker + 124 server).
- `pnpm lint`: 0 errors (28 warnings, all pre-existing; verified the moved files are byte-identical via `git mv`).
- `pnpm format:check`: clean.
- `npm run smoke`: all checks pass (server/worker on separate ports, health, CSRF, CORS, auth, frontend routes).
- Grep guard: zero functional references to `policy-pilot-common` remain (only documentation mentions it).

## Reflection

What I understand now: on a single-commit branch, the per-task review IS effectively the whole-branch review, so a second identical AI pass adds cost without signal; the objective merge gate for a no-behavior-change refactor is the verification suite, not a second opinion. The task review caught a real R-231 violation (the `@repo/*` deps were inserted mid-list instead of in scoped-alphabetical order), now fixed.

What I got wrong first: the plan's `git add -A` in the final commit step swept two untracked files into the commit (the unrelated `docs/agentic-conversion-plan.md` and SDD scratch). The blanket add was a plan defect; a scoped `git add` of the known change set would have prevented it. Corrected by uncommitting, restaging only the A1 surface, and re-committing. Lesson, consistent with one-PR-one-scope: never `git add -A` when untracked files unrelated to the change exist in the tree.
