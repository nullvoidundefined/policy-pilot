# PR: Convention-Compliance Audit + Track A6 Plan (docs only)

**Branch:** `docs/convention-compliance-audit` into `main`
**Date:** 2026-06-23
**Plan produced:** `docs/superpowers/plans/2026-06-21-trackA6-enforcement.md`

## Summary

Documentation only; zero code or config change. Adds the engineering convention-compliance audit of policy-pilot's own codebase (prior reconciliation only covered the reference repos), the CLAUDE.md reconciliation that falls out of it, and the design spec plus task-by-task plan for Track A6 (the final A-track unit: compliance sweep + ESLint enforcement).

## What changed

- **Audit** `docs/audits/2026-06-23-convention-compliance.md`: four read-only subagents, one per surface, against R-001..R-241. Totals 0 P0, 4 P1, ~36 P2, ~22 P3. Codebase is structurally sound; `@repo/clients` is the exemplar. Clusters: ~30 missing R-230 headers; R-219 magic literals; R-226/R-227 oversized/duplicated functions (web SSE x2 P1, chunker, streamQA); R-224 route->repository skips (P1); R-223/R-235/R-239 structural nits. Section 3 reconciles CLAUDE.md drift.
- **Design spec** `docs/superpowers/specs/2026-06-23-trackA6-sweep-design.md`: eight sequential single-scope PRs, sequencing rationale, per-PR DoD, decisions D1-D5.
- **Plan** `docs/superpowers/plans/2026-06-21-trackA6-enforcement.md`: full task-by-task plan mirroring A1-A5; the filename the master index already references.
- **Handoff** `docs/session-handoff/session-handoff.md`: updated for this branch.

## Architectural decisions (chosen / alternative / why)

- **Docs land as their own PR** (vs folding into the first A6 execution PR). Chosen to keep one-PR-one-scope: the audit/plan are the input to A6, not part of any single refactor's diff. Branching A6.1 off updated `main` after this merges avoids stacking on unpushed work.
- **CLAUDE.md fixes are deferred to A6.6, not done here** (vs fixing inline now). Chosen so the doc corrections ship alongside the ESLint enforcement they pair with, and so this PR stays a pure record of findings rather than a mix of findings + fixes.

## Testing

Docs only; no build/test/lint gates apply to content. Pre-commit `format:check` (repo-wide) is the only gate touched; markdown was prettier-formatted before each commit. The untracked `docs/agentic-conversion-plan.md` is excluded from every commit per project memory.

## Reflection

The audit's value is that it scopes A6 precisely: every section-2 finding maps to exactly one of the eight PRs, and the two genuine decision points (D2 handlers-folder collapse, D5 separate-repo category-file edit) are surfaced as blocking user checks rather than assumed. What I got wrong first in the prior session: nearly committing with `--no-verify` and nearly `git add -A`-ing the untracked conversion plan; both are now codified as constraints in the plan's Global Constraints section.
