# chore: correct deploy platform to Railway and remove dead Vercel integration

**Date:** 2026-06-24
**Branch:** `chore/de-vercel-railway`
**Tag:** `[standard]`

## Summary

policy-pilot deploys all three services (web, API, worker) on Railway via
`Dockerfile.web` / `Dockerfile.server` / `Dockerfile.worker`. The docs claimed the
frontend was on Vercel, and the web app still imported Vercel-only analytics that
do nothing off Vercel. This corrects the docs to reality and removes the dead
Vercel runtime integration.

## Why now

A review of deploy targets across the `personal/` tree confirmed nothing deploys
on Vercel: voyager's web is on Railway (`railway.web.toml`), doppelscript's web is
on Railway (its `vercel.json` was dead and is being removed), and policy-pilot's
web builds from `Dockerfile.web` on Railway. The shared convention
(`personal/.claude/CLAUDE.md`, "Next.js on Railway") was already correct; it was
policy-pilot's own docs that drifted.

## What changed

### Docs corrected (Vercel -> Railway)

- `CLAUDE.md`: stack line now states web + API + worker all on Railway.
- `docs/FAQ.md`: deploy table (frontend row -> Railway / `Dockerfile.web`), the deploy-steps list, and the obsolete "Vercel build fails?" entry (which referenced a nonexistent `web-client/vercel.json`) rewritten for Railway.
- `docs/FULL_APPLICATION_SPEC.md`: hosting table, infrastructure section, system-design diagram, and both POC deploy bullets.
- `docs/TECHNICAL_OVERVIEW.md`: the mermaid frontend subgraph label.
- `docs/QUIZ.md`: the two CORS / `sameSite` answers. The cross-origin reasoning is unchanged and still correct (the web and API are separate Railway services on different domains); only the "Vercel" label was wrong.

### Dead Vercel code removed

- `apps/client/web/src/app/layout.tsx`: dropped `@vercel/analytics` and `@vercel/speed-insights` imports and their `<Analytics />` / `<SpeedInsights />` components. These only report on Vercel deployments and were inert on Railway.
- `apps/client/web/package.json`: removed the two `@vercel/*` dependencies; lockfile updated.

Historical records (dated PR docs, the convention-compliance audit, superpowers
plans/specs) still reference Vercel and are intentionally left as point-in-time
logs.

## Testing

- Web suite: 144 passed (21 files); web `tsc --noEmit` clean. No test asserted the removed analytics components.

## Reflection

The original Track A6.6 spec proposed editing the shared convention from Railway
to Vercel; that was backwards, built on the same doc drift this PR fixes.
Verifying the actual deploy artifacts (Dockerfiles, sibling `railway.*.toml`)
before acting (R-403/R-513) caught it: the shared default was right, and the real
work was correcting one project's docs and deleting dead deps. If Railway-native
analytics are wanted later, that is a separate, additive decision.
