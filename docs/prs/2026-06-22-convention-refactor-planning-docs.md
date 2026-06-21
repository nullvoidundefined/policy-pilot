# PR: Convention refactor planning docs

- **Branch:** `docs/convention-refactor-spec` -> `main`
- **Date:** 2026-06-22
- **Scope:** Documentation only. No source, config, or build changes.

## Summary

Lands the full planning set for the multi-day, three-repo convention refactor onto `main`, so every downstream execution branch (A1 through A6, plus Tracks C and D) starts from a base that already contains the spec, the master index with locked decisions, the rules-reconciliation audit, and the first execution-ready plan (A1). Track B (the `~/.claude` rule re-derivation that finalizes the target standard) is already merged separately; this PR carries only the policy-pilot-side planning documents.

## What changed

- `docs/superpowers/specs/2026-06-21-convention-refactor-design.md`: design spec (target standard, phase breakdown, risks, verification).
- `docs/superpowers/plans/2026-06-21-convention-refactor-index.md`: master index, unit sequence, locked decisions.
- `docs/superpowers/plans/2026-06-21-trackA1-package-split.md`: execution-ready A1 plan (split `packages/common` into `@repo/types` + `@repo/chunker`).
- `docs/audits/2026-06-21-rules-reconciliation.md`: per-rule compliance audit of the two reference repos that fed the rule re-derivation.
- `docs/prs/2026-06-22-convention-refactor-planning-docs.md`: this document.

Out of scope and intentionally excluded: `docs/agentic-conversion-plan.md` (untracked, belongs to a separate RAG-to-agentic workstream).

## Architectural decisions

- **Chosen:** PR the planning docs to `main` before executing A1, rather than keeping them on a long-lived working branch. **Alternative:** branch A1 off `main` while the plans live only on the docs branch. **Why:** the master index mandates every A-phase branch off "updated `main`"; getting the plans onto `main` first means each execution worktree contains its own plan, and the docs branch does not linger as hidden state.
- **Chosen:** one docs PR covering spec + index + audit + A1 plan together. **Alternative:** separate PRs per document. **Why:** they are one cohesive planning artifact for a single effort; splitting adds ceremony without a meaningful independent review gate.
- **Chosen:** A1 stays one atomic PR (package rename plus all importers), not a base+dependent chain. **Alternative:** split the rename from the import updates. **Why:** the build is red between the first file move and the final rewire, so intermediate commits would not build; the spec explicitly sanctions a single larger PR for a rename-plus-importers change.

## Testing

Documentation only; no code paths touched. Verification is structural: the A1 plan was authored against a live grep sweep of the repo, which caught build references the handoff had not enumerated (both Dockerfiles, `lefthook.yml`, `.github/workflows/ci.yml`, and the `eslint.config.js` `parserOptions.project` array). Those are now first-class steps in the A1 plan. No test suite runs for a docs change; CI will confirm the markdown lands without affecting build or lint.

## Reflection

What I understand now: the package split is smaller and cleaner than the handoff framing implied. Both concerns in `packages/common` (`types/` and `chunker/`) are fully self-contained with zero imports and no dependency on each other, so the split has no inter-package edges to reason about. The real risk surface is not the source rewrite (11 importer lines) but the build plumbing: Docker, CI, lefthook, and the eslint project array all hard-code the old package name, and a green local build would still ship a broken Railway image if any were missed.

What I got wrong first: I initially scoped A1 to the importers and `pnpm-workspace.yaml` named in the handoff. The grep sweep showed that was roughly half the true reference surface. The lesson, consistent with R-515, is to derive the change set from the repo by search, not from the prose summary of prior work.
