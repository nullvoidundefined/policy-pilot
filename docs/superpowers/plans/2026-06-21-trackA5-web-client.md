# Track A5: Web Client Refactor + Net-New Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `apps/client/web/src` into directory/clean-code compliance: split the `lib/api.ts` god module into `api/request.ts` (transport) + per-route `api/*.ts` wrappers + `errors/ApiError.ts`; unify `context/` and `providers/` under `state/`; stand up the Vitest + Testing Library harness the web package never had; and add net-new tests across the whole surface (modules, components, and pages) so the web package clears a global 60% coverage bar.

**Architecture:** Pure internal refactor of one app surface plus net-new test scaffolding; no behavior change, no API change, no route change. The transport split mirrors Voyager (`api/request.ts` is a single transport module that sits below the per-route wrappers, exactly as `database/pool.ts` sits below repositories; R-235's one-function-per-file applies to the per-route domain wrappers, not the shared transport primitive). `AuthContext.tsx` and `QueryProvider.tsx` move verbatim into `state/` and stay single-file (Voyager's confirmed pattern; they bundle context + provider + hook + type by design). Tests are added in two waves: characterization tests against current behavior first (so the move stays green), then component/unit coverage for the refactored trees. This is one atomic PR.

**Tech Stack:** pnpm workspaces, Next.js 15 (App Router, `@/*` -> `src/*` alias), React 19, TanStack Query v5, TypeScript (bundler resolution), Vitest 3 + jsdom + Testing Library (newly added in Task 1), Playwright (E2E, already present at repo root).

## Global Constraints

- No U+2014 em dash anywhere (R-001).
- One PR, branched off updated `main`; zero stacking. Branch: `refactor/trackA5-web-client` (R-213).
- `apps/client/web/**` paths only. Do not touch `apps/server`, `apps/worker`, or `packages/*`.
- One exported function per file in `api/` route wrappers, `services/`, `clients/` (R-235); verb-noun filenames (R-217, R-232). The shared transport module `api/request.ts` is the documented carve-out (D3), like `database/pool.ts`.
- New source files get a file-level header `/** ... */` comment (R-230); test files, barrels, single-constant files, and pure type re-exports are exempt.
- No magic strings/numbers in edited code: single-use literals become a named local `const`; values used 2+ times become a module `ALL_CAPS` const (R-219).
- Tests assert behavior, not mocks (R-200). Characterization tests added in Task 2 capture current behavior verbatim and are retargeted (import paths only) when modules move.
- R-515 / gap-pattern #1: when a module moves, grep every importer AND every `vi.mock(`/`vi.importActual(` of its OLD specifier across all tests and retarget each in the same commit. Vitest silently fails to intercept a nonexistent specifier.
- Gap-pattern #2: this track adds devDependencies (test harness) and removes none; no module is converted to a re-export, so no orphaned-dep audit beyond confirming `pnpm install` resolves clean (Task 1) and `package.json` diff is intentional (Task 6).
- Per-task: `pnpm --filter policy-pilot-web test` (once the harness exists, Task 1+) plus `pnpm --filter policy-pilot-web build` green before the task's commit. Pre-push: full `pnpm test`, `pnpm build`, `pnpm run smoke` (R-507).
- Conventional commit per task; squash merge, delete branch. Never merge without explicit per-turn authorization (R-516).
- Deploy monitoring after merge: GitHub Actions, Vercel (web), health endpoints green (project CLAUDE.md).
- `git add` is scoped, never `git add -A` over the whole tree blindly: the untracked `docs/agentic-conversion-plan.md` must never be committed. Every commit uses `git add -A -- ':!docs/agentic-conversion-plan.md'`.

## Decisions (resolving spec section 10 open items)

These resolve the A5 open items in `docs/superpowers/specs/2026-06-21-convention-refactor-design.md` (section 10) using the reference-repo process. Voyager is the canonical reference (project memory `convention-reference-repos`).

- **D1. `AuthContext.tsx` stays a single file in `state/`, NOT split.** Voyager keeps `apps/client/web/src/state/AuthContext.tsx` as one module bundling the context object, the `AuthProvider`, the `useAuth` hook, the `User` type, and the `AuthContextValue` interface. R-226 (one responsibility per file) is satisfied: the file's single responsibility is "auth session state," and the hook/provider/context are one cohesive unit, not separable concerns. policy-pilot mirrors this: move `context/AuthContext.tsx` to `state/AuthContext.tsx` verbatim. The spec's "split context/provider/hook" alternative is rejected because the reference repo proves the single-file form is the standard.
- **D2. `QueryProvider.tsx` stays a single file in `state/`.** Voyager keeps `state/QueryProvider.tsx`. R-240 places stores, hooks, and context providers in `state/`; the spec's split `context/` + `providers/` dirs are the banned form. Move `providers/QueryProvider.tsx` to `state/QueryProvider.tsx` verbatim.
- **D3. `api/request.ts` is the single transport module; only the per-route domain wrappers are split one-function-per-file.** Voyager's `api/request.ts` exports `API_BASE`, `ApiError` (inlined there), `get`, `post`, `put`, `del` together as the transport primitive. R-235's one-function-per-file rule governs the per-route own-backend wrappers (R-220/R-240 `api/` modules); the shared fetch transport beneath them is the documented carve-out, exactly as `database/pool.ts` keeps `pool` + `query` + `withTransaction` together (A3 D4). So policy-pilot keeps the transport (`API_BASE`, `ensureCsrfToken`, private `request`, `get`, `post`, `del`, `uploadFile`, `streamPost`) in one `api/request.ts`, and splits the three collection route wrappers into one file each.
- **D4. `ApiError` moves to `errors/ApiError.ts`, NOT inlined in `request.ts`.** This is the one deliberate divergence from Voyager (which inlines `ApiError` in `request.ts`). Rationale: policy-pilot already established `errors/ApiError.ts` for the server in A3 (locked decision, index "Locked decisions"), and the A5 spec explicitly lists "client `errors/`" as a target. Keeping the web error type in `errors/ApiError.ts` makes the two policy-pilot surfaces consistent with each other and with R-238's sanctioned `errors/` dir. `request.ts` imports `ApiError` from `app errors/`. `errors/` holds exactly one file, so it stays a flat module folder (canonical taxonomy dir, kept even at one file per the `single-file-taxonomy-folder-convention` memory).
- **D5. Rename `createCollectionApi` -> `createCollection` and `deleteCollectionApi` -> `deleteCollection`.** The `Api` suffix is a redundant qualifier; R-232 wants verb-noun (`createCollection`, `deleteCollection`). `getCollections` is already compliant and unchanged. The sole consumer is `app/(protected)/dashboard/page.tsx`; update its import and call sites. Each wrapper becomes its own file (R-235): `api/getCollections.ts`, `api/createCollection.ts`, `api/deleteCollection.ts`.
- **D6. Coverage gate is GLOBAL: 60% across the whole `src/` tree** (user decision, 2026-06-22, overriding the scoped-to-refactored-trees alternative). The web package starts at zero tests, so this is the bulk of A5's effort: every component and every meaningful page gets net-new tests until the project clears 60%. The vitest config measures all of `src/` with a Voyager-style `exclude` list (config files, type decls, test files, `.next`, `e2e`, `public`, and the framework-managed `app/layout.tsx`/`loading.tsx`/`error.tsx`/`not-found.tsx` that carry no testable branch logic). `thresholds` are 60 (lines/statements) and calibrated floors for branches/functions (set in Task 9 from the measured numbers, never below 55, never lowered to paper over a gap). Coverage is built up across Tasks 5-8 (refactored modules, then components, then pages) and the global gate is locked in Task 9.

## File Structure

**Created source dirs/files:**

- `src/errors/ApiError.ts`: the `ApiError` class, moved from `lib/api.ts` (D4). Single-file taxonomy folder, kept foldered.
- `src/api/request.ts`: the transport module (D3) -- `API_BASE`, `ensureCsrfToken`, private `request`, `get`, `post`, `del`, `uploadFile`, `streamPost`. Imports `ApiError` from `app errors/`.
- `src/api/getCollections.ts`, `src/api/createCollection.ts`, `src/api/deleteCollection.ts`: per-route own-backend wrappers, one exported function each (R-235, D5).
- `src/state/AuthContext.tsx`: moved verbatim from `src/context/AuthContext.tsx` (D1); its `@/lib/api` import becomes `@/api/request`.
- `src/state/QueryProvider.tsx`: moved verbatim from `src/providers/QueryProvider.tsx` (D2).

**Test harness (NEW, Task 1):**

- `apps/client/web/vitest.config.ts`
- `apps/client/web/src/__tests__/setup.ts`
- `package.json` (web): add `test`/`test:coverage`/`test:watch` scripts + test devDeps.
- `apps/client/web/tsconfig.json`: add `vitest/globals` + `@testing-library/jest-dom` to `compilerOptions.types`.
- Root `package.json`: append `&& pnpm --filter policy-pilot-web run test` to the `test` script.

**Tests (NEW):**

- `src/__tests__/api/request.test.ts` (Task 2, characterization; retargeted in Task 3)
- `src/__tests__/errors/ApiError.test.ts` (Task 5)
- `src/__tests__/api/collections.test.ts` (Task 5)
- `src/__tests__/state/AuthContext.test.tsx` (Task 5)
- `src/__tests__/components/{Header,Captain,CitationPanel,ErrorBoundary}.test.tsx` (Task 6)
- `src/__tests__/app/(auth)/{login,register}.test.tsx`, `src/__tests__/app/page.test.tsx`, `src/__tests__/app/(protected)/{documents,chat}.test.tsx`, `src/__tests__/app/(protected)/layout.test.tsx` (Task 7, simpler pages)
- `src/__tests__/app/(protected)/{dashboard,collections,chat-collection}.test.tsx`, `src/__tests__/app/demo.test.tsx` (Task 8, the large interactive pages)

Test directory note: the `(auth)`/`(protected)` route-group parentheses are kept in the mirror path so each test maps unambiguously to its page; a flat `app/<name>.test.tsx` is used where the route segment alone is unique.

**Modified (import-path updates only):**

- Consumers of `@/lib/api`: `state/AuthContext.tsx` (after move), `app/demo/page.tsx`, `app/(protected)/chat/[collectionId]/page.tsx`, `app/(protected)/dashboard/page.tsx`, `app/(protected)/collections/[id]/page.tsx`.
- Consumers of `@/context/AuthContext`: `app/layout.tsx`, `app/(protected)/layout.tsx`, `app/(protected)/chat/[collectionId]/page.tsx`, `app/(protected)/dashboard/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/login/page.tsx`, `components/Header/Header.tsx`.
- Consumer of `@/providers/QueryProvider`: `app/layout.tsx`.

**Deleted:** `src/lib/api.ts` (+ dir `src/lib/`), `src/context/AuthContext.tsx` (+ dir `src/context/`), `src/providers/QueryProvider.tsx` (+ dir `src/providers/`).

---

### Task 1: Stand up the Vitest + Testing Library harness

**Files:**

- Modify: `apps/client/web/package.json` (scripts + devDeps), root `package.json` (test script), `apps/client/web/tsconfig.json`
- Create: `apps/client/web/vitest.config.ts`, `apps/client/web/src/__tests__/setup.ts`, `apps/client/web/src/__tests__/smoke.test.ts`

**Interfaces:**

- Produces: `pnpm --filter policy-pilot-web test` runs Vitest over `src/__tests__/**/*.test.{ts,tsx}` in jsdom with `@`/`@repo/types` aliases and jest-dom matchers loaded.

- [ ] **Step 1: Add test scripts and devDependencies to the web package**

In `apps/client/web/package.json`, add to `scripts` (after `format:check`):

```json
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest"
```

Add to `devDependencies` (keep the block alphabetized, R-231):

```json
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@vitejs/plugin-react": "^6.0.1",
    "@vitest/coverage-v8": "^3.2.4",
    "jsdom": "^29.0.1",
    "vitest": "^3.2.4"
```

- [ ] **Step 2: Install**

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot
pnpm install
```

Expected: lockfile updates, install resolves clean (gap-pattern #2 sanity: only intended devDeps added).

- [ ] **Step 3: Create `vitest.config.ts`** (mirrors Voyager; coverage scoped to refactored trees per D6)

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@repo/types': path.resolve(__dirname, '../../../packages/types/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      // D6: GLOBAL gate across all of src/. Exclude framework-managed
      // files with no testable branch logic (Voyager-style list).
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.config.*',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '.next/**',
        'e2e/**',
        'public/**',
        'src/__tests__/**',
        'src/app/layout.tsx',
        'src/app/**/layout.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/app/**/not-found.tsx',
      ],
      // Thresholds are locked in Task 9 from the measured run. Lines and
      // statements target 60 (project minimum); branches/functions floor
      // at 55. Never lower a threshold to mask a coverage gap (R-200).
      thresholds: {
        branches: 55,
        functions: 55,
        lines: 60,
        statements: 60,
      },
    },
  },
});
```

- [ ] **Step 4: Create `src/__tests__/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Add test types to `tsconfig.json`**

In `apps/client/web/tsconfig.json`, add a `types` array to `compilerOptions` (so `next build`'s typecheck of the test files resolves the globals and matchers):

```json
    "types": ["vitest/globals", "@testing-library/jest-dom"],
```

- [ ] **Step 6: Wire web into the root test script**

In root `package.json`, append to the `test` script so it ends with:

```
... && pnpm --filter policy-pilot-worker run test && pnpm --filter policy-pilot-web run test
```

- [ ] **Step 7: Create a smoke test to prove the harness runs**

`apps/client/web/src/__tests__/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('web test harness', () => {
  it('runs', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 8: Run the harness and the build**

```bash
pnpm --filter policy-pilot-web test
pnpm --filter policy-pilot-web build
```

Expected: test PASS (1 file, 1 test); build PASS.

- [ ] **Step 9: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "test(A5): stand up vitest + testing-library harness for web"
```

---

### Task 2: Characterization tests for current `lib/api.ts` transport

**Files:**

- Create: `apps/client/web/src/__tests__/api/request.test.ts`

**Interfaces:**

- Consumes (current): `import { ApiError, del, ensureCsrfToken, get, post, streamPost, uploadFile } from '@/lib/api'`. These tests import from `@/lib/api` as it stands today; Task 3 retargets the import to `@/api/request` and `@/errors/ApiError` without changing a single assertion.
- Each test resets module state via `vi.resetModules()` + dynamic `import('@/lib/api')` so the module-level `csrfToken` cache does not leak between cases.

- [ ] **Step 1: Write the characterization test against current behavior**

`apps/client/web/src/__tests__/api/request.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CSRF_PATH = '/api/csrf-token';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function importApi() {
  vi.resetModules();
  return import('@/lib/api');
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('get', () => {
  it('returns parsed JSON on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { get } = await importApi();

    const result = await get<{ ok: boolean }>('/widgets');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/widgets'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('throws ApiError with the server message on a non-ok response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: 'nope' }, 404));
    vi.stubGlobal('fetch', fetchMock);
    const { get, ApiError } = await importApi();

    await expect(get('/missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'nope',
    });
    await expect(get('/missing')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('post', () => {
  it('fetches a CSRF token then sends it on the state-changing request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-1' }))
      .mockResolvedValueOnce(jsonResponse({ created: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { post } = await importApi();

    const result = await post<{ created: boolean }>('/widgets', { name: 'a' });

    expect(result).toEqual({ created: true });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(CSRF_PATH),
      expect.objectContaining({ credentials: 'include' }),
    );
    const secondCallInit = fetchMock.mock.calls[1][1];
    expect(secondCallInit.method).toBe('POST');
    expect(secondCallInit.headers['X-CSRF-Token']).toBe('csrf-1');
  });

  it('clears the cached token and retries once on a 403', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-1' })) // ensureCsrfToken
      .mockResolvedValueOnce(
        jsonResponse({ error: { message: 'bad csrf' } }, 403),
      ) // attempt 0
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-2' })) // re-fetch token
      .mockResolvedValueOnce(jsonResponse({ ok: true })); // attempt 1 succeeds
    vi.stubGlobal('fetch', fetchMock);
    const { post } = await importApi();

    const result = await post<{ ok: boolean }>('/widgets', { name: 'a' });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('del', () => {
  it('returns undefined for a 204 response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-1' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const { del } = await importApi();

    const result = await del<void>('/widgets/1');

    expect(result).toBeUndefined();
  });
});

describe('uploadFile', () => {
  it('posts FormData with the CSRF token and no JSON content-type', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-1' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'doc-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const { uploadFile } = await importApi();
    const form = new FormData();
    form.append('file', new Blob(['x']), 'x.pdf');

    const result = await uploadFile<{ id: string }>('/documents', form);

    expect(result).toEqual({ id: 'doc-1' });
    const uploadInit = fetchMock.mock.calls[1][1];
    expect(uploadInit.headers['X-CSRF-Token']).toBe('csrf-1');
    expect(uploadInit.headers['Content-Type']).toBeUndefined();
  });
});

describe('streamPost', () => {
  it('returns a readable stream of the response body bytes', async () => {
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hello'));
        controller.close();
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-1' }))
      .mockResolvedValueOnce(new Response(upstream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { streamPost } = await importApi();

    const stream = await streamPost('/qa/stream', { question: 'hi' });
    const reader = stream!.getReader();
    const { value } = await reader.read();

    expect(new TextDecoder().decode(value)).toBe('hello');
  });
});
```

- [ ] **Step 2: Run, confirm PASS against current code**

```bash
pnpm --filter policy-pilot-web test -- request
```

Expected: PASS (these characterize behavior that already exists in `lib/api.ts`).

- [ ] **Step 3: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "test(A5): characterization tests for api transport"
```

---

### Task 3: Split `lib/api.ts` into `errors/`, `api/request.ts`, and per-route wrappers

**Files:**

- Create: `apps/client/web/src/errors/ApiError.ts`, `apps/client/web/src/api/request.ts`, `apps/client/web/src/api/getCollections.ts`, `apps/client/web/src/api/createCollection.ts`, `apps/client/web/src/api/deleteCollection.ts`
- Delete: `apps/client/web/src/lib/api.ts`, dir `apps/client/web/src/lib/`
- Modify (source consumers): `app/demo/page.tsx`, `app/(protected)/chat/[collectionId]/page.tsx`, `app/(protected)/dashboard/page.tsx`, `app/(protected)/collections/[id]/page.tsx`, `context/AuthContext.tsx`
- Modify (test): `src/__tests__/api/request.test.ts` (import retarget only)

**Interfaces:**

- Produces: `import { ApiError } from '@/errors/ApiError'`; `import { API_BASE, del, ensureCsrfToken, get, post, streamPost, uploadFile } from '@/api/request'`; `import { getCollections } from '@/api/getCollections'`; `import { createCollection } from '@/api/createCollection'`; `import { deleteCollection } from '@/api/deleteCollection'`. All signatures identical to today's `lib/api.ts` exports (D5 renames `createCollectionApi`->`createCollection`, `deleteCollectionApi`->`deleteCollection`).

- [ ] **Step 1: Create `errors/ApiError.ts`** (header required; class moved verbatim)

```ts
/** Typed transport error carrying the HTTP status, thrown by the api/ layer so callers can branch on status (e.g. 401 -> signed out). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

- [ ] **Step 2: Create `api/request.ts`** (header required; transport moved verbatim from `lib/api.ts` lines 1-157, minus the `ApiError` class, plus the `ApiError` import)

```ts
/** Thin fetch wrapper for the policy-pilot API: base URL, credentialed cookie auth, CSRF token handling with one retry, and JSON ApiError normalization, so callers never repeat fetch boilerplate. */
import { ApiError } from '@/errors/ApiError';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let csrfToken: string | null = null;

export async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch(`${API_BASE}/api/csrf-token`, {
    credentials: 'include',
  });
  if (!res.ok) throw new ApiError(res.status, 'Failed to fetch CSRF token');
  const data = await res.json();
  csrfToken = data.token as string;
  return csrfToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET';

  for (let attempt = 0; attempt < 2; attempt++) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.headers as Record<string, string>),
    };

    if (STATE_CHANGING_METHODS.has(method)) {
      headers['X-CSRF-Token'] = await ensureCsrfToken();
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (!res.ok) {
      if (res.status === 403) {
        csrfToken = null;
        if (attempt === 0) continue;
      }
      const body = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        body?.message ??
          body?.error?.message ??
          `Request failed (${res.status})`,
      );
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }
  throw new ApiError(403, 'CSRF validation failed');
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

export async function uploadFile<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await ensureCsrfToken();
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': token,
      },
      body: formData,
    });

    if (!res.ok) {
      if (res.status === 403) {
        csrfToken = null;
        if (attempt === 0) continue;
      }
      const body = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        body?.error?.message ?? `Upload failed (${res.status})`,
      );
    }
    return res.json();
  }
  throw new ApiError(403, 'CSRF validation failed');
}

export async function streamPost(
  path: string,
  body: unknown,
): Promise<ReadableStream<Uint8Array> | null> {
  const controller = new AbortController();
  const token = await ensureCsrfToken();

  const responsePromise = fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-Token': token,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  return new ReadableStream({
    async start(streamController) {
      try {
        const res = await responsePromise;
        if (!res.ok || !res.body) {
          streamController.close();
          return;
        }
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamController.enqueue(value);
        }
        streamController.close();
      } catch {
        streamController.close();
      }
    },
    cancel() {
      controller.abort();
    },
  });
}

export { API_BASE };
```

- [ ] **Step 3: Create the three per-route wrapper files** (D5; one exported function each, R-235; header required)

`api/getCollections.ts`:

```ts
/** Fetches the current user's collections from the policy-pilot backend. */
import { get } from '@/api/request';

export function getCollections() {
  return get<{ collections: any[] }>('/collections');
}
```

`api/createCollection.ts`:

```ts
/** Creates a collection via the policy-pilot backend. */
import { post } from '@/api/request';

export function createCollection(name: string, description?: string) {
  return post<{ collection: any }>('/collections', { name, description });
}
```

`api/deleteCollection.ts`:

```ts
/** Deletes a collection via the policy-pilot backend. */
import { del } from '@/api/request';

export function deleteCollection(id: string) {
  return del<void>(`/collections/${id}`);
}
```

- [ ] **Step 4: Delete the old module**

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot
git rm apps/client/web/src/lib/api.ts
rmdir apps/client/web/src/lib 2>/dev/null || true
```

- [ ] **Step 5: Update source consumers (gap-pattern #1)**

- `context/AuthContext.tsx:5`: `import { ApiError, get, post } from '@/lib/api';` becomes two imports: `import { get, post } from '@/api/request';` and `import { ApiError } from '@/errors/ApiError';` (sorted per the import sorter; this file is moved in Task 4 but the import retarget happens now).
- `app/demo/page.tsx:8`: `import { API_BASE } from '@/lib/api';` becomes `import { API_BASE } from '@/api/request';`.
- `app/(protected)/chat/[collectionId]/page.tsx:9`: `import { API_BASE, get } from '@/lib/api';` becomes `import { API_BASE, get } from '@/api/request';`.
- `app/(protected)/collections/[id]/page.tsx:6`: `import { del, get, post, uploadFile } from '@/lib/api';` becomes `import { del, get, post, uploadFile } from '@/api/request';`.
- `app/(protected)/dashboard/page.tsx:8-12`: replace the `{ createCollectionApi, deleteCollectionApi, getCollections } from '@/lib/api'` block with three imports and rename the call sites:
  - `import { createCollection } from '@/api/createCollection';`
  - `import { deleteCollection } from '@/api/deleteCollection';`
  - `import { getCollections } from '@/api/getCollections';`
  - In the file body, `createCollectionApi(...)` -> `createCollection(...)` and `deleteCollectionApi(...)` -> `deleteCollection(...)`. Grep to confirm:

```bash
grep -n "createCollectionApi\|deleteCollectionApi" apps/client/web/src/app/\(protected\)/dashboard/page.tsx
```

- [ ] **Step 6: Retarget the characterization test imports (gap-pattern #1)**

In `src/__tests__/api/request.test.ts`: change every `import('@/lib/api')` in `importApi()` to `import('@/api/request')`, and change `const { get, ApiError } = await importApi();` style destructures so `ApiError` comes from its own module. Concretely, replace the `importApi` helper and the two `ApiError` references:

```ts
async function importApi() {
  vi.resetModules();
  const [request, errors] = await Promise.all([
    import('@/api/request'),
    import('@/errors/ApiError'),
  ]);
  return { ...request, ApiError: errors.ApiError };
}
```

(The assertions are unchanged; only the module source moves.)

- [ ] **Step 7: Verify no stale references, then test + build**

```bash
grep -rn "@/lib/api" apps/client/web/src        # expect: no matches
grep -rn "createCollectionApi\|deleteCollectionApi" apps/client/web/src   # expect: no matches
pnpm --filter policy-pilot-web test && pnpm --filter policy-pilot-web build
```

Expected: PASS (characterization tests still green against the moved modules); build PASS.

- [ ] **Step 8: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A5): split lib/api into api/request, api/ route wrappers, errors/ApiError"
```

---

### Task 4: Unify `context/` and `providers/` under `state/`

**Files:**

- Create: `apps/client/web/src/state/AuthContext.tsx` (from `context/AuthContext.tsx`), `apps/client/web/src/state/QueryProvider.tsx` (from `providers/QueryProvider.tsx`)
- Delete: dirs `apps/client/web/src/context/`, `apps/client/web/src/providers/`
- Modify (consumers): `app/layout.tsx`, `app/(protected)/layout.tsx`, `app/(protected)/chat/[collectionId]/page.tsx`, `app/(protected)/dashboard/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/login/page.tsx`, `components/Header/Header.tsx`

**Interfaces:**

- Produces: `import { AuthProvider, useAuth } from '@/state/AuthContext'` (also exports `User`, `AuthContextValue` as today); `import { QueryProvider } from '@/state/QueryProvider'`. Behavior and exports identical (D1, D2).

- [ ] **Step 1: Move both files with git (contents unchanged; the `@/api/request` import in AuthContext was already fixed in Task 3)**

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot
mkdir -p apps/client/web/src/state
git mv apps/client/web/src/context/AuthContext.tsx apps/client/web/src/state/AuthContext.tsx
git mv apps/client/web/src/providers/QueryProvider.tsx apps/client/web/src/state/QueryProvider.tsx
rmdir apps/client/web/src/context apps/client/web/src/providers 2>/dev/null || true
```

- [ ] **Step 2: Update every consumer import (gap-pattern #1)**

Replace `from '@/context/AuthContext'` with `from '@/state/AuthContext'` in: `app/layout.tsx:3`, `app/(protected)/layout.tsx:5`, `app/(protected)/chat/[collectionId]/page.tsx:8`, `app/(protected)/dashboard/page.tsx:7`, `app/(auth)/register/page.tsx:7`, `app/(auth)/login/page.tsx:7`, `components/Header/Header.tsx:3`.

Replace `from '@/providers/QueryProvider'` with `from '@/state/QueryProvider'` in: `app/layout.tsx:4`.

- [ ] **Step 3: Verify no stale references, then test + build**

```bash
grep -rn "@/context/\|@/providers/" apps/client/web/src   # expect: no matches
test -d apps/client/web/src/context && echo FAIL || echo "no context/ dir"
test -d apps/client/web/src/providers && echo FAIL || echo "no providers/ dir"
pnpm --filter policy-pilot-web test && pnpm --filter policy-pilot-web build
```

Expected: PASS; build PASS.

- [ ] **Step 4: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "refactor(A5): unify context/ and providers/ under state/"
```

---

### Task 5: Net-new coverage for `errors/`, the route wrappers, and `state/AuthContext`

**Files:**

- Create: `apps/client/web/src/__tests__/errors/ApiError.test.ts`, `apps/client/web/src/__tests__/api/collections.test.ts`, `apps/client/web/src/__tests__/state/AuthContext.test.tsx`

**Interfaces:**

- Consumes: `@/errors/ApiError`, `@/api/getCollections`, `@/api/createCollection`, `@/api/deleteCollection` (mocking `@/api/request`), `@/state/AuthContext` + `@/state/QueryProvider`.

- [ ] **Step 1: Write the `ApiError` test**

`src/__tests__/errors/ApiError.test.ts`:

```ts
import { ApiError } from '@/errors/ApiError';
import { describe, expect, it } from 'vitest';

describe('ApiError', () => {
  it('carries status and message and is an Error', () => {
    const err = new ApiError(404, 'not found');

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(404);
    expect(err.message).toBe('not found');
  });
});
```

- [ ] **Step 2: Write the route-wrapper test** (mock the transport, assert path + method delegation)

`src/__tests__/api/collections.test.ts`:

```ts
import { createCollection } from '@/api/createCollection';
import { deleteCollection } from '@/api/deleteCollection';
import { getCollections } from '@/api/getCollections';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPost, mockDel } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockDel: vi.fn(),
}));

vi.mock('@/api/request', () => ({
  get: mockGet,
  post: mockPost,
  del: mockDel,
}));

describe('collection api wrappers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getCollections GETs /collections', () => {
    mockGet.mockReturnValue(Promise.resolve({ collections: [] }));
    void getCollections();
    expect(mockGet).toHaveBeenCalledWith('/collections');
  });

  it('createCollection POSTs name and description', () => {
    mockPost.mockReturnValue(Promise.resolve({ collection: {} }));
    void createCollection('Reports', 'Q2');
    expect(mockPost).toHaveBeenCalledWith('/collections', {
      name: 'Reports',
      description: 'Q2',
    });
  });

  it('deleteCollection DELETEs the collection by id', () => {
    mockDel.mockReturnValue(Promise.resolve());
    void deleteCollection('col-1');
    expect(mockDel).toHaveBeenCalledWith('/collections/col-1');
  });
});
```

- [ ] **Step 3: Write the `AuthContext` test** (render through the real providers, mock the transport)

`src/__tests__/state/AuthContext.test.tsx`:

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryProvider } from '@/state/QueryProvider';
import { AuthProvider, useAuth } from '@/state/AuthContext';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('@/api/request', () => ({
  get: mockGet,
  post: mockPost,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  );
}

describe('useAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within AuthProvider',
    );
  });

  it('exposes the current user once /auth/me resolves', async () => {
    mockGet.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.co', first_name: 'A', last_name: 'B', created_at: 't' },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user?.email).toBe('a@b.co');
  });

  it('treats a 401 from /auth/me as a signed-out null user', async () => {
    const { ApiError } = await import('@/errors/ApiError');
    mockGet.mockRejectedValue(new ApiError(401, 'unauthorized'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('login posts credentials and populates the user', async () => {
    mockGet.mockRejectedValue(
      new (await import('@/errors/ApiError')).ApiError(401, 'unauthorized'),
    );
    mockPost.mockResolvedValue({
      user: { id: 'u2', email: 'c@d.co', first_name: 'C', last_name: 'D', created_at: 't' },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('c@d.co', 'pw');
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/login', {
      email: 'c@d.co',
      password: 'pw',
    });
    await waitFor(() => expect(result.current.user?.email).toBe('c@d.co'));
  });
});
```

- [ ] **Step 4: Run the new tests (not the global gate yet)**

```bash
pnpm --filter policy-pilot-web test
```

Expected: all tests PASS. The global coverage gate is only expected to pass after Tasks 6-8 add component and page coverage; it is locked in Task 9. Add a `logout` assertion here (mock `window.location` and assert `post('/auth/logout')` is called) so `state/AuthContext.tsx` is fully exercised.

- [ ] **Step 5: Build**

```bash
pnpm --filter policy-pilot-web build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "test(A5): cover errors, route wrappers, and auth state"
```

---

### Task 6: Component tests (Header, Captain, CitationPanel, ErrorBoundary)

**Files:**

- Create: `src/__tests__/components/Header.test.tsx`, `src/__tests__/components/Captain.test.tsx`, `src/__tests__/components/CitationPanel.test.tsx`, `src/__tests__/components/ErrorBoundary.test.tsx`

**Interfaces:**

- Consumes: `@/components/Header/Header`, `@/components/Captain/Captain`, `@/components/CitationPanel/CitationPanel`, `@/components/ErrorBoundary/ErrorBoundary`; `Header` needs `@/state/AuthContext` mocked.

- [ ] **Step 1: Write `Header.test.tsx`** (mock `useAuth`; assert the three auth states)

```tsx
import Header from '@/components/Header/Header';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('@/state/AuthContext', () => ({ useAuth: mockUseAuth }));

describe('Header', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows Sign In and hides Dashboard when signed out', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      logout: vi.fn(),
    });
    render(<Header />);

    expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
  });

  it('shows the Dashboard link and a Log Out button when signed in', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', email: 'a@b.co' },
      isLoading: false,
      logout: vi.fn(),
    });
    render(<Header />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log Out' })).toBeInTheDocument();
  });

  it('renders neither auth control while loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      logout: vi.fn(),
    });
    render(<Header />);

    expect(screen.queryByRole('button', { name: 'Log Out' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sign In' })).toBeNull();
  });
});
```

- [ ] **Step 2: Write `Captain.test.tsx`** (cover the pose vs diverse src branches and the size map)

```tsx
import Captain from '@/components/Captain/Captain';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('Captain', () => {
  it('uses the captain pose image when a pose is given', () => {
    render(<Captain pose='hero' alt='Hero captain' />);
    const img = screen.getByAltText('Hero captain') as HTMLImageElement;
    expect(img.src).toContain('/mascot/captain-hero.png');
  });

  it('uses a diverse pilot image when diverse is set', () => {
    render(<Captain diverse alt='A pilot' />);
    const img = screen.getByAltText('A pilot') as HTMLImageElement;
    expect(img.src).toContain('/mascot/pilots/pilot-');
  });

  it('falls back to a diverse pilot when no pose is given', () => {
    render(<Captain alt='Default' />);
    const img = screen.getByAltText('Default') as HTMLImageElement;
    expect(img.src).toContain('/mascot/pilots/pilot-');
  });
});
```

- [ ] **Step 3: Write `CitationPanel.test.tsx`** (null branch + populated render + close handler)

```tsx
import CitationPanel from '@/components/CitationPanel/CitationPanel';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const citation = {
  id: 'c1',
  document_id: 'd1',
  chunk_index: 2,
  content: 'the cited text',
  filename: 'policy.pdf',
};

describe('CitationPanel', () => {
  it('renders nothing when there is no citation', () => {
    const { container } = render(
      <CitationPanel citation={null} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the filename, 1-based section, and content', () => {
    render(<CitationPanel citation={citation} onClose={vi.fn()} />);
    expect(screen.getByText('policy.pdf')).toBeInTheDocument();
    expect(screen.getByText('Section 3')).toBeInTheDocument();
    expect(screen.getByText('the cited text')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(<CitationPanel citation={citation} onClose={onClose} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Close citation panel' }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 4: Write `ErrorBoundary.test.tsx`** (children pass-through, default fallback, custom fallback)

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function Boom(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>safe</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe')).toBeInTheDocument();
  });

  it('renders the default fallback after a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("We've hit some turbulence")).toBeInTheDocument();
  });

  it('renders a custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<p>custom</p>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('custom')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the component tests + build**

```bash
pnpm --filter policy-pilot-web test -- components
pnpm --filter policy-pilot-web build
```

Expected: PASS; build PASS.

- [ ] **Step 6: Commit**

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "test(A5): cover Header, Captain, CitationPanel, ErrorBoundary"
```

---

### Task 7: Tests for the simpler pages (auth, landing, protected layout, documents, chat index)

**Files:**

- Create: `src/__tests__/app/(auth)/login.test.tsx`, `src/__tests__/app/(auth)/register.test.tsx`, `src/__tests__/app/page.test.tsx`, `src/__tests__/app/(protected)/layout.test.tsx`, `src/__tests__/app/(protected)/documents.test.tsx`, `src/__tests__/app/(protected)/chat.test.tsx`

**Shared mock pattern (every page test):**

- Mock `@/state/AuthContext` (`useAuth`) and any data hooks the page uses.
- Mock `next/navigation` (`useRouter`, `useParams`, `redirect`) where imported: `vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useParams: () => ({}), redirect: vi.fn() }))`.
- Mock `@/api/request` (and any `@/api/*` wrapper) so no real fetch runs.
- Render with the `QueryProvider` wrapper from Task 5 when the page uses TanStack Query.

> **Authoring note (R-511, TDD-gated dispatch):** the orchestrator reads each page file and writes the concrete failing test BEFORE dispatching the task, asserting the specific states listed below. The page bodies are too large to inline verbatim here; the checklist fixes exactly which branches each test must hit so the coverage contribution is deterministic.

- [ ] **Step 1: `login.test.tsx`** assert: renders the email/password form (labelled inputs); submitting calls `useAuth().login` with the entered credentials; a thrown `ApiError` renders the error message; the submit control is disabled while pending. (Covers `app/(auth)/login/page.tsx`, 95 lines.)
- [ ] **Step 2: `register.test.tsx`** assert: renders all fields (first/last/email/password); submit calls `useAuth().signup` with the four values; validation/error branch renders the API error. (Covers `app/(auth)/register/page.tsx`, 125 lines.)
- [ ] **Step 3: `page.test.tsx`** (landing) assert: hero copy and the primary CTA links render; the `Captain` mascot mounts. (Covers `app/page.tsx`, 166 lines; mock `@/components/Captain/Captain` to a stub to keep the assertion focused.)
- [ ] **Step 4: `layout.test.tsx`** (protected) assert: redirects/renders a signed-out state when `useAuth` returns no user and not loading; renders children when a user is present; renders the loading state while `isLoading`. (Covers `app/(protected)/layout.tsx`, 40 lines.)
- [ ] **Step 5: `documents.test.tsx`** and `chat.test.tsx` assert each renders its primary heading/empty-state and any redirect/guard branch. (Cover the two 26-line index pages.)
- [ ] **Step 6: Run + build + commit**

```bash
pnpm --filter policy-pilot-web test -- app
pnpm --filter policy-pilot-web build
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "test(A5): cover auth, landing, and protected index pages"
```

Expected: PASS; build PASS.

---

### Task 8: Tests for the large interactive pages (dashboard, collection, chat, demo)

**Files:**

- Create: `src/__tests__/app/(protected)/dashboard.test.tsx`, `src/__tests__/app/(protected)/collections.test.tsx`, `src/__tests__/app/(protected)/chat-collection.test.tsx`, `src/__tests__/app/demo.test.tsx`

**Shared mock pattern:** as Task 7, plus mock the `@/api/*` wrappers and `streamPost`/`get` so list/stream data is injected. Use `@tanstack/react-query` real `QueryClient` (via the Task 5 wrapper) with mocked transport so `useQuery` resolves against the mock.

> **Authoring note (R-511):** orchestrator reads each page and writes concrete failing tests before dispatch. These four pages are ~60% of the package's LOC, so they carry most of the global coverage; cover the primary branches, not every edge.

- [ ] **Step 1: `dashboard.test.tsx`** assert: loading state, empty state (no collections), populated list (mock `getCollections`), create-collection flow calls `createCollection` and invalidates/refetches, delete flow calls `deleteCollection`. (Covers `app/(protected)/dashboard/page.tsx`, 242 lines.)
- [ ] **Step 2: `collections.test.tsx`** assert: renders the collection's documents (mock `get`), the upload flow calls `uploadFile`, the delete-document flow calls `del`, and the empty/loading branches. (Covers `app/(protected)/collections/[id]/page.tsx`, 317 lines; mock `useParams` to return the `id`.)
- [ ] **Step 3: `chat-collection.test.tsx`** assert: renders the message thread, submitting a question opens a stream via `streamPost` and appends the streamed answer, a citation click opens `CitationPanel`, and the empty/initial state. (Covers `app/(protected)/chat/[collectionId]/page.tsx`, 405 lines; mock `streamPost` to return a `ReadableStream` of SSE-shaped chunks matching the page's parser.)
- [ ] **Step 4: `demo.test.tsx`** assert: the demo's scripted flow renders, the primary interaction advances state, and any `API_BASE`-driven fetch is mocked. (Covers `app/demo/page.tsx`, 441 lines; cover the main happy path and one guarded branch.)
- [ ] **Step 5: Run + build + commit**

```bash
pnpm --filter policy-pilot-web test -- app
pnpm --filter policy-pilot-web build
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "test(A5): cover dashboard, collection, chat, and demo pages"
```

Expected: PASS; build PASS.

---

### Task 9: Whole-branch verification, sweep, and PR

**Files:** none (verification + docs).

- [ ] **Step 1: Compliance greps (all must return no matches unless noted)**

```bash
cd /Users/iangreenough/Desktop/code/personal/production/policy-pilot
grep -rn "@/lib/\|@/context/\|@/providers/" apps/client/web/src     # no banned import roots
test -d apps/client/web/src/lib && echo FAIL || echo "no lib/ dir"
test -d apps/client/web/src/context && echo FAIL || echo "no context/ dir"
test -d apps/client/web/src/providers && echo FAIL || echo "no providers/ dir"
find apps/client/web/src -name '*.test.ts*' -not -path '*/__tests__/*'   # no co-located tests
```

- [ ] **Step 2: Confirm the package.json diff is intentional (gap-pattern #2)**

```bash
git diff main -- apps/client/web/package.json   # expect: only the test scripts + test devDeps added
git diff main -- package.json                   # expect: only the web test wiring appended to "test"
```

- [ ] **Step 3: Lock the global coverage gate (D6)**

```bash
pnpm --filter policy-pilot-web test:coverage
```

Expected: the `text` reporter prints whole-`src/` totals and the run passes the configured thresholds. Read the actual lines/statements/branches/functions percentages from the summary table. If lines or statements are below 60, identify the lowest-covered included file from the table and add a targeted test (return to Task 7/8's pattern) -- never lower a threshold to pass (R-200). Once green, set `vitest.config.ts` `thresholds` to the achieved floors rounded down (lines/statements no lower than 60; branches/functions no lower than 55) so CI catches regressions, and commit:

```bash
git add -A -- ':!docs/agentic-conversion-plan.md'
git commit -m "test(A5): lock global web coverage thresholds"
```

- [ ] **Step 4: Full monorepo gates**

```bash
pnpm build && pnpm test && pnpm run smoke
```

Expected: all green (the root `test` now includes `policy-pilot-web`).

- [ ] **Step 5: Lint the web package**

```bash
pnpm --filter policy-pilot-web lint
```

Expected: clean. If eslint flags import ordering on edited files, run `pnpm --filter policy-pilot-web format` and fold the result into the relevant task's commit (or a single `style(A5)` commit if already pushed).

- [ ] **Step 6: Format scratch + open PR**

```bash
npx prettier --write '.superpowers/**/*.md' 2>/dev/null || true
git push -u origin refactor/trackA5-web-client
```

Write the PR doc at `docs/prs/2026-06-22-trackA5-web-client.md` (summary; what-changed; decisions D1-D6 with chosen-vs-alternative-vs-why; testing including the achieved global coverage numbers; reflection) before opening. Open the PR; request Copilot review via the Reviewers panel UI (the API reviewer add is unavailable in this repo) or skip with user authorization. Do NOT merge without explicit per-turn authorization (R-516). After merge, monitor GitHub Actions + Vercel (web) + health endpoints.

- [ ] **Step 7: Update the master index**

In `docs/superpowers/plans/2026-06-21-convention-refactor-index.md`, set the A5 row Status to "Shipped (#NN, deployed)" once merged and deployed.

---

## Self-Review

**1. Spec coverage** (spec section "A5: Web client refactor + net-new tests"):

- "`lib/api.ts` splits into `api/request.ts` (transport) + per-route `api/*.ts` wrappers + client `errors/`": Tasks 3 (request.ts, getCollections/createCollection/deleteCollection, errors/ApiError). Covered.
- "`context/` + `providers/` unify under `state/`": Task 4. Covered.
- "Split `AuthContext.tsx` per the reference pattern (confirm Voyager...)": resolved as D1 -- Voyager keeps it single-file in `state/`, so it is moved, not split (documented divergence from the spec's split alternative, reference-repo-justified). Covered.
- "Establish `src/__tests__/` mirror": Tasks 1-8 create `src/__tests__/{api,errors,state,components,app}`. Covered.
- "Add net-new tests: characterization first, then component/unit; target 60%": Task 2 (characterization), Task 5 (refactored modules), Task 6 (components), Tasks 7-8 (pages). D6 makes the 60% gate GLOBAL across `src/` (user decision), locked in Task 9. Covered.
- "Done when: no `lib/`, no split `context/`+`providers/`, `__tests__/` populated, coverage threshold met, suite green": Task 9 greps + global gate. Covered.

**2. Placeholder scan:** `request.ts` and `ApiError` bodies are reproduced verbatim from the current `lib/api.ts`. The transport (Task 2), refactored-module (Task 5), and component (Task 6) tests contain complete, runnable code. The page tests (Tasks 7-8) are specified as exact mock pattern + per-page behavior checklists rather than inlined bodies, because the page sources (95-441 lines each) are too large to reproduce here and would go stale; per R-511 the orchestrator reads each page and authors the concrete failing test before dispatching that task, and the global coverage gate (Task 9) is the mechanical check that the tests actually exercise the code. This is a deliberate, noted deviation from full inlining, not an accidental placeholder. The one `any` retained (`getCollections`/`createCollection` return types) is copied verbatim from the existing source, not introduced; tightening it is out of A5 scope.

**3. Type consistency:** `ApiError(status: number, message: string)` identical across `errors/ApiError.ts`, `request.ts` throw sites, and every test. Transport exports (`API_BASE`, `ensureCsrfToken`, `get`, `post`, `del`, `uploadFile`, `streamPost`) match between `api/request.ts`, the consumers, and the characterization test's destructure. `getCollections`/`createCollection`/`deleteCollection` names match between their files (Task 3), the dashboard consumer (Task 3 Step 5), and the wrapper test (Task 5). `useAuth`/`AuthProvider`/`QueryProvider` names match between `state/` modules (Task 4) and the auth test (Task 5).

**4. Gap-pattern pre-flight (project memory `refactor-plan-gap-patterns`):**

- #1 (mock/import sites of moved modules): the only test touching moved modules before its own move is `request.test.ts`, whose `import('@/lib/api')` is retargeted to `@/api/request` + `@/errors/ApiError` in Task 3 Step 6. New tests (Task 5) `vi.mock('@/api/request', ...)` against the post-split path. Source importers of all three moved roots (`@/lib/api`, `@/context/AuthContext`, `@/providers/QueryProvider`) are enumerated per task (Task 3 Step 5, Task 4 Step 2) and grep-verified (Task 3 Step 7, Task 4 Step 3, Task 9 Step 1). Covered.
- #2 (orphaned deps): no module becomes a re-export; the only dependency change is adding the test harness devDeps, verified intentional in Task 9 Step 2. Covered.

**5. Reference-repo fidelity:** `api/request.ts` single-module form, `state/AuthContext.tsx` + `state/QueryProvider.tsx` single-file form, and `vitest.config.ts`/`setup.ts` shape all mirror Voyager (`/Users/iangreenough/Desktop/code/personal/production/voyager/apps/client/web`). The sole intentional divergence is D4 (`ApiError` in `errors/` not inlined), justified by policy-pilot's own A3 server precedent and the explicit spec target.
