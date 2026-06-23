# PR: A6.4b - Shared web SSE streamAnswer service (R-226/R-227/R-234)

**Branch:** `refactor/a6-web-sse-service` into `main`
**Date:** 2026-06-23
**Plan:** `docs/superpowers/plans/2026-06-21-trackA6-enforcement.md` (PR A6.4b)

## Summary

Fifth of eight Track A6 PRs, and the behavior-sensitive one. The demo and chat pages
each hand-rolled a ~130-line streaming block: fetch a fresh CSRF token, POST the
question, then decode and parse the SSE stream (`token` / `citations` / `done` /
`error` events) inline while mutating component state. The two copies had drifted
(different error strings, the demo's debug `console.log`, demo lacking the `done`
handler). This PR extracts the shared decode/parse loop into one `streamAnswer`
service so each page only manages its own component state (R-227), removing the
duplication (R-226) and reusing the existing transport (R-234).

## What changed

**New service:**

- `apps/client/web/src/services/streamAnswer.ts` - one exported `streamAnswer(path, body, callbacks)` orchestrator plus private `parseSseStream` / `dispatchSseLine` helpers (R-218/R-235). It calls `streamPost`, fires `onStart` once the stream opens, decodes with `SSE_DATA_PREFIX`, and dispatches each parsed event to `onToken` / `onCitations` / `onDone` / `onError`.

**streamPost now surfaces failures (the key behavior decision):**

- `apps/client/web/src/api/request.ts` - `streamPost` previously caught a non-ok response and returned an empty stream (errors swallowed). It now awaits the response, throws `ApiError` on `!res.ok || !res.body`, and returns a non-null `ReadableStream`. Without this, routing the pages through `streamPost` would have silently dropped the "We've hit some turbulence" error path. Its only prior consumer was its own test; no production caller existed.

**Pages reduced to state management:**

- `app/demo/page.tsx` and `app/(protected)/chat/[collectionId]/page.tsx` - the inline fetch + decode/parse loop is replaced by a `streamAnswer` call with callbacks. Each page keeps its own `updateLastAssistant` state helper and its own error-string format (demo: `\n\n${message}`; chat: `\n\nError: ${message}`) and `done` handling (chat sets `conversationId`), so the wire-visible behavior is unchanged. The demo's debug `console.log` is dropped (plan Step 4). Now-unused imports (`CSRF_TOKEN_PATH`, `SSE_DATA_PREFIX`, demo-side nothing else; chat-side `API_BASE`) removed.

## Architectural decisions (chosen / alternative / why)

- **Fix `streamPost` to throw, then reuse it (your call).** Alternatives were a parser-only service (page keeps its own fetch) or a service that owns fetch+CSRF itself. Reusing `streamPost` honors R-234 and the plan's D4, but only works once `streamPost` stops swallowing HTTP errors - otherwise the turbulence path goes silent. Blast radius was a single test (no production caller), so the contract change is contained.
- **Callbacks, not an async generator.** Each page mutates several pieces of React state per event (`assistantContent`, `currentCitations`, `conversationId`, the message list). A callback per event type keeps that state in the component (plan: "the page only manages component state") without leaking React concerns into the service.
- **`updateLastAssistant` kept per-page, not shared.** It shapes each page's local `Message[]` state; the duplication being removed in this PR is the streaming loop, not a 9-line state reducer. Extracting it into a shared module would couple two pages' state shapes for little gain.

## Testing

- New `__tests__/services/streamAnswer.test.ts` (6 tests, written first, confirmed RED then GREEN): token order, citations + `done`, event split across chunk boundaries, comment/invalid-JSON skipping, `onError` message, `onStart`-once, and **rejection propagation so callers can show the error state**.
- New `streamPost` test: throws `ApiError` on non-ok instead of returning an empty stream (RED against the old swallow, GREEN after).
- `chat-collection.test.tsx` retargeted from a global-`fetch` spy to the `streamPost` seam (the page's dependency moved); all 17 user-visible assertions (streamed text, markdown, loading, citations open/close, turbulence-on-failure) preserved.
- `pnpm --filter policy-pilot-web test`: 144 passing (was 137 + 7 net new). `build`: green. `lint`: 0 errors.
- **E2E streaming baseline (plan Step 1) runs in CI**, not locally - it needs the full server + Postgres + Redis + R2 stack. The `streamAnswer` unit test and the demo/chat component tests are the local regression net; CI's Playwright `rag-pipeline` E2E is the end-to-end guard.

## Reflection

The demo + chat code was last touched ~hours ago (A5, `c77155c`), so this is consolidating fresh duplication. The trap was `streamPost` silently swallowing non-ok responses: a naive "just call streamPost" extraction would have compiled, passed a casual glance, and quietly removed every error message the user sees when the backend fails - including the exact turbulence assertion this repo already tests (and which we separately logged as a CI flake earlier today). Surfacing that as a decision before writing code, then pinning "streamAnswer propagates the rejection" as its own unit test, is what kept a mechanical-looking refactor from shipping a silent UX regression.
