# Session Handoff

## 1. Last commit

`main` is at `fc964df` chore(A6.6): enforce R-224 layer flow via ESLint + reconcile monorepo docs (#32).

Working tree clean except the intentionally-untracked `docs/agentic-conversion-plan.md`.

## 2. Production state

A1+A5 deployed (prior sessions). **Track A6 fully shipped and deployed this session.** Post-Deploy Health Check green for `fc964df` (Railway server `/health`, `/health/ready`, `/api/csrf-token`). All A6 PRs were behavior-preserving; no functional change shipped. Open production blocker unchanged: R2 credentials + custom domain (see `ISSUES.md`).

## 3. What shipped (this session)

Track A6 is now complete (8 of 8 PRs). This session landed the final four:

- **#30 A6.4c** (`4d2f68c`): one-function split of server/worker internals (R-227/R-235). qa handler -> orchestrator + private helpers; DB pool singleton carved out from `query`/`withTransaction` (server + worker); `requireAuth` split into `loadSession`/`requireAuth`/`optionalAuth`. Caught + retargeted four `vi.mock('app/database/pool.js')` sites.
- **#31 A6.5** (`3a5a258`): collapsed five incidental single-file middleware folders to flat modules (R-223), test folders mirrored (R-239). `requireAuth/` kept foldered (now 3 files); `handlers/<domain>/` kept foldered (canonical domain seam).
- **#32 A6.6** (`fc964df`): ESLint `import/no-cycle` + `import/no-restricted-paths` encoding the R-224 layer flow, both proven to bite; relocated web `CitedChunk` type out of a component to `@/types`; reconciled stale monorepo paths in `CLAUDE.md`.
- Earlier this session: #28 (demo-test flake logged to ISSUES.md, P2), #27 A6.4a (chunker decomposition), #29 A6.4b (web SSE `streamAnswer` service).

## 4. Pending (by urgency)

- **Flagged A6 follow-ups (not blocking, need user call):** (a) `personal/.claude/CLAUDE.md` line 7 `Next.js 16 on Railway` -> Vercel, a separate-tree edit governing all `personal/` projects (Railway may be correct for others); (b) unify web onto `@repo/types` instead of its local `@/types` (web currently depends on no `@repo/*` package; larger architectural decision).
- **ISSUES.md backlog:** demo.test.tsx flake (P2, `findByText` 1000ms vs ~1050ms under CI load; bump timeout or use `findByText(..., {}, {timeout})`); uploaded-status polling bug (P2, test-first); Railway per-service config; duplicate Redis services; R2 + custom domain (blocked on Cloudflare token).

## 5. Next session tasks

1. Decide the two flagged A6 follow-ups above (both quick once decided).
2. If touching the demo flake: it is P2 in `ISSUES.md`; the fix is raising the `findByText` timeout on the turbulence-error assertion, test-first.
3. Otherwise the convention-refactor track (A-series) is complete; pick up the ISSUES.md backlog or new feature work.

## Process notes

- `git add -A` is UNSAFE: always `git add -A -- ':!docs/agentic-conversion-plan.md'`.
- Pre-commit `format:check` is repo-wide and is a CHECK: run `npx prettier --config prettier.config.mjs --write <files>` before committing.
- Per-package `test` gate EXCLUDES `__tests__/integration/**`. Characterize moved behavior with repo-mocking handler unit tests; grep every `vi.mock` site of any module you move (see [[refactor-plan-gap-patterns]]).
- ESLint graph rules (`import/no-cycle`) silently pass without `import/parsers`; always plant a cycle to prove they bite (see the A6.6 PR doc).
- Land this handoff via branch + PR so it reaches `main`; never leave it on an unpushed branch.
- Never merge a PR without explicit per-turn authorization (R-516). Copilot is not API-addable here.
