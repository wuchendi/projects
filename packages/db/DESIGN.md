# @cdlab/db — Design

> A build-only Drizzle DB factory shared by every SQLite-backed app in the
> monorepo. It resolves one of two drivers — Cloudflare D1 or libSQL/Turso — at
> request time from a normalized env, caches the built client per app, and
> exposes a driver-agnostic `Db` type plus the soft-delete / expiry query
> helpers. It owns **no** schema, no migrations, and no runtime — the consuming
> app supplies the schema and decides, by *which entry it imports*, whether the
> code runs on Node or the Workers edge.

This is the authoritative design spec; the implementation follows it. Section
numbers are stable anchors — source doc-comments and reviews reference them as
`design §N`. The package exists to delete the divergent, hand-rolled
`DatabaseManager` / `getDb` copies that `dropply-api`, `flnk`, and `wepush` each
carried, and to solve the OpenNext/wrangler bundling quirks (which libsql entry,
which externals) in exactly one place.

**Contents**

1. [Background & goals](#1-background--goals)
2. [Architecture](#2-architecture)
3. [Entries & the bundler boundary](#3-entries--the-bundler-boundary)
4. [Driver selection & caching](#4-driver-selection--caching)
5. [The `Db` type contract](#5-the-db-type-contract)
6. [Env surface (`DbEnv`)](#6-env-surface-dbenv)
7. [Query helpers (`./utils`)](#7-query-helpers-utils)
8. [Build & packaging](#8-build--packaging)
9. [Consuming the package](#9-consuming-the-package)

---

## 1. Background & goals

The monorepo runs three SQLite-backed apps across two drivers. Cloudflare **D1**
(the `DB` binding) is the primary target; **libSQL/Turso** (over `LIBSQL_URL` +
an auth token) is the alternative, and both run in production on Workers. A
`DB_TYPE` env var picks between them per deploy. Historically each app
re-implemented the same three things — a driver switch, a per-request client
cache, and the OpenNext-specific bundling workarounds — and the copies drifted.

`@cdlab/db` centralizes that with these goals:

- **G1 — One factory, not N copies.** A single `defineDb(schema)` → `getDb(env)`
  path every app adapts, so driver logic and caching are defined once.
- **G2 — Driver at request time.** The driver is chosen from `env.DB_TYPE` on
  each `getDb` call, never hard-wired, so one build serves both deploy modes.
- **G3 — Explicit runtime boundary.** The Node-vs-edge libsql client split is an
  explicit subpath the consumer imports, never runtime auto-detection — a wrong
  pick must fail obviously, not silently degrade.
- **G4 — Zero schema coupling.** The package is generic over `TSchema`; it never
  imports an app's schema and never ships tables or migrations.
- **G5 — Bundler-safe by construction.** `@libsql/client` and `drizzle-orm` stay
  external in the build so consumers resolve their own copies and OpenNext /
  wrangler resolve the libsql chain via the `workerd` export condition.

### Non-goals

- **Not an ORM or a schema.** It is a thin factory over Drizzle; the schema,
  tables, and relations belong to the consumer.
- **Not a migration tool.** drizzle-kit config, `db:gen`, and `cf:remotedb` live
  in the apps.
- **No runtime detection.** `/node` vs `/web` is a compile-time decision the
  consumer makes; the package will not sniff the runtime.
- **No global/shared connection pool.** Each `defineDb` closure owns its own
  cache slot — apps do not share clients.

---

## 2. Architecture

The package is three thin files over one shared core. There is no server and no
entry point of its own — every arrow below originates in a consuming app.

```
  consuming app                         @cdlab/db
  ─────────────                         ─────────
  import { defineDb }                   ┌───────────────────────────┐
  from '@cdlab/db/node'  ──────────────►│ src/node.ts               │  createClient
  (Hono / Node)                         │  defineDb = createGetDb(   │◄─ @libsql/client
                                        │    schema, createClient)   │   (native, file:)
                                        └─────────────┬─────────────┘
                                                      │
  import { defineDb }                   ┌─────────────┴─────────────┐
  from '@cdlab/db/web'   ──────────────►│ src/web.ts                │  createClient
  (Next.js / OpenNext)                  │  defineDb = createGetDb(   │◄─ @libsql/client/web
                                        │    schema, createClient)   │   (fetch/ws)
                                        └─────────────┬─────────────┘
                                                      ▼
                                        ┌───────────────────────────┐
                                        │ src/core.ts                │
                                        │  createGetDb → getDb(env)  │
                                        │  DbEnv, Db<TSchema>,        │
                                        │  per-closure client cache   │
                                        └──────┬──────────────┬──────┘
                                          drizzleD1        drizzleLibsql
                                          (env.DB)         (libsql Client)

  import { notDeleted, … } from '@cdlab/db/utils'  → src/utils.ts (pure SQL predicates)
```

**The two entries are near-identical shims.** `node.ts` and `web.ts` differ in
exactly one line — which `createClient` they import (`@libsql/client` vs
`@libsql/client/web`) — and both call `createGetDb(schema, createClient)`
(`core.ts:36`). All driver logic lives in `core.ts`; `utils.ts` is independent
and side-effect-free.

---

## 3. Entries & the bundler boundary

`package.json` declares **three subpath exports and no root export**. Each maps a
source file to ESM + CJS + `.d.mts`:

| Subpath | Source | Injected client | Target | `file:` local SQLite |
| --- | --- | --- | --- | --- |
| `@cdlab/db/node` | `src/node.ts` | `@libsql/client` (native bindings) | Plain-wrangler Hono workers (`dropply-api`), Node test runners | ✓ |
| `@cdlab/db/web` | `src/web.ts` | `@libsql/client/web` (pure fetch/ws) | Next.js / OpenNext apps (`wepush`, `flnk` (archived)) | ✗ (remote Turso only) |
| `@cdlab/db/utils` | `src/utils.ts` | — | Query helpers, anywhere | n/a |

`core.ts` is **not** a subpath — it is re-exported via `export * from './core'`
from both `node.ts` and `web.ts`, so importing either entry also yields the
`Db` / `DbEnv` types and `createGetDb`. Both entries additionally re-export
`./utils`.

**Why the split is explicit (G3).** The web client bundles cleanly under
OpenNext's esbuild because it is pure fetch/ws with no native addons; the node
client can open a `file:` SQLite database but does not bundle for the edge.
Importing the wrong one breaks either the local dev DB (node features missing on
web) or the OpenNext build (native deps under esbuild). There is no safe
auto-detect, so the choice is a deliberate import the consumer owns.

**Externalized deps are load-bearing.** The build keeps `@libsql/client` and
`drizzle-orm` **external** (they are `dependencies`, not bundled). This is
required so:

- Consumers resolve their own single copy of each (no duplicate drizzle
  instances, which would break type identity and query builders).
- The OpenNext apps' `serverExternalPackages` in `next.config.ts`
  (`@libsql/client`, `@libsql/hrana-client`, `@libsql/isomorphic-ws`) keep
  matching the import, so wrangler resolves the libsql chain via the `workerd`
  export condition instead of pulling a Node build into the Worker.

---

## 4. Driver selection & caching

The whole runtime is `createGetDb` (`core.ts:36-77`). It is a factory: called
once per app via `defineDb(schema)`, it returns a `getDb(env)` closure that owns
a single cache slot.

**Trace of a call.**

1. `defineDb(schema)` runs once at the consumer's module scope → returns `getDb`
   with a captured `cached: { key, db } | null` (`core.ts:41`), initially null.
   **One cache per `defineDb` call — i.e. one per app**, never global.
2. Per request the app calls `getDb(env)` with a normalized `DbEnv`.
3. `dbType = env.DB_TYPE || 'libsql'` (`core.ts:44`) — **libSQL is the default**.
4. Cache key (`core.ts:48-49`): `'d1'` (fixed constant) for D1, or
   `libsql:<url>` for libSQL — so a changed `LIBSQL_URL` produces a new key and
   rebuilds the client, while a stable URL reuses it. The D1 binding is stable
   per isolate, hence the fixed key.
5. **Cache hit** (`cached.key === key`) → return `cached.db` (`core.ts:51`).
6. **Miss** → switch on `dbType`:
   - **`d1`** (`core.ts:55-60`): requires `env.DB`; throws
     `D1 binding "DB" not found in env` when absent. Builds
     `drizzleD1(env.DB, { schema })`.
   - **`libsql`** (`core.ts:62-68`): builds a client via the injected
     `createLibsqlClient({ url: env.LIBSQL_URL || DEFAULT_LIBSQL_URL, authToken:
     env.LIBSQL_AUTH_TOKEN })`, then `drizzleLibsql(client, { schema })`.
   - **default** → throws `Unsupported DB_TYPE: <value>`.
7. The result is stored as `cached = { key, db }` (`core.ts:74`) and returned.

`DEFAULT_LIBSQL_URL = 'file:./src/database/data.db'` (`core.ts:34`) — the local
dev SQLite path, only reachable through the **node** entry (the web client
rejects `file:`).

**Type-launder casts.** Both branches cast through `as unknown as Db<TSchema>`
(`core.ts:59`, `:67`). `drizzleD1(...)` and `drizzleLibsql(...)` return distinct
concrete driver types; the cast unifies them onto the common `Db` supertype (§5)
so the closure has a single return type.

**Consistency note.** Because caching is keyed and per-closure, calling
`getDb(env)` with the same `DB_TYPE` (and same libsql URL) throughout an
isolate's life reuses the same client — the intended pattern in a request-scoped
Worker. Switching `DB_TYPE` between calls on the same closure is supported (the
key changes) but rebuilds and replaces the single cache slot each time; the
package does not hold both drivers simultaneously.

---

## 5. The `Db` type contract

`Db<TSchema>` (`core.ts:23-27`) is:

```ts
export type Db<TSchema extends Record<string, unknown>> =
  BaseSQLiteDatabase<'async', unknown, TSchema>
```

`BaseSQLiteDatabase<'async', …>` is the **lowest common supertype** of both
`DrizzleD1Database` and `LibSQLDatabase`. A single `Db` reference therefore
accepts either driver while keeping every *standard* query-builder method
(`select`, `insert`, `update`, `delete`, transactions, the query API) fully
typed.

**Trade-off.** Driver-specific extras are intentionally **not** on this type —
most notably `.batch` (shapes differ between D1 and libSQL). Call sites that need
them must narrow to the concrete driver type. This is deliberate: the shared
type is the safe intersection, not the union, so app code stays portable across
`DB_TYPE` unless it opts into a driver-specific feature.

`CreateLibsqlClient = (config: Config) => Client` (`core.ts:32`) is the injection
seam the two entries fill; consumers rarely name it directly.

---

## 6. Env surface (`DbEnv`)

`DbEnv` (`core.ts:10-17`) is the **entire** configuration surface — a
runtime-agnostic minimal shape each app adapts from its own source (Hono
`c.env`, OpenNext injected env / `getCloudflareContext()`, or `process.env`)
before calling `getDb`.

| Field | Type | Read at | Meaning |
| --- | --- | --- | --- |
| `DB_TYPE` | `string?` | `core.ts:44` | `'libsql'` (default) or `'d1'`; selects the driver. Anything else throws. |
| `DB` | `AnyD1Database?` | `core.ts:56,59` | Cloudflare D1 binding; **required only** when `DB_TYPE='d1'`. |
| `LIBSQL_URL` | `string?` | `core.ts:49,64` | libSQL / Turso URL; defaults to `DEFAULT_LIBSQL_URL` (`core.ts:34`). |
| `LIBSQL_AUTH_TOKEN` | `string?` | `core.ts:65` | Turso auth token for remote libSQL. |

The package declares **no Cloudflare bindings of its own** — the D1 binding is
passed in by the consumer app's `wrangler.jsonc`. There are no secrets, no vars,
and no `.dev.vars` owned here.

---

## 7. Query helpers (`./utils`)

`src/utils.ts` is a set of pure Drizzle-SQL helpers over the shared
`trackingFields` columns (`isDeleted`, `expiresAt`, `updatedAt`) that every
business table in the consuming apps carries. They contain no driver logic and
are re-exported from both entries.

| Helper | Returns | Definition |
| --- | --- | --- |
| `notDeleted(table)` | `SQL` | `eq(table.isDeleted, 0)` (`utils.ts:7`) |
| `softDelete()` | `{ isDeleted: 1, updatedAt: Date }` | soft-delete update payload (`utils.ts:14`) |
| `withNotDeleted(table, condition?)` | `SQL` | `and(notDeleted, condition)` or just `notDeleted` (`utils.ts:24`) |
| `isNotExpired(table)` | `SQL` | `or(isNull(expiresAt), gt(expiresAt, sql\`unixepoch()\`))` (`utils.ts:35`) |
| `withNotDeletedAndNotExpired(table, condition?)` | `SQL` | `notDeleted` + `isNotExpired` (+ optional condition) (`utils.ts:42`) |
| `withUpdatedTimestamp(data)` | `data & { updatedAt: Date }` | spread `data`, stamp `updatedAt` (`utils.ts:55`) |
| `isExpired(expiresAt)` | `boolean` | `Date.now() > expiresAt`; `false` when falsy (`utils.ts:65`) |

### 7.1 The seconds-vs-milliseconds contract

There are **two expiry checks with different units**, and mixing them is a bug:

- **SQL side** — `isNotExpired` compares `expiresAt` against `unixepoch()`, which
  is **seconds** (`utils.ts:36`). Use it inside a `where` clause; the stored
  `expiresAt` must be a unix-**seconds** timestamp for this to be correct.
- **JS side** — `isExpired(expiresAt)` compares against `Date.now()`, which is
  **milliseconds** (`utils.ts:67`). Use it on a value already read into JS.

Passing a seconds value to `isExpired`, or storing a milliseconds value in a
column filtered by `isNotExpired`, silently mis-classifies expiry. Keep the
column's unit consistent with the check you use against it.

---

## 8. Build & packaging

- **Bundler:** `tsdown` (`package.json:26`). `tsdown.config.ts` emits `dts: true`,
  `format: ['esm', 'cjs']`, entries `src/{node,web,utils}.ts`, and `clean` is on
  except in `--watch` mode.
- **Output:** `dist/{node,web,utils}.{mjs,cjs}` + `.d.mts`, wired to the three
  subpath exports in `package.json:8-24`.
- **Types:** `tsconfig.json` extends `@cdlab/tsconfig/utils.json`; `typecheck`
  is `tsc --noEmit` only (no emit — tsdown produces the declarations).
- **Deps:** `@libsql/client` and `drizzle-orm` are `dependencies` and kept
  **external** in the build (§3) — not bundled. `@cloudflare/workers-types`
  (for `AnyD1Database`) and `@types/node` are dev-only.

Scripts (`package.json:25-30`):

| Script | Command | Purpose |
| --- | --- | --- |
| `build` | `tsdown` | Produce `dist/` |
| `dev` | `tsdown --watch` | Incremental rebuild while editing |
| `typecheck` | `tsc --project ./tsconfig.json --noEmit` | Type-check only |
| `prepack` | `pnpm build` | Ensure `dist/` before packing |

There is **no test, lint, or deploy script** — it is a build-only library.
`pnpm install` builds it through the workspace `prepare` step in topological
order, so consumers resolve fresh output after install.

---

## 9. Consuming the package

Standard adapter pattern (each app's `src/lib/db.ts` is a thin wrapper):

```ts
import type { Db } from '@cdlab/db/web'          // or /node
import { defineDb } from '@cdlab/db/web'
import * as schema from '@/database/schema'

export type DB = Db<typeof schema>

const getDbFromEnv = defineDb(schema)             // once, at module scope

export async function getDb(env: CloudflareEnv): Promise<DB> {
  return getDbFromEnv({
    DB_TYPE: env.DB_TYPE,
    DB: env.DB,
    LIBSQL_URL: env.LIBSQL_URL,
    LIBSQL_AUTH_TOKEN: env.LIBSQL_AUTH_TOKEN,
  })
}
```

Rules for consumers:

- **Import the right entry** (§3): `/node` for Hono/wrangler + Node tests, `/web`
  for Next.js/OpenNext. Wrong entry breaks the build or local DB.
- **Call `defineDb` once**, at module scope, so the closure cache is reused
  across requests within an isolate.
- **Keep the libsql packages in `serverExternalPackages`** (OpenNext apps) so the
  externalization contract holds.
- **After editing this package, rebuild it** (`pnpm --filter @cdlab/db build`) —
  consumers resolve from `dist/`, so edits are invisible until then.
- **Mind the expiry units** (§7.1) when filtering `expiresAt`.
