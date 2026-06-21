# Convention Refactor Implementation Plan (Master Index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement each unit task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring policy-pilot into compliance with the established directory/clean-code rules, and re-derive the rule files to match the current reference repos.

**Spec:** `docs/superpowers/specs/2026-06-21-convention-refactor-design.md`

**Architecture:** Two tracks across two repos. Track B (rules re-derivation, `~/.claude`) lands first and finalizes the target standard. Track A (policy-pilot refactor) then executes as six path-disjoint PRs sequenced for zero stacking.

## Global Constraints

- No U+2014 em dash anywhere (R-001).
- Each unit is one PR branched off updated `main`; zero stacking; rebase later PRs (project PR Workflow).
- Branch naming: `refactor/<slug>` (policy-pilot), `docs/<slug>` or `refactor/<slug>` (`~/.claude`).
- `fix:`-class corrections include a failing test first; commit test + fix together (R-201, project rules).
- Per-PR: changed-file tests + build. Pre-push: full suite + `npm run smoke` (R-507).
- R-515: update every stale test assertion in the same commit as the source change.
- Never merge a PR without explicit per-turn authorization (R-516).
- `~/.claude` is public: before any push, `git diff origin/main`, verify no secrets, no local filesystem paths, no client-identifying content (R-108).
- One exported function per file in `services/`, `api/`, `clients/`, repositories (R-235); verb-noun filenames (R-217).

## Unit sequence

| Order | Unit                         | Repo         | Plan file                                                    | Status   |
| ----- | ---------------------------- | ------------ | ------------------------------------------------------------ | -------- |
| 1     | Track B: rules re-derivation | `~/.claude`  | this file, section "Track B"                                 | Detailed |
| 2     | A1: package split + rescope  | policy-pilot | `2026-06-21-trackA1-package-split.md` (written when reached) | Pending  |
| 3     | A2: shared clients de-dup    | policy-pilot | `2026-06-21-trackA2-shared-clients.md`                       | Pending  |
| 4     | A3: server internals         | policy-pilot | `2026-06-21-trackA3-server-internals.md`                     | Pending  |
| 5     | A4: worker internals         | policy-pilot | `2026-06-21-trackA4-worker-internals.md`                     | Pending  |
| 6     | A5: web client + tests       | policy-pilot | `2026-06-21-trackA5-web-client.md`                           | Pending  |
| 7     | A6: enforcement + sweep      | policy-pilot | `2026-06-21-trackA6-enforcement.md`                          | Pending  |

A3/A4/A5 are path-disjoint and order-independent among themselves.

Each A-phase plan is authored just before execution, so it incorporates the finalized rule text from Track B and the resolutions to the spec's section 10 open items.

---

## Track B: rules re-derivation

**Goal:** The directory/clean-code rule block in `~/.claude` accurately and consistently describes the current state of Doppelscript and post-merge Voyager.

**Repo:** `~/.claude` (public). All edits on a branch; PR, no direct push to the tracked rule files without R-108 checks.

**Files (likely):**

- `~/.claude/CLAUDE.md` (rule block R-217 through R-241, plus R-220, R-222, R-236, R-238, R-239, R-240)
- Possibly `~/.claude/CLAUDE-BACKEND.md`, `~/.claude/CLAUDE-FRONTEND.md` if directory specifics live there

### Task B1: Per-rule reconciliation audit

**Deliverable:** A reconciliation table (rule -> Doppelscript state -> Voyager state -> recommended action) covering every directory/clean-code rule.

- [ ] **Step 1:** Dispatch a read-only audit subagent (model sonnet) over both repos: `/Users/iangreenough/Desktop/code/personal/production/doppelscript` and `/Users/iangreenough/Desktop/code/personal/production/voyager`. For each rule in {R-217, R-218, R-219, R-220, R-221, R-222, R-223, R-224, R-225, R-226, R-227, R-228, R-229, R-230, R-231, R-232, R-233, R-234, R-235, R-236, R-237, R-238, R-239, R-240, R-241}, report: does each repo comply, diverge, or extend, with one concrete path as evidence.
- [ ] **Step 2:** Consolidate into a reconciliation table. Flag every rule where the two repos disagree, or where both diverge from the rule text.
- [ ] **Step 3:** Record the table in a working note (not committed to `~/.claude` yet): `docs/audits/2026-06-21-rules-reconciliation.md` in policy-pilot.
- [ ] **Step 4:** Commit the audit note in policy-pilot on a `docs/` branch.

### Task B2: Draft rule amendments

**Deliverable:** Exact before/after text for each rule line to change, reviewed before applying.

- [ ] **Step 1:** From the reconciliation table plus the spec's known amendments, list each rule edit as a verbatim before/after diff. Known amendments: utils-elimination canonical (R-238, R-240); sanction `errors/` and `resilience/` as domain dirs (R-238); add `@repo/clients` to the canonical package list (R-236); confirm `apps/client/web` for single-surface (R-236).
- [ ] **Step 2:** For any rule where the two repos still disagree, present the conflict to the user with a recommendation and get a decision before drafting that edit.
- [ ] **Step 3:** Self-check: no edit contradicts another rule; no edit references a pattern neither repo follows.

### Task B3: Apply, verify, PR

- [ ] **Step 1:** Create branch in `~/.claude`: `git -C ~/.claude checkout -b refactor/rules-rederivation`.
- [ ] **Step 2:** Apply the drafted edits to the rule files.
- [ ] **Step 3:** Verify: `git -C ~/.claude diff origin/main` shows only intended rule changes; no secrets, no local home paths, no client-identifying content (R-108).
- [ ] **Step 4:** Commit: `git -C ~/.claude commit -m "refactor(rules): re-derive directory/clean-code block from reference repos"`.
- [ ] **Step 5:** Push and open a PR. Do not merge without explicit per-turn authorization (R-516).
- [ ] **Step 6:** Stop and report. Track A begins only after the rule text is finalized (merged or user-approved).

---

## Self-review (index)

- **Spec coverage:** Every spec deliverable maps to a unit above. Track B = spec section 5; A1-A6 = spec section 6.
- **Open items:** Spec section 10 items are resolved inside the relevant A-phase plan at authoring time (logger home and handler granularity in A3, AuthContext split in A5, `@repo/clients` layout in A2).
- **No placeholders in Track B tasks:** B-tasks contain concrete commands and the exact rule-ID scope; B2/B3 edit text is intentionally produced by B1's audit output, which is the correct ordering (cannot write exact rule diffs before auditing).
