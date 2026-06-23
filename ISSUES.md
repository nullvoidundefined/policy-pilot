# Issues / Deferred Work

## Frontend bugs

### Uploaded documents do not poll until the worker starts processing (P2)

**Why:** `apps/client/web/src/app/(protected)/collections/[id]/page.tsx` only
enables the document-list `refetchInterval` when a document's status is in
`['pending', 'chunking', 'embedding']`. The database default for
`documents.status` is `'uploaded'` (migration `1711900000002`), and `'pending'`
is not a value in the `@repo/types` `DocumentStatus` union at all. A freshly
uploaded document therefore sits at `'uploaded'` with no polling until the
worker flips it to `'chunking'`, so the UI can stall on the just-uploaded state.

**How to apply:** Fix test-first (R-201): assert that an `'uploaded'` document
triggers polling, then replace the `'pending'` literal with `'uploaded'` (and
drop `'embedding'` if the worker never sets it) so `PROCESSING_STATUSES` matches
the real `DocumentStatus` union. Found during Track A6.2; the literals were
preserved as-is there because that PR was a value-neutral extraction.

## Flaky tests

### `demo.test.tsx` QA-fetch-fail assertion times out under CI load (P2)

**Why:** `apps/client/web/src/__tests__/app/demo.test.tsx` >
`DemoPage > Q&A happy path > renders the turbulence error message when the QA
fetch fails` asserts `await screen.findByText(/we've hit some turbulence/i)`,
which uses Testing Library's default 1000ms timeout. That case does the most
async work of the error-path tests (type + send + await the streamed 500 error
state), and on the slower CI runner under full-suite load it occasionally
exceeds 1000ms (observed: 1053ms), reding `main` CI. Passes locally 18/18 and
5/5 in isolation; cleared on CI re-run with no code change. Surfaced by the
A6.4a merge (`59d0313`), unrelated to the chunker (web does not import
`@repo/chunker`).

**How to apply:** Timing flake, so R-201's test-resistant path applies (no
deterministic failing test). Raise the timeout on that assertion (and the
sibling async-error `findBy*` calls if they show the same edge), e.g.
`screen.findByText(/we've hit some turbulence/i, undefined, { timeout: 5000 })`,
then verify with many local full-suite runs. Ship as its own `fix:` PR, not
folded into Track A6.

## Deploy / Railway

### Convert `railway.toml` to per-service config files (e.g. `railway.server.toml`)

**Why:** A single repo-root `railway.toml` is applied to every service, and any
field it sets (such as `dockerfilePath` or `healthcheckPath`) overrides the
per-service settings. That forced all three services to build `Dockerfile.server`
until the global fields were removed. Today the per-service Dockerfile path and
healthcheck are set via Railway service settings (the API), which is not captured
in version control.

**Change:** Split the shared `railway.toml` into per-service config files checked
into the repo:

- `railway.server.toml` -> `dockerfilePath = "Dockerfile.server"`, `healthcheckPath = "/health"`
- `railway.worker.toml` -> `dockerfilePath = "Dockerfile.worker"` (no healthcheck)
- `railway.web.toml` -> `dockerfilePath = "Dockerfile.web"` (no healthcheck)

Then set each service's "Config file path" (Settings -> Config-as-code, or the
`serviceInstanceUpdate` API) to its file. This keeps each service's build and
deploy config in code instead of relying on dashboard/API-set values.

**How to apply:** Start by renaming `railway.toml` to `railway.server.toml` and
pointing the `server` service at it, then add the worker and web files.

### Delete duplicate Redis services

Four Redis services exist in the `policy-pilot` Railway project from CLI
provisioning retries; only `Redis-o5eF` is referenced (via `REDIS_URL` on server
and worker). Delete `Redis`, `Redis-qQFt`, and `Redis-1yhH` in the Railway
dashboard (the CLI has no service-delete command).

### Pending: R2 + custom domain

- R2 credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`,
  `R2_BUCKET_NAME`) are not yet set on `server` and `worker`; `/health/ready`
  reports `r2: disconnected` until they are. Blocked on a Cloudflare API token.
- Custom domain `policy-pilot.iangreenoughdeveloper.com` not yet attached to the
  `web` service / Cloudflare CNAME. Blocked on the same token.
