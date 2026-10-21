# byplay — Design

> An in-browser HLS/M3U8 diagnostic player. The hls.js configuration *is* the
> UI: every ABR, buffer, and retry knob is React state fed straight into a fresh
> `Hls` instance, and a live stats + event-log panel reflects exactly what the
> engine does. It is a fully static Next.js export — no backend, no persistence,
> no bindings — so all playback, ad filtering, and telemetry happen client-side.

This is the authoritative design spec; the implementation follows it. Section
numbers are stable anchors.

**Contents**

1. [Background & goals](#1-background--goals)
2. [Architecture](#2-architecture)
3. [The player core](#3-the-player-core)
4. [Driver selection & retry model](#4-driver-selection--retry-model)
5. [Ad-filter pipeline](#5-ad-filter-pipeline)
6. [Config model & the tuning UI](#6-config-model--the-tuning-ui)
7. [State, stats & logging](#7-state-stats--logging)
8. [i18n & routing](#8-i18n--routing)
9. [Build & deployment](#9-build--deployment)

---

## 1. Background & goals

Debugging an HLS stream in a normal player is a black box: its hls.js config is
frozen at build time, the manifest it actually loaded is invisible, and trying a
different buffer size or ABR factor means editing code and redeploying.

`byplay` is a **diagnostic harness**, not a consumer player. It holds itself to:

- **G1 — Config is the UI.** Every meaningful hls.js knob is a live control; a
  change plus a re-load rebuilds the `Hls` instance with the new config.
- **G2 — Total observability.** Bandwidth, buffered seconds, dropped frames, and
  current level update in real time; a bounded event log records the hls.js
  lifecycle and every error.
- **G3 — Zero infrastructure.** A static export that runs from any file host;
  no server, no database, no secrets, no bindings.
- **G4 — Client-side only.** Streams are fetched directly from user-supplied
  URLs; ad filtering rewrites manifests in the browser. Nothing is proxied.

### Non-goals

- **No persistence** — config, logs, and stats are in-memory React state, reset
  on reload. There is no localStorage, no history, no saved sessions.
- **No telemetry reporting** — playback events are shown, never sent. There is
  no analytics/log endpoint in the codebase (an earlier README claim to the
  contrary is not implemented).
- **No DRM and no HEVC workaround** — HEVC/H.265 surfaces a soft warning only.
- **Not a component library** — the player is one app-local hook, not a reusable
  package.

---

## 2. Architecture

The entire app is **one screen driving one hook**. There is no server runtime,
no API route, and no worker despite the Cloudflare Pages target.

```
                         browser (static export)
  ┌───────────────────────────────────────────────────────────┐
  │ src/app/[locale]/page.tsx  (HlsPage)                        │
  │   url / HlsConfig / playbackRate  ── React state            │
  │        │                                                    │
  │        ▼                                                    │
  │   useHlsPlayer()  ── src/hooks/use-hls-player.ts            │
  │        │  loadSource(url, config)                           │
  │        ├── native <video src>   (direct file / Safari HLS)  │
  │        └── new Hls(config) ──► MSE ──► <video>              │
  │                 │  (optional) custom AdFilterLoader         │
  │                 │        └── filterM3u8Ad (lib/m3u8-*)      │
  │                 ▼                                           │
  │   state (stats) + logs (200-entry ring) ──► StatsCard /     │
  │                                              EventLogsCard  │
  └───────────────────────────────────────────────────────────┘
              streams fetched directly from pasted URLs (CORS-bound)
```

**Static export.** `next.config.ts` sets `output: 'export'`; there is no
edge/SSR runtime. Consequences that shape the rest of this doc:

- `middleware.ts` (the next-intl locale middleware) is effectively **inert** —
  middleware does not run for a static export. Locale routing relies on static
  generation of `/[locale]` plus the `/` → `/en` redirect (`src/app/page.tsx`).
- The only `process.env` read in `src` is `process.env.BUILD_TIME` (the footer
  build stamp), injected at build time via `next.config.ts` `env` — not a
  runtime secret.
- The `@cloudflare/next-on-pages` target is a deployment wrapper
  around the same static output.

**Entry points.**

| File | Role |
| --- | --- |
| `src/app/page.tsx` | Root `/` → `redirect('/en')` (static-export root). |
| `src/app/layout.tsx` | Minimal pass-through root layout (for root not-found). |
| `src/app/[locale]/layout.tsx` | Real shell: Geist fonts, bilingual SEO metadata, JSON-LD, `NextIntlClientProvider`, providers, header/footer, toaster. |
| `src/app/[locale]/page.tsx` | `HlsPage` — the single functional screen. |
| `src/app/error.tsx` | Error boundary. |

---

## 3. The player core

`useHlsPlayer` (`src/hooks/use-hls-player.ts`) is the whole engine. It owns:

- a `videoRef` (the `<video>` element) and an `hlsRef` (the current `Hls`);
- `state: HlsPlayerState` — support flag, loading/playing flags, `isDirectVideo`,
  error, level list, current level, time/duration/buffered, dropped frames,
  bandwidth;
- `logs: HlsLogEntry[]` — a newest-first ring buffer capped at **200** entries;
- the callbacks `loadSource`, `setLevel`, `setPlaybackRate`, `destroyHls`,
  `clearLogs`.

`HlsPage` holds `url`, `config`, and `playbackRate` and wires the cards to these
callbacks. Two `useEffect`s in the hook do the ambient work:

1. **Support probe** (on mount) — `Hls.isSupported() || canPlayType('…mpegurl')`.
2. **Native `<video>` events** — `timeupdate` / `progress` / `play` / `pause`
   feed `currentTime`, `duration`, `buffered` (last range end), `droppedFrames`
   (from `getVideoPlaybackQuality()`), and `isPlaying`. This runs for **both**
   driver paths, since both end at the same `<video>` element.

A separate cleanup effect calls `destroyHls()` on unmount. `destroyHls` also
runs at the top of every `loadSource` — it destroys any prior `Hls` and clears
the native `src` (`removeAttribute('src')` + `load()`) so a re-load never plays
stale media.

---

## 4. Driver selection & retry model

### 4.1 Driver selection

`loadSource(src, config)` chooses exactly one path:

```
1. directVideo = /\.(mp4|webm|ogg|ogv|mov|avi|mkv)(\?.*)?$/i.test(src)
   → true:  video.src = src; play on 'loadedmetadata'          (native direct file)
2. else Hls.isSupported()
   → true:  new Hls(mergedConfig); loadSource + attachMedia     (hls.js MSE)
3. else canPlayType('application/vnd.apple.mpegurl') truthy
   → true:  video.src = src                                     (native HLS, Safari)
4. else:  state.error = 'HLS is not supported in this browser'
```

`isDirectVideo` is stored in state; `HlsPage` hides all HLS-only config cards
(ad-filter, performance, buffer, ABR, loading/retry) when it is set — those
knobs are meaningless for a native direct-file play.

**Autoplay muted-fallback.** When `autoPlay` is on, playback first attempts
unmuted `video.play()`; on rejection (browser autoplay policy) it sets
`video.muted = true` and retries. Applied on both the direct-file
`loadedmetadata` handler and the hls.js `MANIFEST_PARSED` handler.

### 4.2 hls.js config merge

On the hls.js path the user's `HlsConfig` (minus the three app-level fields) is
spread into an init object alongside **fixed, non-user-facing constants**:
`abrEwmaFast/SlowLive = 3/9`, `abrEwmaFast/SlowVoD = 3/9`,
`*LoadingMaxRetryTimeout = 64000`, `manifest/levelLoadingRetryDelay = 1000`.
These are intentionally not exposed in the UI.

### 4.3 Two-layer retry

hls.js has its own retry config (`*LoadingMaxRetry`, exposed as knobs). On top
of that, the `ERROR` handler runs an **app-level retry loop** for fatal errors:

| Fatal error type | Action | Cap | On exhaustion |
| --- | --- | --- | --- |
| `NETWORK_ERROR` | `hls.startLoad()` | 3 | set error, `hls.destroy()` |
| `MEDIA_ERROR` | `hls.recoverMediaError()` | 3 | set error, `hls.destroy()` |
| other | — | — | set error, `hls.destroy()` |

Non-fatal errors are only logged (`ERROR (non-fatal)`), never acted on. The two
layers are independent by design: hls.js retries a single request, the app-level
loop restarts loading / recovers the media pipeline after hls.js gives up.

### 4.4 HEVC/H.265 detection

On `MANIFEST_PARSED`, if any level's `videoCodec` contains `hev`/`h265`, the hook
sets a **soft** error string (`'HEVC/H.265 detected, browser may not support
it'`) but still proceeds to play — many browsers can't decode HEVC, and the
warning is advisory, not fatal.

---

## 5. Ad-filter pipeline

Ad filtering is injected as a **custom hls.js loader**, active only when
`adFilterMode !== 'off'`. It subclasses `Hls.DefaultConfig.loader`; for
`manifest` and `level` responses it wraps `onSuccess`, runs `filterM3u8Ad` on the
string payload, logs a `FilterStats` summary + elapsed ms, then forwards the
(possibly rewritten) response. Filtering is per request, in the browser — no
proxy, no server.

### 5.1 `filterM3u8Ad` (`src/lib/m3u8-utils.ts`)

A single pass over the playlist lines, five concerns:

1. **Heuristic block scoring** (heuristic/aggressive, when no CUE tags present) —
   `parseBlocks` splits by `#EXT-X-DISCONTINUITY`; `learnMainPattern` fingerprints
   the largest block; `scoreBlock` scores each block; blocks scoring
   `>= threshold` have their segment lines dropped.
2. **SCTE-35 CUE state machine** — everything between `#EXT-X-CUE-OUT` and
   `#EXT-X-CUE-IN` is dropped; adjacent `#EXT-X-DISCONTINUITY` markers are pruned.
3. **Keyword backtracking** — a line matching a keyword drops itself and
   backtracks over the preceding `#EXTINF:` / `#EXT-X-DISCONTINUITY` lines.
4. **Aggressive discontinuity stripping** — in `aggressive` mode, bare
   `#EXT-X-DISCONTINUITY` lines are removed.
5. **URL normalization** — relative segment URLs and `URI="…"` values are
   resolved to absolute against the manifest origin / base path.

### 5.2 Scoring model (`src/lib/m3u8-ad-detector.ts`)

`learnMainPattern` derives a fingerprint from the largest block — filename
common-prefix regex, average / dominant segment duration, path prefix, filename
base length, sequential-`.ts`-number range, median block size. `scoreBlock`
accumulates weighted signals (CUE tag → instant 10; ad-keyword URL match; `ad*`
filename patterns; filename/path/duration/size divergence from the main pattern;
disconnected `.ts` numbering). `AD_PATH_KEYWORDS` is the built-in keyword set
(`advert`, `preroll`, `midroll`, `dai`, `vast`, `ima`, …).

### 5.3 Thresholds & modes

| Mode | Block scoring | Keyword | CUE strip | Aggressive discontinuity strip |
| --- | --- | --- | --- | --- |
| `off` | — | — | — | — |
| `keyword` | — | ✓ | ✓ | — |
| `heuristic` | ✓ (≥ 5.0) | ✓ | ✓ | — |
| `aggressive` | ✓ (≥ 3.0) | ✓ | ✓ | ✓ |

`FilterStats` (`blocksScanned`, `blocksFiltered`, `segmentsFiltered`,
`cueAdSections`, `keywordHits`) is populated per run and surfaced in the event
log — the harness *shows* what it removed rather than filtering silently.

---

## 6. Config model & the tuning UI

`HlsConfig` (`src/hooks/use-hls-player.ts`) is a `Pick` of hls.js's own
`HlsConfig` (18 fields) plus three app-level fields — `autoPlay`, `adFilterMode`,
`adKeywords`. `DEFAULT_HLS_CONFIG` is the single source of defaults, and the
Playback card's reset restores it verbatim.

Each control is a **controlled card** under `src/components/player/`, fed
`config` + a generic `onUpdateConfig(key, value)`; the barrel `index.ts` exports
them all. Cards map to config groups:

| Card | Governs |
| --- | --- |
| `source-card` | URL input, clipboard paste, Load, jump-to-`vidl` link. |
| `playback-card` | Playback rate (`0.25`–`4x`), manual quality level, reset. |
| `performance-card` | `enableWorker`, `lowLatencyMode`, `startFragPrefetch`. |
| `buffer-card` | `maxBufferLength`/`maxMaxBufferLength`/`maxBufferSize`/`maxBufferHole`/`backBufferLength`. |
| `abr-card` | `abrEwmaDefaultEstimate`, `abrBandWidthFactor`, `abrBandWidthUpFactor`. |
| `loading-retry-card` | Fragment/manifest/level retry counts, delay, and timeouts. |
| `ad-filter-card` | `adFilterMode`, `adKeywords`. |
| `stats-card` | Read-only bandwidth/buffered/dropped/level readout. |
| `event-logs-card` | Collapsible event log + clear. |
| `shared-fields` | `SwitchField`, `formatBitrate`, shared field primitives. |

Playback rate and manual level are **not** part of `HlsConfig` — they apply
directly to the live `<video>` / `Hls` (`setPlaybackRate`, `setLevel`) and take
effect without a re-load. All the config knobs, by contrast, only take effect on
the next Load, since they are baked into the `Hls` constructor.

### 6.1 Query-param deep link

On mount `HlsPage` reads `?url=` (or `?source=`); if the value ends in a
recognized extension (`isVideoUrl`, checks `.m3u8/.m3u/.mp4/.webm/.ogg/.ts/.mpd`)
it sets the URL and auto-loads with the current config.

---

## 7. State, stats & logging

`HlsPlayerState` is updated through a single `update(partial)` reducer. Sources:

- **hls.js events** — `MANIFEST_PARSED` (level list + HEVC warning + autoplay),
  `LEVEL_SWITCHED` (current level), `FRAG_LOADED` (live bandwidth =
  `loaded*8 / loadDuration`), `LEVEL_LOADING`, `BUFFER_APPENDED`, `ERROR`.
- **native `<video>` events** — time, duration, buffered end, dropped frames.

`StatsCard` renders the numeric readout; `EventLogsCard` renders the log. Log
entries (`HlsLogEntry`: `time`, `type`, `event`, `detail`) are pushed
newest-first and **sliced to 200** so a long-running session can't grow the array
unbounded. `clearLogs` empties it. Logs are the primary debugging surface — every
lifecycle event, ad-filter run, and error lands there with a timestamp.

---

## 8. i18n & routing

`next-intl` with two locales, `['en', 'zh']`, default `en`
(`src/i18n/routing.ts`); messages in `messages/{en,zh}.json`, typed via
next-intl's `createMessagesDeclaration` (generates `messages/en.d.json.ts`).

Because the app is a static export, the locale **middleware does not execute** at
request time. Routing works through static generation of `/[locale]` (params
generated per locale in the layout) and the `/` → `/en` redirect. The `locale`
segment is also propagated into the jump-to-`vidl` link so the downloader opens
in the same language.

---

## 9. Build & deployment

| Script | Command | Output |
| --- | --- | --- |
| `dev` | `nsl run next dev` | `http://byplay.localhost:3355` (via `@dotns/nsl`). |
| `build` | `next build` | Static `out/` (`output: 'export'`). |
| `lint` | `next lint` | — |
| `typecheck` | `tsc --noEmit` | — |

There are **no tests** (no runner, no test files), no environment variables, no
secrets, and no Cloudflare bindings. Deployment is static hosting on Cloudflare
Pages; the only build-time input is the `BUILD_TIME` stamp in `next.config.ts`.

### 9.1 Known dead / leftover code

Flag before touching — none of it is wired into the current player:

- `public/vplayer.js` and `src/types/vplayer.d.ts` — an abandoned prior player
  (`createVzanPlayer`/`window.vplayer`); nothing in `src` references them. Some
  `messages/*` keys (play/stop/destroy/seek/…) also date from that design.
- `@cdlab/driftflake` is declared in `package.json` but never imported in `src`.
- `public/*.svg` are default Next.js scaffold assets.
- JSON-LD `softwareVersion: '1.0.0'` in the layout lags `package.json` `2.0.0`
  (cosmetic).
