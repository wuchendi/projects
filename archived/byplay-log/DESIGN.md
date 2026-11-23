# byplay-log — Design

> A single-endpoint telemetry sink for the ByPlay video player: a Hono
> Cloudflare Worker that accepts a **batch (array) of playback events**,
> validates each against a zod schema, enriches every row with edge-derived
> request metadata (IP / User-Agent / country), and commits the batch to a
> SQLite-family database (D1 or LibSQL/Turso) in a single atomic insert.

This is the authoritative design spec; the implementation follows it. Section
numbers are stable anchors. The design's whole reason for existing is the tension
in §4: keep the columns worth querying stable while letting the player's event
payloads evolve without a migration.

**Contents**

1. [Background & goals](#1-background--goals)
2. [Architecture](#2-architecture)
3. [The ingest pipeline](#3-the-ingest-pipeline)
4. [Data model](#4-data-model)
5. [Database driver](#5-database-driver)
6. [Logging & error envelopes](#6-logging--error-envelopes)
7. [Configuration & deployment](#7-configuration--deployment)

---

## 1. Background & goals

The ByPlay player reports playback telemetry — buffering, stalls, runtime config,
per-segment progress — as batches of events. The reporting shape is not stable:
the player adds runtime fields over time. The sink must be queryable on a few
stable dimensions yet tolerant of an evolving payload, and it must not trust the
client for anything it can read at the edge.

- **G1 — Stable query keys, flexible payloads.** The dimensions worth indexing
  are real columns; the volatile runtime shapes are JSON columns, so the player
  can add fields with **no schema migration**.
- **G2 — Server-authoritative metadata.** The visitor IP, User-Agent, and country
  come from the edge request, never from the client body — unspoofable, and the
  client doesn't have to send them.
- **G3 — Batch-atomic ingest.** One request = one array = one insert. A validation
  or DB error rejects the whole batch (a `400` or `500`); there is never a
  partial write to reconcile.
- **G4 — One Worker, dual driver.** Runs on Cloudflare Workers against D1 or a
  LibSQL/Turso database, selected at deploy time by `DB_TYPE`.

### Non-goals

- **Not a read API.** This Worker only ingests. Reads happen directly against the
  database (drizzle-studio, external dashboards) — there is no query endpoint.
- **Not multi-tenant / authenticated.** A single dataset for one player; the only
  access control on `/monitor` is the CORS origin allow-list. No per-owner
  scoping.
- **No retention job.** `isDeleted` exists per the shared `trackingFields`
  convention, but nothing in this service soft-deletes or prunes; rows accumulate
  until pruned externally.

---

## 2. Architecture

```
                         Cloudflare edge
  player ─ POST /monitor ─►┌──────────────────────────────────────┐
                           │ src/index.ts (Hono app)              │
  ops ──── GET / ─────────►│  accesslog → prettyJSON → requestId  │
                           │  → cors → route('/', monitorRoutes)  │
                           └──────────────┬───────────────────────┘
                                          │ useDrizzle(c)
                                          ▼
                              DatabaseManager (src/lib/db.ts)
                                   │                 │
                              D1 binding        LibSQL / Turso
                              (DB, "byplay")     (LIBSQL_URL)
                                   └────── player_logs ──────┘
```

**Entry.** `src/index.ts` default-exports `{ fetch: app.fetch }` (declared as
`main` in `wrangler.jsonc`). It is a Hono Worker on the **edge** runtime,
`compatibility_flags: ["nodejs_compat"]` — the flag plus `@types/node` exist so
the winston / libSQL Node code paths compile and `process.env` is readable.

**Middleware chain** (runs for every request, in order): `hono/logger` wrapped by
`customLogger` (routes access lines through the global `logger`) → `prettyJSON`
→ `requestId` → `cors`. Then `monitorRoutes` mounts at `/`, and a health/info
`GET /` is registered.

**Two surfaces, no auth context.** `GET /` (health) and
`POST /monitor?bury_content=<tag>` (ingest). Neither is authenticated; the only
gate is the CORS allow-list (`https://byplay.pages.dev`, `http://localhost:3016`,
`credentials: true`).

**Global handlers.** `onError` and `notFound` return a consistent
`{ code, message, stack? }` envelope, with `stack` (split into lines) only when
`isDebug`.

---

## 3. The ingest pipeline

**Entry:** `monitorRoutes.post('/monitor', …)` in `src/routes/monitor.ts`. A
request flows through fixed stages, each able to short-circuit with a `400`/`500`:

```
POST /monitor?bury_content=<tag>
  1. useDrizzle(c)                     obtain the DB handle
  2. require bury_content query param  → 400 "Missing bury_content parameter"
  3. read edge headers                 ip = CF-Connecting-IP → X-Forwarded-For → X-Real-IP
                                        ua = User-Agent ; country = CF-IPCountry
  4. c.req.json()                      → 400 "Invalid JSON body" on parse failure
  5. PlayerLogsArraySchema.safeParse   → 400 "Invalid log data format" + error.issues
  6. map each event → NewPlayerLog     (see §3.2)
  7. db.insert(playerLogs).values([…]) single atomic batch
       ok    → { code: 0, message: 'ok' }
       throw → 500 "Database insertion failed"
```

An outer `try/catch` wraps the whole handler and returns a `500 Internal server
error` for anything unhandled.

### 3.1 Request schema

`PlayerLogSchema` (per event) requires `time` (number), `userId` (number),
`userIdUuid`, `streamId`, `version`; optional `UA`, `vendor`, `platform`,
`feature` (**a JSON string**), `vplayerRuntime`, `playerRuntime`,
`executeProgressInfos`. `playerConfig` is an object with optional `topicId`/`env`
plus `.catchall(z.unknown())` so unknown config keys pass through.
`PlayerLogsArraySchema` is `z.array(PlayerLogSchema)` — **the body must be an
array**, even for one event.

### 3.2 Event → row mapping

Each validated event becomes a `NewPlayerLog`:

- `topicId` is **lifted out of `playerConfig.topicId`** (`?? null`) into its own
  indexed column, while the full `playerConfig` is also stored as JSON.
- `feature` arrives as a **JSON string** and is `JSON.parse`d into an object
  before storage. **Parse failure is non-fatal**: it logs a `console.warn` (note:
  not the global `logger`) and stores `null` for that row — the row is still
  inserted.
- `ua` is mapped from the event's `UA` field; `ipAddress`/`userAgent`/`country`
  come from the edge headers read in step 3, not the body.

### 3.3 Batch atomicity & status codes

All rows insert in one `values([...])` call — any row error fails the entire
batch with a `500`, so there is no partial write (reinforcing G3 at the DB layer).
The success response uses an **app-level code** `code: 0` distinct from the HTTP
`200`; error envelopes reuse the HTTP status as `code` (`400`/`500`).

---

## 4. Data model

Drizzle over SQLite (`src/database/schema.ts`), one table `player_logs`, SQL in
`0000_mysterious_shape.sql`. Autoincrement integer `id` PK.

| Group | Columns | Rationale |
| --- | --- | --- |
| Identity | `userId` (int, notNull), `userIdUuid` (notNull), `streamId` (notNull), `topicId` (int) | The query keys (`userId` / `streamId` indexed, §4.2). `topicId` is denormalized out of `playerConfig`. |
| Event | `time` (int, notNull), `version` (notNull), `ua`, `vendor`, `platform` | Reported timestamp + client identity. |
| Flexible (JSON) | `feature`, `playerConfig`, `vplayerRuntime`, `playerRuntime`, `executeProgressInfos` | `text` with `mode: 'json'` — evolving player runtime shapes (§4.1). |
| Request metadata | `buryContent` (notNull), `ipAddress`, `userAgent`, `country` | Edge-derived; `buryContent` is the event-type tag from the query string. |
| Tracking mixin | `createdAt`, `updatedAt` (both auto via `$defaultFn`/`$onUpdateFn`), `isDeleted` (int, default 0) | Shared monorepo convention; **soft-delete is not enforced anywhere in this service** (§1 non-goals). |

### 4.1 Why JSON columns

The five JSON columns absorb the player's evolving runtime payloads. Storing them
as `text` with `mode: 'json'` means Drizzle serializes/parses transparently and
the player can add nested fields with no `ALTER TABLE`. The trade-off — no
per-field indexing inside those blobs — is acceptable because every dimension the
sink queries on is promoted to a real column.

### 4.2 Indexes

Six indexes: `userId`, `streamId`, `time`, `buryContent`, `createdAt`, and the
composite `(userId, streamId)`. These match the read patterns (per-user,
per-stream, per-event-type, time-ranged) that downstream dashboards run directly
against the database — this service exposes no read API of its own.

---

## 5. Database driver

`src/lib/db.ts` hosts a `DatabaseManager` **singleton** with a `useDrizzle(c)`
factory. It is a hand-rolled dual-driver manager local to this app (it does not
use `@cdlab/db`).

- **`DB_TYPE=libsql`** (default in the worker read) → `@libsql/client`
  `createClient({ url: LIBSQL_URL, authToken })`, wrapped by drizzle-libsql.
  `LIBSQL_URL` defaults to `file:./web/database/data.db`.
- **`DB_TYPE=d1`** → requires `c.env.DB`; wrapped by drizzle-d1. Throws
  `D1 database not found in context` if the binding is absent.

### 5.1 Singleton caveat (edge)

The manager caches the **first-constructed** instance on a static field. On the
first request in an isolate the constructor binds the driver (for D1, from
`c.env.DB`); every later request reuses that instance and **ignores the new
context**. For D1 the binding is stable per isolate, so this works — but the DB
handle is effectively captured from whichever request warmed the isolate. Do not
rely on per-request binding differences.

### 5.2 Config read from `process.env`

The manager reads `DB_TYPE` / `LIBSQL_URL` / `LIBSQL_AUTH_TOKEN` from
`process.env` at the edge. This works because `wrangler.jsonc` `vars` are injected
and `nodejs_compat` is on. With `DB_TYPE=d1` the libSQL branch is skipped, so
`@libsql/client` is never instantiated on the worker.

### 5.3 drizzle-kit config divergence

`drizzle.config.ts` selects `turso` (libsql) or `sqlite` + `d1-http` (d1) by
`DB_TYPE`, and reads `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_DATABASE_ID` /
`CLOUDFLARE_API_TOKEN` for the remote D1 driver. Two known divergences from the
worker: `DB_TYPE` defaults differ (`libsql` in worker, `d1` in `wrangler.jsonc`),
`LIBSQL_URL` defaults differ (`file:./web/database/data.db` in worker vs
`file:./src/database/data.db` in drizzle-kit), and `CLOUDFLARE_DATABASE_ID` is
required by drizzle-kit but absent from `.env.example` — export it before running
`db:*` against a remote D1.

---

## 6. Logging & error envelopes

`src/global.ts` is imported for side effects from `index.ts`; it installs
`globalThis.logger` and `globalThis.isDebug` (`isDebug = NODE_ENV === 'dev'`).

**Logger split by `DEPLOY_RUNTIME`:**

- `cf` → a thin `console.*` wrapper (debug gated by `isDebug`). File rotation is
  impossible on Workers, so this is the production path.
- otherwise (`node`) → winston with a colorized Console transport **and** a
  `winston-daily-rotate-file`. Gotcha: the rotate filename is hardcoded
  `logs/dropply-%DATE%.log` — a copy-paste leftover from `dropply-api`, not
  `byplay`.

**Error envelopes.** `onError` distinguishes `HTTPException` (logs a warning,
returns its status as `code`) from unhandled errors (`500`). `notFound` returns
`{ code: 404, message: 'Not Found' }`. `stack` (line-split) is included only when
`isDebug`. Note the health `GET /` reports a hardcoded `version: '1.0.0'`, which
differs from the package version `0.1.0`.

---

## 7. Configuration & deployment

### 7.1 Config

Runtime knobs are `vars` in `wrangler.jsonc`, mirrored in `.env.example`, read
from `process.env`:

| Var | Role | Read at |
| --- | --- | --- |
| `DEPLOY_RUNTIME` | logger selection (`cf` / `node`) | `src/global.ts` |
| `DB_TYPE` | driver (`d1` / `libsql`) | `src/lib/db.ts`, `drizzle.config.ts` |
| `LIBSQL_URL` / `LIBSQL_AUTH_TOKEN` | LibSQL/Turso connection | `src/lib/db.ts`, `drizzle.config.ts` |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` | remote-D1 drizzle-kit | `drizzle.config.ts` |
| `CLOUDFLARE_DATABASE_ID` | remote-D1 drizzle-kit (**not** in `.env.example`) | `drizzle.config.ts` |
| `NODE_ENV` | `=== 'dev'` → `isDebug` | `src/global.ts` |

### 7.2 Bindings

- **D1** `DB`, `database_name: "byplay"`, `migrations_dir: "./src/database"`.
- **Observability** enabled, `head_sampling_rate: 1`.
- KV, R2, and AI blocks exist but are commented out.

### 7.3 Deploy & migrations

Deploy with `wrangler deploy --minify` (`pnpm --filter @cdlab/byplay-log deploy`);
`wrangler` bundles `src/index.ts` directly, so the `bun build` `build` script
(`--outdir dist --target browser`) only emits a standalone `dist/` bundle and is
not part of deployment.

Migrations are generated from `schema.ts` with drizzle-kit (`db:gen`) and applied
with `cf:localdb` (local) / `cf:remotedb` (`--remote`). Because the D1 path uses
the `sqlite` dialect, schema changes must avoid statements D1 rejects (e.g.
`ALTER COLUMN`). `cf-typegen` regenerates the `CloudflareBindings` interface.
