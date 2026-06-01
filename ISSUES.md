# Issues / Deferred Work

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
