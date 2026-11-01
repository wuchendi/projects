# flnk

Privacy-first link shortener with **geo / device routing**, styled QR codes,
password + safety gates, link-in-bio pages, and self-hosted analytics — one
Next.js app running entirely on **Cloudflare Workers**.

```diff
- long.example.com/products/2026/summer-sale?utm_campaign=…   # unshareable, untrackable-by-you
+ flnk.sh/sale        308 · geo-routed · click-tracked · no third-party trackers
```

Preview: <https://flnk.cdlab.workers.dev/>

![](https://cdn.jsdelivr.net/gh/cdLab996/picture-lib/wudi/flnk/index.png)

Every redirect resolves at the edge from a KV cache with a D1 fallback; every
click is logged to **Cloudflare Analytics Engine** with the raw IP hashed on the
way in — so you get per-link geo / device / referrer analytics without ever
storing a visitor's IP or shipping data to an analytics vendor.

## Why

Off-the-shelf shorteners make you choose between control and privacy: the hosted
ones track your visitors for you, the self-hosted ones are a VM you babysit.
`flnk` is neither — it's a single Worker you deploy to your own Cloudflare
account:

- **Server-authoritative redirects** — the destination, routing rules, and gates
  live in D1, not in the URL. Change where a link points without reissuing it.
- **Routing built in** — one short link can send visitors to different
  destinations by **country** (`request.cf.country`) or **device** (iOS → App
  Store, Android → Play Store), with UTM / query passthrough.
- **Analytics you own** — clicks land in *your* Analytics Engine dataset. The
  visitor IP is HMAC-hashed with a daily-rotating salt before storage, so
  uniqueness counts work but the raw IP is never persisted or recoverable.
  Owner-scoping begins at deploy time: every data point is tagged with an owner
  key (`blob20`) and dashboard queries filter by it, so clicks recorded before
  this deploy carry no owner tag, never surface in your dashboard, and age out
  of Analytics Engine's retention on their own.
- **Gates, not dead ends** — a link can require a password, show a safety
  interstitial, cloak behind an OG preview, or expire after N clicks — all
  enforced at the edge before the redirect fires.
- **One binary, no servers** — Next.js compiled through
  [OpenNext](https://opennext.js.org/cloudflare) to a single Worker; D1 + KV +
  Analytics Engine are the only moving parts, and R2 is optional.

## Features

| Area | What you get |
| --- | --- |
| **Redirect** | Configurable `308` / `307` / `302`, per-colo rate limiting, negative caching, case-(in)sensitivity, `?query` passthrough. |
| **Routing** | Per-country destinations, iOS / Android overrides — evaluated at the edge from one row. |
| **Gates** | Argon2id link passwords, "unsafe link" interstitial, OG cloaking, click-count expiry, time expiry, pause toggle. |
| **QR** | Per-link styled QR (colors, logo, dot / corner style, error level); scans are tagged `source=qr` in analytics. |
| **Analytics** | Country / region / city / referrer / device / OS / browser / language breakdowns, realtime feed, geo map, CSV export — from your own dataset. |
| **Launchpads** | Hosted link-in-bio / landing pages at `/m/<slug>` with a themable block editor; buttons reference short links, so clicks reuse their stats. |
| **AI** | Optional slug suggestions and OG title / description generation via Workers AI. |
| **Ops** | Daily cron: R2 backup + soft-delete of expired links; link health checks (reachability + Safe Browsing via DoH); Sink import / export. |
| **Auth** | better-auth social login (Google / GitHub) with an email allow-list; every `/api/*` route is session-gated server-side. |
| **i18n** | English + Chinese (`next-intl`) with a cookie-based locale, so it never collides with the root `[slug]` route. |

## Quick start

`flnk` is part of the [`@cdlab/projects-monorepo`](../../README.md); run everything
from the repo root.

```bash
pnpm install                          # builds workspace packages too
pnpm --filter @cdlab/flnk cf:localdb  # apply D1 migrations to the local DB
pnpm --filter @cdlab/flnk dev         # -> http://flnk.localhost:3355
```

The dev URL is fixed by [`@dotns/nsl`](https://github.com/dotns/nsl) — no port
hunting. The dashboard lives at `/dashboard`; short links resolve at the root
(`/<slug>`), launchpads at `/m/<slug>`.

Before you can sign in, set the auth secrets in `.dev.vars` (see
`.dev.vars.example`): `BETTER_AUTH_SECRET`, at least one Google / GitHub client
id + secret pair, and — recommended — `ALLOWED_EMAILS` so only you can register.

## How a redirect resolves

```
GET /<slug>
  1. reserved-slug + rate-limit + slug-shape guards         reject early
  2. resolveLink: KV cache → D1 fallback → backfill cache    negative-cached on miss
  3. expiry / disabled / click-cap checks                    purge cache, serve 404
  4. password gate?      → serve form / verify (Argon2id)    per-IP attempt limit
  5. cloaking / crawler? → serve OG HTML instead of 3xx
  6. unsafe link?        → serve confirm interstitial
  7. resolveDestination: geo → device → query passthrough
  8. writeAccessLog (waitUntil, off the critical path)       IP hashed, never stored raw
  9. 308 Location: <destination>
```

Steps 1–3 are the hot path most requests take; the KV read is the only I/O for a
cached, gate-free link.

```mermaid
flowchart TD
    A["GET /:slug"] --> B{"KV positive cache"}
    B -->|hit| R["3xx redirect + async access log"]
    B -->|miss| C{"KV negative cache"}
    C -->|hit| N["404 — known-missing slug, D1 skipped"]
    C -->|miss| D["D1 lookup"]
    D -->|"found & live"| E["fill positive cache"]
    E --> R
    D -->|"not found"| F["seed negative cache (short TTL)"]
    F --> N
```

The full model — every gate, its ordering rationale, and the security reasoning —
is in [`DESIGN.md`](DESIGN.md).

## Slugs

A short link's slug comes from one of three paths:

- **Auto** (default) — a random slug over an unambiguous alphabet (no `0/o/1/l/i`),
  6 chars by default, allocated race-safely (`onConflictDoNothing` + an
  escalating-length retry, so concurrent creates never collide).
- **Custom** — a slug you choose; it's validated, and a previously deleted one is
  revived in place.
- **AI-suggested** — an opt-in Workers-AI suggestion derived from the destination
  URL (prompt-injection-guarded, KV-cached), which the dashboard submits as a
  custom slug.

Details in [`DESIGN.md`](DESIGN.md#64-slug-allocation).

## Configuration

All knobs are `vars` in [`wrangler.jsonc`](wrangler.jsonc); reads go through a
single validated config (`src/lib/platform/env.ts`). Secrets are **never** vars —
set them in `.dev.vars` (local) or via `wrangler secret put` (prod).

| Var | Default | Meaning |
| --- | --- | --- |
| `DB_TYPE` | `d1` | Driver: `d1` (the `DB` binding) or `libsql` (Turso, via `LIBSQL_URL` + token). |
| `REDIRECT_STATUS_CODE` | `308` | Redirect status for a normal click. |
| `LINK_CACHE_TTL` | `60` | KV positive-cache TTL (seconds; floored to 60 by KV). |
| `NEGATIVE_CACHE_TTL` | `60` | Tombstone TTL for missing slugs (`0` disables; blocks cache-penetration scans). |
| `REDIRECT_WITH_QUERY` | `false` | Forward the incoming `?query` onto the destination (per-link overridable). |
| `CASE_SENSITIVE` | `false` | Treat `/AbC` and `/abc` as distinct slugs. |
| `SLUG_DEFAULT_LENGTH` | `6` | Length of an auto-generated slug. |
| `NOT_FOUND_REDIRECT` | *(empty)* | Where to send an unknown slug (empty = plain `404`). |
| `HOME_URL` | *(empty)* | Optional redirect for the bare root. |
| `RESOLVE_RATE_LIMIT_ENABLED` | `true` | Per-IP rate limit on the resolve path (fails open if the binding is absent). |
| `DATASET` | `flnk_analytics` | Analytics Engine dataset name. |
| `DISABLE_BOT_ACCESS_LOG` | `false` | Skip logging obvious bot traffic. |
| `CLOUDFLARE_ACCOUNT_ID` | — | Account id for the Analytics Engine SQL API (dashboard reads). |
| `SAFE_BROWSING_DOH` | *(empty)* | DoH resolver for link health checks (empty = disabled). |
| `AI_MODEL` | `@cf/meta/llama-3.1-8b-instruct` | Workers AI model for slug / OG generation. |

**Secrets** (`.dev.vars` / `wrangler secret put`): `BETTER_AUTH_SECRET`,
`GOOGLE_CLIENT_ID` / `SECRET`, `GITHUB_CLIENT_ID` / `SECRET`, `ALLOWED_EMAILS`,
`CLOUDFLARE_API_TOKEN` (Analytics `Read`), `LIBSQL_AUTH_TOKEN`,
`ANALYTICS_IP_SALT`. See [`wrangler.jsonc`](wrangler.jsonc) for the full
annotated list.

## Bindings

| Binding | Type | Purpose | Required |
| --- | --- | --- | --- |
| `DB` | D1 | Links, launchpads, tags, auth tables — source of truth. | ✓ (or `libsql`) |
| `KV` | KV | Redirect cache, negative cache, visit counters, password-attempt + gate-token buckets. | ✓ |
| `ANALYTICS` | Analytics Engine | Click / view / block-click data points. | ✓ for stats |
| `AI` | Workers AI | Slug + OG suggestions. | optional |
| `RESOLVE_RATE_LIMIT` | Rate Limiting | Per-IP throttle on `/<slug>`. | optional |
| `R2` | R2 | QR / OG asset uploads + daily backups. | optional (commented out by default) |
| `ASSETS` | Static assets | OpenNext build output. | ✓ |

## Endpoints

| Route | Purpose |
| --- | --- |
| `GET/POST /<slug>` | Public redirect + gates (the redirect engine). |
| `GET /<slug>/og` | OG preview image for a link. |
| `GET /m/<slug>` | Public launchpad (link-in-bio) page. |
| `/dashboard/*` | Session-gated console: links, analytics, realtime, launchpads, check, migrate, settings. |
| `/api/auth/[...all]` | better-auth handler. |
| `/api/link/*` | Link CRUD, list / search, tags, import / export, AI slug / OG, health check. |
| `/api/launchpad/*` | Launchpad CRUD, publish, query, stats, view / click tracking. |
| `/api/stats/*`, `/api/logs/*` | Analytics Engine queries: metrics, counters, views, events, locations, CSV export. |
| `/api/upload/image`, `/api/asset/[...key]` | R2 asset upload + serve. |
| `/api/backup`, `/api/config`, `/api/location` | Manual backup, public config, geo lookup. |

Every `/api/*` handler runs `requireSession` server-side; there is no client-only
gate.

## Project structure

```
src/
  app/
    [slug]/route.ts          the redirect engine (GET + POST gates)
    m/[slug]/page.tsx        public launchpad renderer (force-dynamic)
    dashboard/               session-gated console (App Router)
    api/                     link / launchpad / stats / logs / auth / upload
  lib/
    redirect/                slug rules, destination resolution, gate HTML/tokens
    data/                    D1 repositories, KV cache, cleanup, R2 backup
    analytics/               Analytics Engine write + SQL-API query + bot patterns
    platform/                env config, auth, api wrappers, rate limit, logger
    ai/                      slug + OG generation, link health check, Safe Browsing
  database/schema.ts         Drizzle schema (links, launchpads, tags, auth tables)
  worker/index.ts            custom Worker entry (wraps OpenNext + adds scheduled())
DESIGN.md                    architecture + redirect / analytics / security spec
llms.txt                     agent-oriented usage guide
```

## Build, test & deploy

```bash
pnpm --filter @cdlab/flnk lint        # next lint
pnpm --filter @cdlab/flnk test        # vitest (redirect / analytics / health-check units)
pnpm --filter @cdlab/flnk build       # next build (type-check + bundle)
```

Deploys go through the `deploy-flnk.yml` GitHub workflow (manual dispatch); it
runs `opennextjs-cloudflare build && deploy` and syncs the `FLNK_`-prefixed
secrets. Database migrations apply separately:

```bash
pnpm --filter @cdlab/flnk db:gen        # generate a migration from schema.ts
pnpm --filter @cdlab/flnk cf:remotedb   # apply migrations to the remote D1
```

> Migrations must be generated with the **sqlite** dialect (`DB_TYPE=d1`); the
> default `libsql` dialect emits `ALTER COLUMN` statements that D1 rejects.

## Performance & engineering

The redirect path is the hottest route in the system, so it's built to stay cheap
and correct under load:

- **One KV read, zero D1 on a cache hit** — a resolved link is served from a
  read-through KV cache; D1 is touched only on a cold miss, then the result is
  backfilled.
- **Cache-penetration proof** — a missing slug writes a short-TTL negative
  tombstone, and malformed slugs are shape-rejected before any I/O, so 404 floods
  and scanners never reach D1.
- **Logging off the critical path** — click analytics are written via
  `ctx.waitUntil`, so they never add latency to the redirect itself.
- **Edge-native rate limiting** — the per-IP resolve limit is a per-colo, in-memory
  binding, so it costs no D1/KV quota.
- **Parsed once per isolate** — the env config (Zod-validated) and the auth
  instance are memoized for the isolate's lifetime, not rebuilt per request.
- **Race-safe writes** — random slugs are allocated with `onConflictDoNothing`
  (the unique index arbitrates atomically — no check-then-insert race) plus an
  escalating-length retry; the click cap pays one KV read on the hot path and
  increments in the background.
- **Correct under sampling** — Analytics Engine reads are sampling-weighted
  (`SUM(_sample_interval)`), and the visitor IP is HMAC-hashed inline, never
  stored raw.

The mechanisms behind each point are specified in [`DESIGN.md`](DESIGN.md) — §4
(caching) and §5 (gates).

## Design

[`DESIGN.md`](DESIGN.md) is the authoritative spec — the redirect engine and its
caching model, the security gates and their ordering rationale, the data model,
the privacy-preserving analytics pipeline, the launchpad system, and the auth /
multi-tenancy design. Read it before changing resolution order, cache
invalidation, or the analytics blob layout.

## License

[MIT](../../LICENSE) © 2025-PRESENT [wudi](https://github.com/WuChenDi)
