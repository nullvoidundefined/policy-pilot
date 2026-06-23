# PR: A6.3 - Route -> handler layering (R-224)

**Branch:** `refactor/a6-route-handler-layering` into `main`
**Date:** 2026-06-23
**Plan:** `docs/superpowers/plans/2026-06-21-trackA6-enforcement.md` (PR A6.3)

## Summary

Third of eight Track A6 PRs, and the first behavior-sensitive one. Two routers held inline route bodies that reached straight into the repository layer, skipping the handler layer (R-224). This PR moves that logic into handlers so the routes only wire verb + path + middleware. Characterization tests were written first (R-201/R-511): they failed against the absent handler modules, then passed once the logic moved, proving behavior is preserved.

## What changed

**New handler module:**

- `apps/server/src/handlers/conversations/conversations.ts` -> `listConversations`, `getConversationMessages`. The bodies are lifted verbatim from `routes/conversations.ts` (list query; ID guard -> ownership lookup -> 404 -> message fetch).

**Handler extended:**

- `apps/server/src/handlers/collections/collections.ts` -> new `getDemoCollections` (the public `/demo` body moved out of the route). The plain-string `404 { error: 'No demo collections available' }` response is preserved exactly - it is NOT the `ApiError` shape, so it was kept as a direct `res.status(404).json(...)` rather than normalized.

**Routes reduced to wiring:**

- `routes/conversations.ts`: now imports `conversationHandlers` + `requireAuth` only; no `ApiError`, no `convRepo`, no `express` types.
- `routes/collections.ts`: dropped the `collectionsRepo` import; `/demo` wires to `collectionHandlers.getDemoCollections`. Auth gating order unchanged (`/demo` registered before `router.use(requireAuth)`, so it stays public).

**Characterization tests (written first, R-201):**

- `src/__tests__/handlers/conversations/conversations.test.ts` (4 tests): list delegation + response shape; messages happy path; 400 on missing ID; 404 on unknown conversation.
- `src/__tests__/handlers/collections/collections.test.ts` (2 tests): demo list returns collections; empty -> plain `404`.

## Architectural decisions (chosen / alternative / why)

- **Handler unit tests, not integration tests, as the characterization net.** The per-package `test` gate excludes `__tests__/integration/**` (those need a real DB and run via `test:integration`). Mocking the repo and asserting response shape + thrown `ApiError` fully captures the moved behavior and runs in the standard gate, matching the existing `documents` handler test. Auth-gating order is structurally preserved in the route file and unchanged.
- **`getDemoCollections` kept its non-standard response.** Every other collections handler throws `ApiError`; the demo route returned a bare `{ error: string }` with a manual `404`. Normalizing it to `ApiError.notFound` would change the wire response the web client consumes, so this value-neutral refactor preserved it exactly. Normalization, if wanted, is a separate behavior change.
- **Two exported functions in the conversations handler is fine.** R-235's one-function-per-file rule scopes to `services/`/`api/`/`clients/`; handlers group operations by feature (the collections handler already exports five). Functions are ordered in operational/REST order to match the house style, not alphabetical.

## Testing

- `pnpm --filter policy-pilot-server test`: 122 passing (116 baseline + 6 new). Confirmed the 6 new tests FAILED first against the absent handler modules (RED), then passed after extraction (GREEN).
- `pnpm --filter policy-pilot-server build`: green (`tsc` + `tsc-alias`).
- `pnpm --filter policy-pilot-server lint`: 0 errors (pre-existing `any` warnings only).
- R-224 verified: `grep -rn "repositories/" apps/server/src/routes` returns no matches.
- Gap-pattern #1: no test mocks the moved route paths; no importer retarget needed.
- No U+2014 em dash introduced (R-001).

## Reflection

The behavior worth guarding here was not the SQL - that already lived in repositories - but the two response idioms the routes had quietly diverged on: the conversations routes threw `ApiError`, while `/demo` hand-rolled a plain `404`. A naive "clean up the layering" pass would have unified them and silently changed the demo wire contract. Writing the demo test first pinned that idiom in place before the move, which is exactly what the test-first rule is for on a refactor that looks purely mechanical but sits on live response shapes.
