# PR: Track A5 - Web Client Refactor + Net-New Tests

**Branch:** `refactor/trackA5-web-client` into `main`
**Date:** 2026-06-23
**Plan:** `docs/superpowers/plans/2026-06-21-trackA5-web-client.md`

## Summary

Brings `apps/client/web` into directory/clean-code compliance and stands up the Vitest + Testing Library harness the package never had, reaching a global 60% coverage gate (achieved ~95%). Two intertwined deliverables: a pure, behavior-preserving refactor of the web client, and net-new tests across modules, components, and every page.

## What changed

**Refactor (zero behavior change):**

- Split `lib/api.ts` god-module into `api/request.ts` (the shared transport: `API_BASE`, `ensureCsrfToken`, `request`, `get`/`post`/`del`, `uploadFile`, `streamPost`), three per-route wrappers (`api/getCollections.ts`, `api/createCollection.ts`, `api/deleteCollection.ts`), and `errors/ApiError.ts`. Deleted `lib/`.
- Unified `context/AuthContext.tsx` and `providers/QueryProvider.tsx` under `state/` (single-file each). Deleted `context/` and `providers/`.
- Renamed `createCollectionApi`/`deleteCollectionApi` to `createCollection`/`deleteCollection` (D5).
- Replaced 8 U+2014 em dashes in web copy/comments (R-001).

**Tests (net-new):**

- Vitest + jsdom + Testing Library harness (`vitest.config.ts`, `src/__tests__/setup.ts`, test scripts, tsconfig `types`, root `test` wiring, `coverage/` ignored).
- 130 tests across 19 files: characterization transport tests, errors/wrappers/AuthContext, the four leaf components, and all pages (auth, landing, protected layout, documents, chat index, dashboard, collection-detail, streaming chat, demo).
- Global coverage gate locked at 90/80/85/90 (measured 95.4/85.2/91.3/95.4).

## Architectural decisions (chosen / alternative / why)

- **D1/D2: `AuthContext`/`QueryProvider` stay single-file in `state/`** (vs splitting context/provider/hook). Chosen because the Voyager reference repo keeps them single-file and the bundle is one cohesive responsibility (R-226).
- **D3: `api/request.ts` is one transport module** (vs one-function-per-file). The R-235 split governs the per-route own-backend wrappers; the shared fetch transport beneath them is the documented carve-out, exactly as `database/pool.ts` sits below repositories.
- **D4: `ApiError` lives in `errors/ApiError.ts`** (vs inlined in `request.ts` like Voyager). One deliberate divergence from the reference, for consistency with policy-pilot's own A3 server `errors/ApiError.ts` and the spec's explicit "client `errors/`" target.
- **D6: global 60% coverage gate** (vs scoped to the refactored trees). User decision; the whole web surface was tested rather than just the refactored modules.
- **`AuthContext.logout` kept typed `() => void`** (vs `() => Promise<void>`). Retyping would trip `no-misused-promises` on Header's `onClick={logout}`; the existing typing is intentional. The only cost is a harmless `await`-no-effect TS hint in one test.

## Testing

- Behavior preservation proven by `__tests__/api/request.test.ts` characterization tests (CSRF retry, 403 reset, 204 to undefined, error precedence, uploadFile headers, streamPost): green against both the pre- and post-split module.
- `pnpm build` (all workspaces), `pnpm test` (130 web + all backend suites), `pnpm --filter policy-pilot-web lint` (0 errors), `pnpm run smoke` (server+worker+frontend boot, health checks): all green.
- Coverage: stmts 95.4 / branch 85.2 / funcs 91.3 / lines 95.4.
- Final whole-branch review (opus): Ready to merge = Yes, 0 Critical / 0 Important.

## Deferred (follow-up tech-debt, none merge-blocking)

- `chat`/`demo` page tests surface the demo page's own `[PolicyPilot] SSE event:` `console.info` logs to stdout (benign source logging under the streamed-flow path).
- `chat-collection.test.tsx` has a latent unmocked-GET tripwire (not a current failure).
- `api/request.ts` + collection wrappers retain `any`/`any[]` copied verbatim from the original; tightening was out of A5 scope.

## Reflection

What I understand now: the transport split's only real risk was silent behavior drift, and writing the characterization tests _before_ the split (against the live `lib/api.ts`) made the refactor mechanically safe. The same green suite proved the move. The single biggest scope driver was D6: global coverage from zero meant testing four large interactive pages (streaming chat, scripted demo) carrying most of the LOC, far beyond "split a god-module."

What I got wrong first: I initially recommended scoping coverage to the refactored trees (cheaper, ~2-3h); the user chose global 60%, which was the right call for durability and turned a refactor into a real test-suite foundation. A recurring papercut across the page tests was helper parameter types inferring too narrowly from a fixture literal (`description: string` instead of `string | null`), surfaced twice and fixed both times by explicit nullable fixture types.

Generated with Claude Code
