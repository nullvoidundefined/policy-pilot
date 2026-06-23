# fix: deflake the demo QA-fetch-fail test under CI load

**Date:** 2026-06-23
**Branch:** `fix/demo-test-flake-timeout`
**Rules:** R-201 (test-resistant timing-flake path)
**Tag:** `[trivial]`

## Summary

Removes a P2 flaky test that intermittently reded `main` CI. No production code
change; a test-only timeout adjustment.

## Root cause

`demo.test.tsx > DemoPage > Q&A happy path > renders the turbulence error
message when the QA fetch fails` asserted with `screen.findByText(...)` at
Testing Library's default 1000ms timeout. That case does the most async work of
the error-path tests (type + send + await the streamed 500 error state); on the
slower CI runner under full-suite load it occasionally took ~1050ms and timed
out. It passed locally and cleared on every CI re-run with no code change,
confirming a timing flake rather than a real failure.

## Fix

Raised the timeout on that single assertion to 5000ms
(`findByText(/we've hit some turbulence/i, undefined, { timeout: 5000 })`) with
an inline comment explaining why. The sibling error-path assertions were left at
the default; they do less async work and have not flaked.

Per R-201 this is the test-resistant path: a timing flake has no deterministic
failing test, so the fix is to harden the assertion, not add a new test. The
resolved entry is removed from `ISSUES.md`.

## Testing

- Ran the demo suite locally 3x post-fix: 18/18 each time.

## Reflection

The flake was correctly deferred out of Track A6 (it surfaced on the A6.4a merge
but is unrelated to the chunker) and logged to `ISSUES.md` rather than fixed
mid-refactor. Shipping it as its own `fix:` PR keeps the A6 history clean and the
fix traceable.
