# flox — Design

> A client-heavy, server-stateless multi-source video aggregator on Next.js 16.
> Search is an Edge SSE fan-out that streams each source's results the instant it
> replies; playback runs through a custom `hls.js` engine with a 4-layer M3U8 ad
> filter; and every persisted thing — sources, favorites, history, settings —
> lives only in the browser's `localStorage`. There is no database and no
> Cloudflare binding: the server is a stateless set of Edge proxy/fan-out routes.

This is the authoritative design spec; the implementation follows it. Section
numbers are stable anchors — source doc-comments and reviews reference them as
`design §N`.

**Contents**

1. [Background & goals](#1-background--goals)
2. [Architecture](#2-architecture)
3. [The parallel search pipeline](#3-the-parallel-search-pipeline)
4. [Source registry](#4-source-registry)
5. [Proxy & ad-filtering engine](#5-proxy--ad-filtering-engine)
6. [The custom HLS player](#6-the-custom-hls-player)
7. [Storage model](#7-storage-model)
8. [Password gate & premium isolation](#8-password-gate--premium-isolation)
9. [Discovery & premium proxies](#9-discovery--premium-proxies)
10. [Configuration & deployment](#10-configuration--deployment)

---

## 1. Background & goals

Aggregating third-party video APIs into one search surface has a few sharp
edges: the slowest upstream blocks the whole result set, upstream HLS streams
carry injected ad segments and reject cross-origin playback, and a "just watch"
tool shouldn't demand accounts or a backend. flox is built around those.

- **G1 — Stream, don't block.** A search must surface each source's results the
  moment that source replies, never gated on the slowest one, and a hung source
  must not stall the UI.
- **G2 — Stateless server.** No database, no accounts, no Cloudflare binding.
  Every persisted artifact is browser `localStorage`; the server is only Edge
  proxy/fan-out routes.
- **G3 — Watchable upstreams.** Cross-origin manifests must play (proxy + CORS)
  and ads embedded in the M3U8 must be filtered before hls.js sees them.
- **G4 — Own your data locally.** Sources, favorites, history, and settings are
  exportable/importable as one file; a backup can be moved between browsers.

### Non-goals

- **Not a content platform.** flox ships **no sources** (`DEFAULT_SOURCES` and
  `PREMIUM_SOURCES` are `[]`) and stores no media — it queries user-supplied
  APIs and is inert until sources are imported (§4).
- **Not multi-device.** No server persistence, no sync — `localStorage` per
  browser, manual export/import only (§7).
- **Not authentication.** The password gate is casual access control against an
  env-side hash, not an auth system — there are no user accounts (§8).
- **Not a Cloudflare-Workers app.** Despite deploying to Cloudflare Pages, there
  are no bindings (no KV/D1/R2/DO) and no `wrangler.jsonc`; server logic is
  ordinary Edge route handlers (§10).

---

## 2. Architecture

```
                         Cloudflare Pages edge
  user ── /  /player ──►┌──────────────────────────────────────────┐
                        │ Next.js 16 App Router (React 19)           │
                        │  client: Zustand persist + TanStack Query  │
                        │  server: /api/* Edge route handlers        │
                        └───────┬───────────────────────────┬───────┘
                                │ (server, stateless)        │ (client, stateful)
                    ┌───────────┴───────────┐        ┌───────┴───────────┐
                    │ search-parallel (SSE) │        │ localStorage       │
                    │ proxy / probe / detail│        │ (Zustand persist)  │
                    │ douban/* · premium/*  │        │ Service Worker cache│
                    └───────────┬───────────┘        └────────────────────┘
                                │ fetch (UA-spoofed)
                     upstream MacCMS video APIs · Douban · jsDelivr CDN
```

Two clean halves:

- **Server (stateless).** Every route under `src/app/api/*` is Edge Runtime
  (`export const runtime = 'edge'`). They exist only to fan out, proxy, or probe
  upstream — none of them read or write persistent state. The one non-edge server
  code is the root `layout.tsx` server component, which (on the standalone/Docker
  path) reads `AD_KEYWORDS_FILE` from disk and injects keywords to the client —
  keeping `fs` out of the edge routes.
- **Client (stateful).** The React UI holds all durable state in Zustand stores
  backed by `localStorage` (§7), with TanStack Query driving the search mutation
  and SSE stream.

**No bindings.** There is no `wrangler.jsonc`, no KV/D1/R2/DO. `middleware.ts`
(kept under that name deliberately — §10) applies CORS to `/api/*`.

**Upstream fetch hygiene.** Source calls (`search-api.ts`, `detail-api.ts`)
spoof `User-Agent: Mozilla/5.0` so picky MacCMS hosts answer; the search URL
follows the Apple-CMS / MacCMS JSON convention
`${baseUrl}${searchPath}?ac=detail&wd=<query>&pg=<page>`.

---

## 3. The parallel search pipeline

The signature operation: "search every enabled source at once, stream results
as each replies." It spans one Edge route and two client modules.

### 3.1 Edge fan-out (`src/app/api/search-parallel/route.ts`)

`POST` opens a `ReadableStream` and emits SSE `data:` frames. Five frame types:

| Frame | When | Payload |
| --- | --- | --- |
| `start` | after validation | `{ totalSources }` |
| `videos` | a source resolved | that source's videos, each with `latency` + source name |
| `progress` | a source resolved or **failed** | running completed / found counts |
| `complete` | all sources settled | final totals |
| `error` | invalid query / no sources | message, then the stream closes |

The route reads `{ query, sources, page }`, validates (empty query → `error`;
empty sources → `error` — the client must supply sources, the route has none),
emits `start`, then maps **one `fetch` per source through `Promise.all`**. Each
source is timed with `performance.now()` for its `latency`, calls `searchVideos`
(§4), and enqueues `videos` + `progress` on success or `progress` only on
failure. After all settle it emits `complete`. Response headers are
`text/event-stream`, `no-cache`, `keep-alive`.

Fan-out is **unbounded `Promise.all`** — the concurrency limit is the edge
runtime's own; there is no server-side pool here (the pool lives in the resolution
prober, `/api/probe-resolution`).

### 3.2 Client trigger (`src/lib/hooks/useParallelSearch.ts`)

A TanStack `useMutation`. If the caller passes no sources, the hook assembles
them from `useSettingsStore` (`.sources` + enabled `.subscriptions`). It carries
an `AbortController`, so a new search **aborts the prior in-flight one**. As
`videos` frames arrive, it merges them with `binaryInsertVideos` (sorted insert
into the growing list) and tracks per-source counts/latency; on mutation success
it runs `sortVideos` and pushes the final set to the search cache via a callback.

### 3.3 Stream parse & watchdog (`src/lib/utils/search-stream.ts`)

`processSearchStream()` decodes the SSE buffer line-by-line, and for each video
applies `hasMinimumMatch()` (drop non-matches) + `calculateRelevanceScore()`
(`src/lib/utils/search.ts`). **Invariant — the no-progress watchdog:** a 3-second
timer resets on every frame; if it fires, it auto-invokes `onComplete()`. This is
what guarantees G1's "a hung source can't stall the UI" — a source that never
replies simply drops out of that search once the watchdog elapses.

---

## 4. Source registry

A **source** (`VideoSource`, `src/lib/types/index.ts`) is
`{ id, name, baseUrl, searchPath, detailPath, headers?, enabled, priority,
group: 'normal' | 'premium' }`.

- **`src/lib/api/client.ts`** re-exports `searchVideos` / `getVideoDetail`.
- **`search-api.ts`** hits the MacCMS JSON API (`?ac=detail&wd=&pg=`) and shapes
  results into `VideoItem`s (MacCMS `vod_*` fields + `latency`).
- **`detail-api.ts`** fetches episodes; MacCMS packs multiple play-sources
  `$$$`-delimited, parsed by `parsers.ts` (`parseEpisodes`).
- **`video-sources.ts`** `getSourceById` searches the default list, then premium.

### 4.1 Sources ship empty — by design

`DEFAULT_SOURCES = []` and `PREMIUM_SOURCES = []`. The curated 38+ list is **not
bundled**: it is hosted remotely at
`BUILTIN_SOURCES_URL = https://cdn.jsdelivr.net/gh/WuChenDi/static/flox/sources-link-all.json`
(`builtin-sources.ts`). The settings page's one-click import fetches that URL
**through `/api/proxy`** (to dodge CORS), parses it, and merges into the user's
own sources. A user therefore has three source origins: the imported curated
list, env subscriptions (`NEXT_PUBLIC_SUBSCRIPTION_SOURCES`), and hand-added
sources. The registry supports drag-and-drop reorder (`@dnd-kit`),
enable/disable, and JSON import/export from `/settings`.

---

## 5. Proxy & ad-filtering engine

### 5.1 `/api/proxy` (`src/app/api/proxy/route.ts`)

`GET ?url=`. It **forwards only `cookie` + `range`** upstream (via
`fetchWithRetry`), then:

- **M3U8 detection** — by `Content-Type`
  (`application/vnd.apple.mpegurl` / `application/x-mpegurl`), by a `.m3u8` URL,
  or by sniffing the body for `#EXTM3U` / `#EXT-X-`.
- **Manifest rewrite** — `processM3u8Content()` (`proxy-utils.ts`) rewrites
  segment/sub-playlist URLs to route **back through the proxy**, so nested
  playlists and TS segments also carry CORS.
- **Passthrough hygiene** — strips `content-encoding` / `content-length` /
  `transfer-encoding` on binary passthrough; adds `Access-Control-Allow-Origin: *`
  to every response; has an `OPTIONS` handler.

The Service Worker (§7.3) **explicitly skips `/api/proxy`** so it doesn't
double-handle proxied streams.

### 5.2 The 4-layer ad filter (`src/lib/utils/m3u8-utils.ts`)

`filterM3u8Ad()` is gated by the `adFilterMode` setting
(`off | keyword | heuristic | aggressive`) and layers:

1. **Heuristic block scoring** — splits the playlist on `#EXT-X-DISCONTINUITY`
   into blocks and scores each (`scoreBlock`); high-scoring blocks are dropped.
2. **SCTE-35 CUE state machine** — strips everything between
   `#EXT-X-CUE-OUT` … `#EXT-X-CUE-IN`, including the bounding discontinuity.
3. **Keyword matching** — drops segments whose URLs match ad keywords (seeded
   from `AD_KEYWORDS` / `AD_KEYWORDS_FILE`).
4. **Aggressive** — strips **all** `#EXT-X-DISCONTINUITY` tags, defeating ads
   camouflaged as ordinary discontinuities (last resort; may clip legitimate
   discontinuities).

The same engine runs in two places: server-side inside `/api/proxy`'s manifest
rewrite, and client-side inside the hls.js loader (§6).

---

## 6. The custom HLS player

### 6.1 Engine dispatch

`src/components/player/VideoPlayer.tsx` routes on the `playerEngine` setting
(`veplayer | native`) to either `FloxPlayer` (Volcengine VePlayer) or the custom
`CustomVideoPlayer`. The custom chain is
`CustomVideoPlayer` → `DesktopVideoPlayer` → `desktop/*` control layer
(`DesktopControls`, `DesktopProgressBar`, `DesktopVolumeControl`,
`DesktopOverlay`, …).

### 6.2 State container

`hooks/useDesktopPlayerState.ts` + `hooks/useDesktopPlayerLogic.ts` expose a
`refs` / `data` / `actions` object wired over domain hooks in `hooks/desktop/`
(playback, volume, progress, skip, fullscreen, controls-visibility, shortcuts,
android-pip). Companion hooks: `useAutoSkip` (intro/outro), `useStallDetection`,
`usePlaybackPolling`, `useVideoResolution`.

### 6.3 The HLS core (`hooks/useHlsPlayer.ts`)

The heart of playback:

- **Capability detection** — native HLS (`video.canPlayType`) and MSE
  (`Hls.isSupported()`).
- **Ad-filter loader** — subclasses hls.js `DefaultLoader` to intercept
  `manifest` / `level` responses and run `filterM3u8Ad` (§5.2). **When ad
  filtering is on it forces hls.js even on desktops with native HLS**, so the
  filter always gets a chance to run.
- **HEVC / H.264 level-locking** — on `MANIFEST_PARSED`: if HEVC and H.264
  variants coexist, it locks `currentLevel` to the first H.264 level for
  compatibility; an all-HEVC manifest surfaces an error.
- **iOS / native path** — fetches the master playlist, recursively filters
  variant and `EXT-X-MEDIA` sub-playlists, and rebuilds them as **blob URLs**,
  with a `/api/proxy` fallback on CORS failure, blob-playback-failure detection,
  and an 8-second timeout fallback to the original source.
- **Fatal-error recovery** — capped retries (network → `startLoad`, media →
  `recoverMediaError`, MAX_RETRIES = 3); blob URLs are `revokeObjectURL`'d on
  teardown.
- Tuned hls.js config: `enableWorker`, ~120s buffer, aggressive retry timeouts.

---

## 7. Storage model

**No server DB.** All persistence is browser `localStorage` via Zustand persist,
keys namespaced `flox:<scope>`.

### 7.1 Store factory & registry

`create-persisted-store.ts` `createPersistedStore()` wraps zustand `persist` and
**auto-registers each store in a central registry** (`registry.ts`). Each entry
carries `serialize` / hydrate hooks, an optional `partialize` / `merge`
(hydration migration), and an **`includeInBackup` flag** (default `true`).
`store/init.ts` (imported by `layout.tsx`) force-registers every store once, so
global reset/export never misses a store that the current route didn't load.

Registry operations: `resetAllStores`, `exportAllStores` /
`importAllStores` (only `includeInBackup` entries), and `clearAppCaches` (wipes
the video-segment Cache Storage + its `localStorage` metadata index).

### 7.2 The stores

Persisted (keyed `flox:<scope>`, several with a `:premium` sibling for the
isolated premium surface, §8):

| Key(s) | Store | Notes |
| --- | --- | --- |
| `flox:settings` | settings | sources, subscriptions, sort, ad-filter mode, `proxyMode`, `playerEngine`, skip seconds, volume, etc. |
| `flox:favorites` (`:premium`) | favorites | `FavoriteItem` list. |
| `flox:history` (`:premium`) | history | `VideoHistoryItem` with `playbackPosition` + `showIdentifier` dedup, bounded. |
| `flox:watch-later` (`:premium`) | watch-later | queued items. |
| `flox:search-history` (`:premium`) | search history | recent queries. |
| `flox:tag-orders` | tag orders | user reorder of source tags. |
| `flox:unlock` | password unlock | `includeInBackup: false` — see §8. |

Non-persisted / UI stores: `sidebar-store`, `header-reset-store`.

Key types (`src/lib/types/index.ts`): `VideoSource`, `VideoItem` / `Video`
(MacCMS `vod_*` + `latency`), `VideoDetail` + `Episode`, `VideoHistoryItem`,
`FavoriteItem` / `WatchLaterItem`, `ApiSearchResponse` / `ApiDetailResponse`.

### 7.3 Service Worker cache (`public/sw.js`)

`CACHE_NAME = 'video-cache-v2'`: stale-while-revalidate for `.m3u8` manifests and
caching of video segments, registered by `ServiceWorkerRegister`. It **skips
`/api/proxy`** so proxied streams aren't double-handled (§5.1).

---

## 8. Password gate & premium isolation

### 8.1 Password gate (`src/components/PasswordGate.tsx`)

`PasswordGate` wraps the whole app. It fetches `/api/config` for
`hasEnvPassword` / `persistPassword` / `subscriptionSources`, hashes the entered
password client-side (`hashPasswordFn` from `@cdlab/utils`), and verifies it by
`POST /api/config`, where the server compares against `ACCESS_PASSWORD` with
`verifyPasswordFn`. **The env password value is never sent to the client** —
only its verification result. **Security invariant:** the `flox:unlock` store is
registered `includeInBackup: false`, so an exported settings file **cannot
replay-unlock** the gate. `PERSIST_PASSWORD=false` downgrades the unlock to
`sessionStorage` (cleared on tab close).

This is casual access control, not authentication — there are no accounts (§1
G-non-goals).

### 8.2 Premium isolation

`components/premium/PremiumContent.tsx` + `lib/hooks/usePremiumContent.ts` keep
premium routing, sources, history, and favorites fully separate — the `:premium`
store siblings (§7.2) back that separation, and `/player?premium=1` selects the
premium history bucket. The two surfaces never inflate each other's state.

---

## 9. Discovery & premium proxies

`/api/douban/{filter,image,ranking,recommend,suggest,tags}` proxy Douban
metadata for the `/ranking` discovery surface (consumed by `useRanking`,
`useHomePage`, `useInfiniteScroll`); `doubanio.com` image hosts are allow-listed
in `next.config.ts`. `/api/premium/{category,types}` proxy premium content. All
are Edge routes and stateless like the rest of §2.

---

## 10. Configuration & deployment

### 10.1 Config

All configuration is environment variables — there are no bindings and no
runtime secrets (§2). Full table in the [README](README.md#configuration). Notes:

- `/api/config` reads `ACCESS_PASSWORD`, `PERSIST_PASSWORD`, and subscription
  URLs (`SUBSCRIPTION_SOURCES` **or** `NEXT_PUBLIC_SUBSCRIPTION_SOURCES`).
- `AD_KEYWORDS_FILE` is read from disk by the **Node** root layout, not by any
  edge route — the edge stays `fs`-free; keywords flow to the client via an
  injector component.
- `next.config.ts` sets wide-open image `remotePatterns` (`**.com/.cn/.net/…`
  with `unoptimized: true`) so arbitrary source posters render — a deliberate
  loosening for user-supplied hosts.

### 10.2 Build & deploy

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `nsl run next dev` | dev at `http://flox.localhost:3355`. |
| `build` | `next build --webpack` | production build — **Turbopack is not used** here. |
| `start` | `next start` | run the standalone server. |
| `lint` / `lint:fix` | `next lint` | lint. |
| `typecheck` | `tsc --noEmit` | type-check. |

Primary deploy target is **Cloudflare Pages**. `output: 'standalone'`
in `next.config.ts` also makes it a runnable Node/Docker server — that path is
the only one that reads `AD_KEYWORDS_FILE` from disk. There is **no test
script**.

### 10.3 `middleware.ts`, not `proxy.ts`

Next 16 renamed `middleware.ts` → `proxy.ts`, but `@cloudflare/next-on-pages`
does not yet support `proxy.ts`, so the file is **deliberately kept as
`middleware.ts`**. It applies CORS to `/api/*` for an allow-list of
`https://floxx.pages.dev` and `http://flox.localhost:3355`.

### 10.4 Domain-name discrepancy (known)

Two preview/live domains coexist and are **not** unified: the middleware CORS
allow-list and the README preview link use **`floxx.pages.dev`** (double-x),
while `layout.tsx` metadata (`metadataBase`, OG/canonical URLs) uses
**`flox.pages.dev`** (single-x). Reconcile these to one canonical host before
relying on OG/CORS behaviour in production.
