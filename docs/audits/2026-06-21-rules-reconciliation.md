# Rules Reconciliation Audit (Track B input)

- **Date:** 2026-06-21
- **Purpose:** Per-rule compliance of the two reference repos, feeding the `~/.claude` rule re-derivation.
- **Repos:** Doppelscript (DS), post-merge Voyager (VY).

## Headline

The earlier assumption that Doppelscript is the clean reference is wrong. Post-merge Voyager is the cleaner repo on most directory/clean-code axes. Doppelscript still carries the violations its convention-cleanup branch never merged. Neither repo is spotless; the rule text has real gaps around `errors/`, `resilience/`, and the factory+singleton client pattern.

## Per-rule summary (only rules with a finding)

| Rule        | Requires                                     | DS                                                                                          | VY                                                                     | Agree   |
| ----------- | -------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------- |
| R-217       | Specific filenames, no vague single-word     | comply                                                                                      | diverge: `handlers/chat/helpers.ts` (8 exports)                        | no      |
| R-220/R-238 | No `lib/`/`utils/`; fixed server vocab       | diverge: server `utils/` (15 files), web `lib/`+`utils/`                                    | comply (added `errors/`, `resilience/`)                                | no      |
| R-222       | clients = one provider; one concern          | partial                                                                                     | diverge: `AgentOrchestrator.ts` 7 symbols                              | no      |
| R-223       | No single-file folders                       | diverge: 4 (`utils/logs/`, `utils/prompt/`, `utils/editIntent/`, `utils/parseUserStories/`) | comply                                                                 | no      |
| R-226       | One responsibility per file                  | diverge                                                                                     | diverge: `helpers.ts` 8 concerns                                       | both    |
| R-235       | One exported fn per file in services/clients | diverge: `clients/stripe.ts`, `clients/email.ts`                                            | diverge worse: `clients/redis.ts` 3 fns, `cacheService.ts` 5           | no      |
| R-236       | `@repo/*` scope, canonical names             | comply (5 pkgs `@repo/*`)                                                                   | partial: stale `packages/shared-types/` dir lingers                    | partial |
| R-237       | camelCase non-URL dirs                       | diverge: `features/document-type/`                                                          | comply                                                                 | no      |
| R-238       | Fixed server vocab; domain-named extras only | diverge: `utils/`                                                                           | extend: `errors/`, `resilience/` (generic, not domain)                 | no      |
| R-239       | Single `__tests__/` tree                     | partial: `__tests__/utils/` mirrors banned tree                                             | comply                                                                 | no      |
| R-240       | Web client fixed vocab                       | diverge: `lib/`, `utils/`, no top-level `api/`                                              | diverge: missing `config/`/`constants/`/`clients/`, has correct `api/` | no      |
| R-241       | Regroup flat dirs over 20 modules            | diverge: `repositories/` 34, `routes/` 24, `handlers/` 22                                   | comply                                                                 | no      |

Rules R-218, R-219, R-224, R-225, R-228, R-229, R-230, R-231, R-232, R-233 comply in both repos. R-234 not statically verifiable.

## Decision-bearing divergences

These need a ruling before Track B edits and before policy-pilot's A-phases lock paths.

### 1. `errors/` and `resilience/` (R-238 gap)

VY introduced top-level `errors/` (`ApiError.ts`) and `resilience/` (`CircuitBreaker.ts`). R-238 allows extra dirs only when "named for a real domain responsibility." These are generic concepts. Options:

- (a) Sanction `errors/` and `resilience/` explicitly in R-238 (codify VY).
- (b) Map them into existing vocab: `ApiError` to `types/` (it is a class/type), `CircuitBreaker` to `clients/` (a stateful singleton, which R-220 already covers).
- Bears on policy-pilot: where does the server `ApiError` land in A3?

### 2. R-235 factory + singleton pattern

Both repos export `createXClient` + an `xClient` singleton (and sometimes a type) from one `clients/` file. R-235 says one exported function per file. Either this is a sanctioned exception or both repos must split. Options:

- (a) Add an explicit R-235 exception for a factory plus its singleton plus its type in one client module.
- (b) Hold the rule; both repos split (large churn, low value).

### 3. Doppelscript's unmerged cleanup (R-220, R-223, R-237, R-241)

DS violations are exactly the work its `teardown-lib-utils` branch began and never merged. The user asked that the rules reflect the current state of both repos. The rules already describe the target; DS simply has not caught up. Options:

- (a) Leave DS; rules stay as the target (DS is just behind).
- (b) Open a separate DS cleanup effort (out of this scope).

### 4. Voyager residue (R-217, R-226, R-235, R-236)

VY has `handlers/chat/helpers.ts` (8-export god file), `clients/redis.ts` (3 functions), and a stale `packages/shared-types/` dir. Small, real, and out of this refactor's scope, but they mean "rules reflect VY exactly" is not literally achievable without also fixing VY.

## Implication for the spec

The spec's "Doppelscript is canonical / its utils is the lone laggard" framing understated DS's gaps. The accurate framing: the rule text is the target; Voyager is the closer embodiment; Doppelscript trails. policy-pilot should target the rule text (as amended by decisions 1 and 2), not mirror either repo file-for-file.
