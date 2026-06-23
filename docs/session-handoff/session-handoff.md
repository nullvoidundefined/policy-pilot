# Session Handoff

## 1. Last commit

`main` is at `c77155c` refactor(A5): web client refactor + net-new tests (#19). A5 squash-merged + deployed this session.

No active feature branch. Next track (A6, enforcement + sweep) not yet started.

## 2. Production state

A1 + A2 + A3 + A4 + A5 deployed and verified. A5 post-merge: CI + Post-Deploy Health Check both green on main. Web (Vercel) deployed. No outstanding production issues.

## 3. What shipped (this session)

- **A5 (#19)** merged to main (`c77155c`), squash-merge, branch deleted, Copilot skipped (not API-addable; user authorized merge after CI + whole-branch review green). Code verified on main by file presence (api/, errors/, state/ present; lib/, context/, providers/ gone).
- Web client refactor: `lib/api.ts` split into `api/request.ts` + 3 route wrappers + `errors/ApiError.ts`; `context/`+`providers/` unified under `state/`; 8 R-001 em dashes removed from web copy.
- Net-new test harness (web had none): Vitest + jsdom + Testing Library, 130 tests across 19 files, global coverage 95.4% lines (gate locked 90/80/85/90). Root `test` now includes web; `coverage/` ignored.
- Updated master index: A5 -> Shipped (#19, deployed).

## 4. Verification (A5 merge)

`main` log confirms `c77155c` on top of `1365795` (A4 docs). Actions on main: CI run `28003312848` success, Post-Deploy Health Check `28003312845` success. Local main = origin/main.

## 5. Pending (by urgency)

- **A6 (enforcement + sweep, ~1-2h):** add eslint `import/no-cycle` + `import/no-restricted-paths`; fix CLAUDE.md/README to the apps/ + packages/ layout; smoke. Plan file `2026-06-21-trackA6-enforcement.md` (authored just before exec, mirror A1-A5).
- **A5 deferred Minors (follow-up tech-debt, none blocking):** see `docs/prs/2026-06-23-trackA5-web-client.md` "Deferred" -- silence demo/chat SSE `console.info` in tests; harden the latent unmocked-GET tripwire in `chat-collection.test.tsx`; tighten `any`/`any[]` in `api/request.ts` + collection wrappers.
- **Tracks C/D:** Doppelscript + Voyager cleanups (independent repos).

## 6. Next session tasks

1. For A6: author the track plan (writing-plans, mirror A1-A5), then SDD execute. Read the master index `docs/superpowers/plans/2026-06-21-convention-refactor-index.md` first.
2. A6 touches eslint config + root docs; verify `import/no-restricted-paths` contracts match the R-224 layer flow before enforcing.

## Process notes

- `git add -A` is UNSAFE: untracked `docs/agentic-conversion-plan.md` in tree. Use scoped adds (`git add -A -- ':!docs/agentic-conversion-plan.md'`).
- Pre-commit `format:check` is repo-wide; `.superpowers/`, `coverage/`, `dist/` are in `.prettierignore`. Still `npx prettier --write` new markdown before committing if the gate trips.
- SDD ledger: `.superpowers/sdd/progress.md` (git-excluded). A5 ledger shows all 9 tasks complete.
- Web tests: `pnpm --filter policy-pilot-web test` (config at `apps/client/web/vitest.config.ts`, coverage gate global). `coverage/` output is gitignored.
- Stale LSP "Cannot find module"/"Cannot use JSX" after `git mv`/branch-switch is expected; trust `pnpm build` and file presence.
- Copilot reviewer is NOT API-addable (`gh ... --add-reviewer copilot` fails to resolve login). Add via Reviewers panel UI or skip with user auth.
