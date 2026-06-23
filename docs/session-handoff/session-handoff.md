# Session Handoff

## 1. Last commit

`main` is at `73e5369` refactor(A6.3): route bodies into handlers; routes only wire (R-224) (#25).

Working tree clean except the intentionally-untracked `docs/agentic-conversion-plan.md`.

## 2. Production state

A1+A5 deployed and verified (prior sessions). A6.3 merged and deployed this session: the Post-Deploy Health Check workflow passed (Railway server `/health`, `/health/ready`, `/api/csrf-token` all green). Behavior-preserving refactor, no functional change shipped. One open production blocker unchanged: R2 credentials + custom domain (see `ISSUES.md`).

## 3. What shipped (this session)

- **PR #25** `refactor(A6.3): route bodies into handlers; routes only wire (R-224)` (`73e5369`), CI-green, Copilot skipped (A6-series authorization), squash-merged.
  - New `apps/server/src/handlers/conversations/conversations.ts` (`listConversations`, `getConversationMessages`).
  - Added `getDemoCollections` to `handlers/collections/collections.ts`; its bare `{ error: string }` `404` preserved exactly (NOT normalized to `ApiError`).
  - `routes/conversations.ts` + `routes/collections.ts` reduced to wiring; no route imports a repository (`grep repositories/ routes` clean). `/demo` stays public.
  - Test-first (R-201): 6 handler unit tests confirmed RED then GREEN. Server suite 116 -> 122 passing.

## 4. Pending (by urgency)

- **A6.4a (next PR):** chunker decomposition into one-function modules; output must be byte-identical (reused by apps 5/7). Medium. ~30-45m after the 3-5x divide. Guarded by the existing fixture test.
- **A6.4b/c, A6.5, A6.6:** A6.4b (web SSE `streamAnswer` service, behavior-sensitive: run streaming E2E baseline first; D4 reuse existing `streamPost`). A6.4c (qa/pool/requireAuth splits, D3 pool-state carve-out). A6.5 (collapse 6 single-file middleware folders; **blocking D2 user check** before executing: also collapse single-file `handlers/<domain>/` folders? recommend KEEP). A6.6 (ESLint `import/no-cycle` + `import/no-restricted-paths` contracts, doc fixes; **D5** Railway->Vercel fix is a separate commit in the `personal/.claude/CLAUDE.md` repo).
- **ISSUES.md backlog:** uploaded-status polling bug (P2, test-first fix); Railway per-service config; duplicate Redis services; R2 + custom domain (blocked on Cloudflare token).

## 5. Next session tasks

1. Read `docs/superpowers/plans/2026-06-21-trackA6-enforcement.md` (PR A6.4a section) and `docs/audits/2026-06-23-convention-compliance.md` (chunker R-218/R-227/R-235/R-239 findings).
2. Branch `refactor/a6-chunker-decomposition` off `main`. Confirm the captured-fixture chunk test is the byte-identical guard before splitting.
3. Per-PR gates (changed-package test + build), PR doc before opening, push, CI green, deploy health check, then merge only with explicit per-turn auth. Copilot stays skipped for the A6 series.

## Process notes

- `git add -A` is UNSAFE: always `git add -A -- ':!docs/agentic-conversion-plan.md'`.
- Pre-commit `format:check` is repo-wide and is a CHECK: run `npx prettier --config prettier.config.mjs --write <files>` before committing.
- Per-package `test` gate EXCLUDES `__tests__/integration/**` (real-DB, runs via `test:integration`). Characterize moved behavior with handler unit tests that mock the repo, not integration tests.
- Copilot reviewer is NOT API-addable in this repo; user authorized skipping it for the entire A6 series.
- Land the handoff via a branch + PR so it reaches `main`: the prior A6.1/A6.2 handoff (`7fdf566`) was orphaned on an unpushed `docs/session-handoff-a6` branch and never landed; that branch was deleted this session.
- Never merge a PR without explicit per-turn authorization (R-516).
