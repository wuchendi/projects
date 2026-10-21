# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@cdlab/projects-monorepo` — a personal collection of privacy-first web tools sharing a single Turborepo + pnpm workspace. Most apps run **entirely in the browser** with zero server uploads (Transformers.js / FFmpeg.wasm / WebGPU / Web Workers); the few that have a server are Cloudflare Workers (Hono), not traditional Node.

Workspace layout:

- `apps/*` — 16 deployable products (Next.js, Nuxt, Cloudflare Workers)
- `packages/*` — 6 shared libraries (`ui`, `utils`, `cipher`, `uncrypto`, `db`, `tsconfig`)

Apps fall into three runtime families with different toolchains:

| Family                        | Apps                                                                                                                             | Build tool                      | Deploy target                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Next.js (App Router)**      | `bycut`, `byplay`, `byshot`, `bytts`, `clearify`, `dropply-web`, `flnk`, `flox`, `text2img`, `values`, `vidl`, `wepush` | `next build` (some `--webpack`) | Cloudflare Pages (build command `NEXT_ENABLE_ADAPTER=0 npx --legacy-peer-deps @cloudflare/next-on-pages@1`, output `.vercel/output/static`; not a dependency); `text2img`, `wepush`, and `flnk` use `@opennextjs/cloudflare` |
| **Cloudflare Workers (Hono)** | `byplay-log`, `dropply-api`, `live-user`                                                                            | `wrangler deploy --minify`      | Cloudflare Workers + Durable Objects / D1                                                            |
| **Nuxt 4 (Vue 3)**            | `repo-changelog`                                                                                                                 | `nuxt build`/`generate`         | Vercel                                                                                               |

## Commands

Dev servers are routed through `@dotns/nsl` (`nsl run …`) — each app is reachable at **`http://<name>.localhost:3355`** (no port hunting).

```bash
# Workspace-wide
pnpm install                                 # also runs `prepare` → builds all packages/* dist/
pnpm dev                                     # turbo dev (parallel, all apps)
pnpm build                                   # turbo build (all)
pnpm lint                                    # turbo lint (delegates to each app)
pnpm lint:biome                              # biome check . at root
pnpm format                                  # biome format . --write
pnpm clean                                   # bash scripts/clean.sh — wipes node_modules / .turbo / .next / dist / .wrangler

# Single-app convenience aliases (also: dev:bycut, dev:flox, dev:bytts, …)
pnpm dev:dropply                             # filters apps/dropply-* (web + api together)

# Filter explicitly
pnpm --filter @cdlab/<name> dev|build|typecheck|lint
pnpm --filter ./apps/<dir> dev|build         # path-based filter

# Cloudflare Workers (byplay-log, dropply-api, live-user)
pnpm --filter @cdlab/<worker> dev         # nsl run wrangler dev
pnpm --filter @cdlab/<worker> deploy      # wrangler deploy --minify
pnpm --filter @cdlab/<worker> cf-typegen  # regenerate CloudflareBindings type

# Drizzle (dropply-api, byplay-log, flnk, wepush)
pnpm --filter @cdlab/<worker> db:gen      # generate migration from schema
pnpm --filter @cdlab/<worker> db:migrate  # apply (LibSQL)
pnpm --filter @cdlab/<worker> cf:localdb  # apply to local D1
pnpm --filter @cdlab/<worker> cf:remotedb # apply to remote D1
pnpm --filter @cdlab/<worker> db:studio   # drizzle-kit studio (port 3015 / 3018 / 3019 / 3020)

# Workspace package tests (vitest)
pnpm --filter @cdlab/utils  test          # one-shot
pnpm --filter @cdlab/cipher test:watch
pnpm --filter @cdlab/utils  exec vitest run path/to.test.ts -t "name"

# Explicit deploys (CI does NOT auto-deploy)
pnpm deploy:dropply-api | deploy:live-user | deploy:flnk | deploy:text2img | deploy:wepush
```

Drizzle's `DB_TYPE` env var (`libsql` default, or `d1`) selects the dialect at config time — see `apps/dropply-api/drizzle.config.ts`. `LIBSQL_URL` defaults to `file:./src/database/data.db`.

## Architecture

### Cloudflare Workers (Hono backends)

#### `dropply-api` — End-to-end encrypted file sharing API

Entry: `src/index.ts`. Hono + Drizzle (D1 / LibSQL) + Resend (email). Server **never sees plaintext** — encryption happens in `dropply-web` (browser); the API only stores ciphertext + metadata.

- Middleware: `accesslog`, `prettyJSON`, `requestId`, `cors`. Global error handler emits `{statusCode, message, stack?}` envelopes (`stack` only in debug).
- `src/database/schema.ts` — `sessions` (UUID id, `retrievalCode`, `expiresAt`) + `files` (cascade-delete on session). All tables share `trackingFields` (`createdAt`, `updatedAt`, `isDeleted` soft delete).
- `src/routes/` — `chest` (upload), `retrieve` (download), `download`, `config`, `email`. All composed via `src/routes/index.ts`.
- `src/lib/jwt.ts`, `src/lib/totp.ts` — Optional TOTP gate on retrieval.
- `src/cron/cleanup.ts` — Runs from the worker's `scheduled()` handler; deletes expired sessions/files via `cleanupExpiredContent(env)`.
- `src/global.ts` — Sets a global `logger` (winston) and `isDebug` flag. Imported for side effects from `index.ts`.
- Validation: `@hono/zod-validator` + `src/lib/validationSchemas.ts`.

#### `byplay-log` — ByPlay player log ingest

Entry: `src/index.ts`. Single route `POST /monitor?bury_content=…`. CORS locked to `https://byplay.pages.dev` + localhost.

- `src/database/schema.ts` — `playerLogs` table (auto-increment id) with JSON columns (`feature`, `playerConfig`, `vplayerRuntime`, `executeProgressInfos`) for flexible event shapes. Index on `userId`, `streamId`, `time`.
- `src/routes/monitor.ts` — Accepts the player's monitoring payload; the `bury_content` query param tags the event type.
- Same `global.ts` / winston logger pattern as `dropply-api`.

#### `live-user` — Real-time online user counter

Entry: `src/index.ts`. Mounts `homeRoutes`, `sdkRoutes`, `wsRoutes`. The frontend is a tiny embeddable script + an HTML page rendered by Hono JSX (`src/pages/`).

- `src/site-manager.ts` — `SiteManager` Durable Object. Uses **WebSocket Hibernation API** (`ctx.acceptWebSocket(server)`): the DO unloads when idle, saving cost. Connection state is preserved via `serializeAttachment(state)` and read back on each event.
- DO embeds SQLite for the `visit_counter` table (`new_sqlite_classes: ["SiteManager"]` migration).
- Per-site visit counts are atomic via `ctx.storage.sql.exec` updates.
- **Bug-fixed quirk** (see comment in `webSocketClose`): hibernation calls `webSocketClose` *after* the socket is already closed — never call `ws.close()` from there or it throws.
- `routes/sdk.ts` — Serves the embeddable JS snippet; `routes/ws.ts` proxies WebSocket upgrades into the DO.

### Next.js apps

All Next apps share these conventions: `nsl run next dev` for dev, `next build` (or `--webpack` for `clearify`/`flox`), `tsconfig` extends `@cdlab/tsconfig/nextjs`, i18n via `next-intl` with `messages/{en,zh}.json`, Tailwind v4 via `@cdlab/ui/globals.css`, shadcn/ui primitives from `@cdlab/ui/components/*`. `middleware.ts` is the `next-intl` locale middleware unless noted.

#### `flox` — Multi-source video aggregation & playback

The most architecturally complex Next app. Searches 38+ Chinese video sources in parallel and streams results back via SSE.

- `src/app/api/search-parallel/route.ts` — **Edge runtime**. Reads sources from request body, fans out parallel fetches, streams JSON SSE chunks (`type: 'start' | 'result' | 'error' | 'done'`) as each source replies. Sources are not waited on — first replies arrive immediately.
- `src/app/api/proxy/route.ts` — Server-side proxy for video URLs (CORS bypass + ad filtering).
- `src/app/api/probe-resolution/` — Probes video stream resolution server-side (with `lib/player/resolution-cache.ts` deduping).
- `src/lib/api/` — `client.ts` re-exports `searchVideos` / `getVideoDetail`. `default-sources.ts` and `premium-sources.ts` define the 38+ source registry (each with `baseUrl`, `searchPath`, `priority`).
- `src/lib/store/` — Zustand stores: `favorites-store`, `history-store`, `search-history-store`, `settings-store`, `sidebar-store`, `header-reset-store` (all `persist`-middleware'd).
- `src/components/player/` — Custom HLS player (ported from upstream KVideo). `VideoPlayer.tsx` is the shell (proxy/retry state machine + progress persistence) → `CustomVideoPlayer` (device dispatch) → `DesktopVideoPlayer` (orchestrator) with a full custom control layer in `desktop/`. State is a `refs`/`data`/`actions` container (`hooks/useDesktopPlayerState`) wired by `hooks/useDesktopPlayerLogic` over domain hooks in `hooks/desktop/` (playback, volume, progress, skip, fullscreen, controls-visibility, shortcuts, utilities). `hooks/useHlsPlayer.ts` owns hls.js (HEVC H.264 level-locking, iOS blob ad-filter with fallback, unsupported-env direct→proxy fallback); `hooks/useAutoSkip.ts` (intro/outro/auto-next, decoupled), `hooks/useStallDetection.ts`. Ad filtering via `lib/utils/m3u8-utils.ts` (heuristic/keyword/aggressive). All player icons use `lucide-react` directly (the temporary `Icon` shim was removed). Danmaku, watch-together, AirPlay, and the Google Cast SDK are intentionally not wired.
- `src/components/ServiceWorkerRegister.tsx` — Service Worker for offline + caching.
- `src/components/PasswordGate.tsx` — Optional password gate before app loads. Premium content lives in `components/premium/` and is isolated from non-premium UI.
- `src/lib/hooks/useParallelSearch.ts` — Subscribes to the SSE search stream and merges results into a Zustand store as they arrive.

#### `bycut` — Browser video editor

The largest Next app — a full timeline-based editor with a manager-based core architecture. Locale-aware routing (`app/[locale]/`).

- `src/core/managers/` — Self-contained editor subsystems, each a singleton-style manager: `media-manager`, `timeline-manager`, `playback-manager`, `selection-manager`, `audio-manager`, `renderer-manager`, `scenes-manager`, `save-manager`, `project-manager`. `commands.ts` is the undo/redo command bus.
- `src/services/renderer/` — `canvas-renderer.ts` + `scene-builder.ts` + `scene-exporter.ts` + node-based render tree (`nodes/`). GPU-accelerated canvas compositing.
- `src/services/storage/` — `service.ts` with pluggable adapters: `indexeddb-adapter.ts` and `opfs-adapter.ts`. Migrations in `services/storage/migrations/`.
- `src/services/transcription/` — Hugging Face Transformers in a Web Worker (`worker.ts`) for AI captions.
- `src/services/timeline-thumbnail/`, `src/services/video-cache/` — Frame thumbnail generation + frame cache.
- `src/stores/` — Zustand stores for editor UI state (`editor-store`, `timeline-store`, `panel-store`, `media-preview-store`, `keybindings-store`, `assets-panel-store`, `sounds-store`, `stickers-store`).
- `src/stores/keybindings/` — User-customizable shortcuts (persisted).
- FFmpeg.wasm + `mediabunny` for media decoding/encoding; `wavesurfer.js` for waveforms.

#### `clearify` — Image/video toolbox

Three modes split into separate routes: `/bg` (background removal via Transformers.js + WebGPU), `/compress` (jSquash AVIF/JPEG/JXL/PNG/WebP), `/squish` (video compression via FFmpeg.wasm). No locale routing.

- `src/lib/wasm.ts` — Lazy-loads the right wasm modules per format.
- `src/lib/imageProcessing.ts` + `process.ts` — Pipeline: decode → transform → encode. Handles batch zip output via `jszip`.
- `src/lib/canvas.ts` — Canvas-based resize + composition.
- `src/components/pages/{bg,compress,squish}/` — One subdirectory per mode, mirroring the route structure.
- Builds with `--webpack` (Turbopack does not currently handle the wasm + worker mix here).

#### `dropply-web` — Dropply file sharing frontend (paired with `dropply-api`)

- `src/lib/crypto.ts` — AES-GCM + Argon2id, all client-side. Encryption key is **embedded in the URL fragment** (`#key=…`) so the server never receives it.
- `src/lib/api.ts` — Talks to `dropply-api`. Multipart upload: 20 MB chunks, 3 concurrent parts.
- `src/store/` — `useShareStore`, `useRetrieveStore`, `useAuthStore` (auth = optional TOTP gate).
- Tab-based UI: Share tab vs Retrieve tab. i18n (en/zh) via `next-intl`.

#### `text2img` — Browser AI text-to-image

- `src/app/api/{generate,models,prompts}/` — Edge route handlers; `generate` calls Cloudflare Workers AI with the requested model (FLUX, SDXL, DreamShaper).
- `src/lib/api.ts` — Frontend client; results streamed/polled back to the UI.
- TanStack Query for image history/cache.
- Builds with **OpenNext for Cloudflare** (`@opennextjs/cloudflare`), not `next-on-pages`. Deploys with `pnpm --filter @cdlab/text2img deploy` (which runs `opennextjs-cloudflare build && deploy`).

#### `wepush` — WeChat test-account template-message console

Multi-tenant console for sending WeChat official-account template messages. Replaces the legacy `ALL_CONFIG` + Qinglong script setup — everything (recipients, templates, push logs, settings) lives in the DB and is editable from the UI. Sign-in is **better-auth** (Google / GitHub social login, login == signup); every row is scoped to its owner (`ownerId`), so each account only ever sees its own data.

- `src/app/` — App Router pages (`/`, `/login`, `/privacy`, `/terms`, dashboard `/dashboard/*`) + `/api/*` route handlers. `/api/auth/[...all]` is the better-auth handler. The dashboard layout is a server component that checks the session and redirects to `/login` when absent; every `/api/*` handler re-checks the session server-side (`requireSession`) and scopes its queries to `ownerId`.
- `src/database/schema.ts` — Drizzle schema with the shared `trackingFields` block (soft-delete via `isDeleted`). better-auth core tables (`user`/`session`/`account`/`verification`); business tables (`templates`, `users` recipients, `pushBatches`, `pushLogs`) carry `ownerId` → `user.id`, and `templates.code` is unique per owner. The former single-row `global_config` is now `user_config` keyed by `ownerId` (each owner's own WeChat creds, throttle knobs, cron config and push token). Type note: `User`/`NewUser` are the **recipient** rows; the auth user is `AuthUser`. Dual driver (`libsql`/Turso or `d1`) — **both run in production on Workers** — wired via `@cdlab/db/web` (`src/lib/db.ts` is a thin adapter). `DB_TYPE` switches the dialect (see `drizzle.config.ts`); `LIBSQL_URL` defaults to `file:./src/database/data.db`. Studio runs on port 3020.
- `src/services/channels/wechat.ts` — Acquires the WeChat `access_token` and sends template messages.
- `src/services/sources/{weather,hitokoto,iciba}.ts` — External data sources for template variables (basic weather via `t.weather.itboy.net`, Hitokoto quotes, iCIBA English notes).
- `src/services/calendar/` — Solar + lunar diff math built on `tyme4ts`. Each festival/anniversary has an `isLunar` toggle; lunar `MM-DD` is converted to the next solar occurrence and rendered with a `(农历)` suffix.
- `src/services/template/render.ts` — `{{var.DATA}}` substitution with color spans; empty values render as empty strings (never leak the raw placeholder).
- `src/services/push/` — `aggregate` (per-recipient variable resolution) + `runner` (batch fan-out + log writes) + `scheduled` (cron entry).
- `src/worker/index.ts` — Custom Worker entry that wraps `.open-next/worker.js` to add `scheduled()`. Cron expression lives in `wrangler.jsonc` (`triggers.crons: ["30 23 * * *"]` = 07:30 Asia/Shanghai); the cron handler fans out **per owner** — it scans every `user_config` row with `cronEnabled` and pushes that owner's `cronUserIds`. Pause/resume per owner from `/settings` without redeploying.
- `src/lib/auth.ts` — `getAuth()` builds the better-auth instance per request (CF bindings/env only exist inside a request). `requireSession(req)` gates console APIs; `requireOwner(req)` gates the push API and resolves the owner from either the session cookie or a `Authorization: Bearer <pushApiToken>` (the token maps back to its owner). `src/lib/auth-client.ts` is the client (`authClient` — Google/GitHub).
- `public/data/city-codes.json` — 3240 CMA station codes (9-digit) for the weather city picker; refresh with `pnpm gen:cities`. District-level codes that itboy doesn't index fall back to the city-level code (`xxxxxx01`).
- **Auth model**: better-auth session (Google/GitHub) gates the whole console — the dashboard layout server-checks it and every console `/api/*` route runs `requireSession` and filters by `ownerId`, so the APIs are **server-authorized** (no more client-only gate). The push API (`/api/push/run`, `/api/push/retry`, batch retry) uses `requireOwner`: a session cookie OR a per-owner `Authorization: Bearer <pushApiToken>` (each owner's `user_config.pushApiToken`, auto-generated on first `/settings` load, re-generable from Settings). `GET /api/settings` masks `wechatAppSecret` and `pushApiToken` — only writable (PATCH) or revealed once on rotate. Same email across Google/GitHub links to one account (`accountLinking.trustedProviders`). Required env/secrets: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (no trailing slash), `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`; OAuth callback is `<BETTER_AUTH_URL>/api/auth/callback/{google,github}`.
- Builds with **OpenNext for Cloudflare** (`@opennextjs/cloudflare`). Deploys with `pnpm --filter @cdlab/wepush deploy`.

#### `vidl` — Video downloader

Pure-browser stream download — `mux.js` + Streams API, near-zero memory footprint.

- `src/lib/download-engine.ts` — Core engine; pause/resume; exponential-backoff retry.
- `src/lib/m3u8-parser.ts` — Parses M3U8 manifest, extracts segments + AES-128 key URLs.
- `src/lib/aes-decryptor.ts` — Streaming AES-128-CBC decrypt of TS segments.
- `src/lib/video-utils.ts` — TS-to-MP4 mux via `mux.js`.
- `src/lib/batch-utils.ts` — Range download + batch parallelism.
- `src/stores/` — `download-store`, `batch-store`, `settings-store`.

#### `byplay` — Online HLS/MP4 player

- `src/components/player/` — HLS.js wrapper with ABR config, retry/buffer settings.
- Reports playback events to `byplay-log` worker (configurable endpoint).
- Has a "jump to vidl" quick-action for downloading the current video.

#### `bytts` — Text-to-speech tool

- `src/app/api/tts/` — Edge route that calls Microsoft Azure Cognitive Services Speech SDK with SSML; streams audio back.
- `src/app/api/config/` — Endpoint for managing custom API providers (the recently added "API manager" feature).
- `src/lib/builtin-apis.ts` — Built-in Azure API definitions; user-added APIs are stored client-side and can override builtins (see recent commits: batch-deletion + builtin-override).
- `src/store/useApiStore.ts` — Zustand store of user-configured APIs (with custom auth headers per recent feature add).

#### `values` — Crypto/fiat/commodity comparison

- `src/lib/currencies.ts`, `rates.ts`, `exchangeRate.ts` — Static currency catalog + live rate fetch.
- No backend; rates are pulled from public APIs at runtime.

#### `byshot` — Cloudinary-backed personal photography collection

- `src/app/page.tsx` — RSC entry: fetches the Cloudinary folder listing, generates blur placeholders, then hands off to `Gallery`. Server-rendered; deploys to Cloudflare Pages via the `next-on-pages` build command (see the table above).
- `src/app/p/[photoId]/page.tsx` — Single-photo carousel route (deep-linkable).
- `src/utils/cachedImages.ts` — Module-level cache around `cloudinary.v2.search.expression('folder:${CLOUDINARY_FOLDER}/*')`. Memoizes across requests within the same isolate; Edge cold-starts refetch.
- `src/utils/generateBlurPlaceholder.ts` — Fetches an 8px-wide Cloudinary JPEG and inlines it as a base64 data URL using native `Uint8Array` + `btoa()` (no `node:buffer`, so it works on the Edge runtime).
- `src/components/Gallery.tsx` — Masonry grid (`columns-1 sm:columns-2 xl:columns-3 2xl:columns-4`); clicking a photo pushes `?photoId=N` to open `Modal`.
- `src/components/Modal.tsx` — Lightbox built on `@cdlab/ui/components/dialog` (`Dialog` + `DialogPortal` + `DialogOverlay`) plus `radix-ui` `Dialog.Content` for full-screen layout — the wrapper `DialogContent` hardcodes centered-card styling, so the primitive is used directly to satisfy the lightbox layout while still routing through the shared `Dialog` root.
- `src/components/SharedModal.tsx` — Image swap with `motion`/`AnimatePresence`, `react-swipeable` for touch, bottom thumbnail strip filtered to ±15 around `index`. All icons are `lucide-react`.
- `src/utils/useLastViewedPhoto.ts` — Zustand store powering scroll-restore after closing the lightbox.
- `src/types/react-use-keypress.d.ts` — Local ambient declaration; `react-use-keypress` ships no types.
- Cloudinary credentials are required at runtime (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`); without them the SSR page throws `Must supply cloud_name`.

### Nuxt 4 app

#### `repo-changelog` — GitHub release/changelog dashboard

- `nuxt.config.ts` — Modules: `@nuxt/ui`, `@nuxtjs/mdc`, `@vueuse/nuxt`. ISR on `/` (60s revalidate). MDC with diff/ts/tsx/vue/css/sh/js/json highlighting.
- Backend data source: `https://ungh.cc` (configurable via `API_URL` env). No own server.
- `app/pages/`, `app/components/`, `app/composables/`, `app/plugins/` — standard Nuxt 4 layout.
- `shared/types/` — Types shared with the server bundle.
- **Excluded from root Biome** (has its own ESLint via `@nuxt/eslint` if added). Don't try to apply root lint rules here.

### Shared packages

#### `@cdlab/ui` — Shared React/Tailwind v4 component library

- **No build step** — exposes raw source via subpath exports:
  - `./globals.css` — Tailwind v4 entry (apps import this from their `globals.css`)
  - `./components/<name>` → `src/components/<name>.tsx` (shadcn/ui primitives, ~50+)
  - `./hooks/<name>` → `src/hooks/<name>.ts`
  - `./lib/<name>` → `src/lib/<name>.ts`
  - `./icon/<name>`, `./IK/<name>`, `./reactbits/<name>` → curated icon sets and React Bits effects
  - `./postcss.config` → shared Tailwind PostCSS config
- **Biome ignores** `src/components/**/*.tsx` and `src/reactbits/**/*.tsx` (3rd-party-derived; don't lint).
- Consumers add it as `"@cdlab/ui": "workspace:*"` and import like `import { Button } from '@cdlab/ui/components/button'`.

#### `@cdlab/utils` — Generic utilities

- Built with `tsdown`, tested with `vitest`. Consumers import from `dist/index.mjs`.
- Modules: `clipboard`, `download`, `format`, `logger`, `np` (numerical-precision math), `password`. All re-exported from `src/index.ts`.
- `download` exposes `downloadFile` (single file via Blob or URL) and `downloadFilesAsZip` (batch ZIP via dynamic `jszip` import; ZIP naming convention: `{prefix}_yyyyMMdd_HHmmss.zip`, caller only passes prefix).
- After editing, run `pnpm --filter @cdlab/utils build` (or `dev --watch`) so consumers see updates.

#### `@cdlab/cipher` — Stream cipher library

- XChaCha20-Poly1305 + Argon2id (password mode) and ECIES (public-key mode) — both with a custom stream chunk format (see `header.ts`).
- Public API:
  - `streamCrypto.encrypt.withPassword | withPublicKey`
  - `streamCrypto.decrypt.withPassword | withPrivateKey`
  - `textCrypto.encrypt | decrypt`
  - Also exports the lower-level `StreamCipher`, `parseStreamHeader`, `detect`, error classes.
- `src/constants.ts` — `MAGIC_BYTES` and `CONFIG` (chunk sizes, KDF params). Don't change without bumping the header version — old ciphertexts would become unreadable.
- Used by `dropply-web`.
- Tested with vitest + happy-dom.

#### `@cdlab/uncrypto` — Cross-runtime crypto shim

- Two-file package: `crypto.node.ts` (Node `webcrypto`) and `crypto.web.ts` (browser `crypto`). Resolved at build via tsdown.
- Used wherever code runs in both Workers/browser and Node test runners.

#### `@cdlab/db` — Shared Drizzle DB factory + query helpers

Built with `tsdown`. The single source of truth for the dual-driver (`d1` / `libsql`) DB wiring across `dropply-api`, `flnk`, and `wepush` — each app's `src/lib/db.ts` is now a thin adapter over this package (no more divergent hand-rolled `DatabaseManager` / `getDb` copies).

- **Two runtime entries** — pick by the app's bundler, NOT auto-selected (explicit subpaths avoid Hono-on-miniflare picking the wrong client):
  - `@cdlab/db/node` → uses `@libsql/client` (Node entry, supports `file:` local SQLite). For plain-wrangler **Hono** workers (`dropply-api`) + Node test runners.
  - `@cdlab/db/web` → uses `@libsql/client/web` (pure fetch/ws, bundles under OpenNext esbuild). For **Next.js / OpenNext** apps (`flnk`, `wepush`). Remote Turso only, no `file:`.
- `defineDb(schema)` returns a keyed-cached `getDb(env: DbEnv)`; `DbEnv` = `{ DB_TYPE?, DB?, LIBSQL_URL?, LIBSQL_AUTH_TOKEN? }`. `DB_TYPE` ('libsql' default | 'd1') selects the driver. Each app builds `DbEnv` from its own source (Hono `c.env`; OpenNext injected env / `getCloudflareContext()` with `process.env` fallback).
- Exported `Db<TSchema>` = `BaseSQLiteDatabase<'async', unknown, TSchema>` — driver-agnostic; `.batch` etc. need narrowing.
- `./utils` (also re-exported from `/node` and `/web`) — `trackingFields` query helpers: `notDeleted`, `withNotDeleted`, `softDelete`, `isNotExpired`, `withNotDeletedAndNotExpired`, `withUpdatedTimestamp`, `isExpired`.
- `@libsql/client` / `drizzle-orm` are kept **external** in the build so consumers resolve them — critical so the OpenNext apps' `serverExternalPackages` (`@libsql/client`, `@libsql/hrana-client`, `@libsql/isomorphic-ws` in `next.config.ts`) still matches the import and wrangler resolves the libsql chain via the `workerd` export condition.

#### `@cdlab/tsconfig` — Shared TS configs

- `base.json` — strict, NodeNext, ES2017. Used by everything.
- `nextjs.json`, `hono.json`, `react-library.json`, `utils.json` — overlay presets per app type.

## Conventions

### Lint & format (Biome, not ESLint/Prettier)

- Single quotes, no semicolons, 2-space indent, `organizeImports: on`, formatter on by default in `.vscode/settings.json`.
- Non-default rules **at error level**:
  - `useImportType` (separated) — write `import type { X }` not `import { type X }`
  - `noFloatingPromises`, `noMisusedPromises` (nursery) — every async call must be awaited or explicitly handled
  - `noTsIgnore` — use `// @ts-expect-error` instead
  - `noDelete` — don't `delete obj.prop`
  - `useDateNow` — `Date.now()` not `new Date().getTime()`
  - `noRestrictedImports` for zod — **`import * as z from 'zod'`** is mandatory; `import { z } from 'zod'` will fail lint
- Per-app linter "domains" are scoped via `biome.json` `overrides`: `next` + `react` for the Next apps listed in `overrides[1].includes`, `vue` for `repo-changelog`. Other apps get the recommended-off baseline.
- `repo-changelog`, `byplay-log/src/database/**/*.{json,sql}`, `dropply-api/src/database/**/*.{json,sql}`, `flnk/src/database/**/*.{json,sql}`, `wepush/src/database/**/*.{json,sql}`, and parts of `packages/ui/src/{components,reactbits}/**/*.tsx` are **excluded from Biome** entirely.

### Dependency versions live in pnpm catalogs

`pnpm-workspace.yaml` defines two catalogs (`prod`, `dev`). Reference them as `"react": "catalog:prod"` / `"typescript": "catalog:dev"` in any package.json. Only add a literal version when the dep isn't in the catalog. Bumping a shared dep means editing `pnpm-workspace.yaml`, not each package.

### Cross-package imports use the workspace protocol

`"@cdlab/utils": "workspace:*"`. Workspace packages built by tsdown (`utils`, `cipher`, `uncrypto`) ship from `dist/`; if you edit one and the consumer can't resolve a new export, rebuild it (`pnpm --filter <pkg> build`) or run `dev --watch`. `pnpm prepare` (auto-run after install) builds them in topological order.

### i18n

- Next-intl: `apps/<app>/messages/{en,zh}.json`. The generated `apps/*/messages/en.d.json.ts` is gitignored (see `.gitignore`) and excluded from Biome.
- `locale` segment in `app/[locale]/` (where present) is wired through `middleware.ts`.
- All user-facing strings should have keys in both `en.json` and `zh.json`.

### IDs

- `@cdlab/driftflake` (catalog dep) is the standard ID generator across apps.
- Database tables in `dropply-api`, `byplay-log`, and `wepush` use UUID v4 (or auto-increment for `playerLogs`). `flnk.links` uses a user-facing `slug` with a `(slug, domain)` composite unique key.

### Soft delete

Drizzle tables share a `trackingFields` block: `createdAt`, `updatedAt` (auto-updated via `$onUpdateFn`), `isDeleted` (default 0). Never hard-delete; filter with `eq(table.isDeleted, 0)` — or the shared helpers from `@cdlab/db/utils` (`notDeleted`, `withNotDeleted`, `softDelete`, `isNotExpired`, …).

### API response envelope (Workers)

Hono workers return `{ statusCode, message, stack? }` for errors (with `stack` only when `isDebug` is true) and route-specific shapes for success. The pattern is consistent across `dropply-api`, `byplay-log`, `live-user`. Global error/404 handlers are wired in each `index.ts`.

### Misc

- `nsl` proxy means the dev URL is **always** `http://<name>.localhost:3355`. Don't add port discovery code — it's handled.
- Scripts in `scripts/` are bash (`bash ./scripts/<name>.sh`).
- Turbo concurrency is set to 50 (`turbo.json`).
- Default formatter (`.vscode/settings.json`) is `biomejs.biome` for ts/tsx/json/jsonc/svelte/vue/astro; `mdx` is Prettier.
- `i18n-ally.localesPaths` in `.vscode/settings.json` lists every messages dir — keep this in sync if you add a new app with i18n.
