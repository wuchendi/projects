# bycut — Design

> A 100% client-side, browser-based video editor. The editing model is a set of
> in-memory **manager singletons** (observer pattern) bridged to React through
> `useSyncExternalStore`; every mutation is a **command** on an undo/redo bus;
> compositing and export run on `OffscreenCanvas` through **mediabunny**; AI
> captions run **Whisper on WebGPU** in a Web Worker. Projects persist to
> IndexedDB (structured data) + OPFS (raw media). There is no server component.

This is the authoritative design spec; the implementation follows it. Section
numbers are stable anchors — source comments and reviews reference them as
`design §N`. Where this doc and older README copy disagree, this doc wins (most
notably: **mediabunny, not FFmpeg.wasm**; see §5.4).

**Contents**

1. [Background & goals](#1-background--goals)
2. [Architecture](#2-architecture)
3. [The manager core & React bridge](#3-the-manager-core--react-bridge)
4. [Commands & undo/redo](#4-commands--undoredo)
5. [The render tree & export](#5-the-render-tree--export)
6. [Storage & persistence](#6-storage--persistence)
7. [Migrations](#7-migrations)
8. [Playback & audio](#8-playback--audio)
9. [Transcription (AI captions)](#9-transcription-ai-captions)
10. [Data model](#10-data-model)
11. [Concurrency & lifecycle gotchas](#11-concurrency--lifecycle-gotchas)
12. [Configuration & deployment](#12-configuration--deployment)

---

## 1. Background & goals

Cloud video editors are thin clients in front of a render farm: footage is
uploaded, transcoded server-side, and the user waits. That is slow, expensive per
minute, and privacy-hostile. `bycut` inverts the model — a **static site** that
does real decode/composite/encode in the tab — and holds itself to these goals:

- **G1 — Local by construction.** Media never leaves the machine. Decode,
  compositing, and encode happen in-browser (mediabunny/WebCodecs +
  `OffscreenCanvas`). No account, no backend, no per-minute cost.
- **G2 — A real editor.** Multi-track timeline, scenes, transitions, text/stickers,
  keyframe transforms, speed/reverse, detach-audio — with **complete undo/redo**.
  Every mutation is a reversible command.
- **G3 — Deterministic render.** The preview and the export must produce the same
  frames from the same render tree; the render tree is a pure function of
  tracks + media + settings.
- **G4 — Durable without a server.** Autosave + a `beforeunload` guard; projects
  survive reloads via IndexedDB/OPFS; a versioned migration chain evolves the
  on-disk schema safely.
- **G5 — On-device AI.** Whisper transcription runs in a Worker on WebGPU; no audio
  is uploaded.

### Non-goals

- **Not a cloud editor** — no server render, no accounts, no real-time
  collaboration. Export is bounded by the device's CPU/GPU/memory.
- **No FFmpeg.wasm** — all media I/O is mediabunny + `@mediabunny/mp3-encoder`
  (WebCodecs). Do not reintroduce an FFmpeg dependency.
- **AI captions have no CPU fallback** — WebGPU is a hard requirement.
- **No cross-device sync** — storage is per-origin browser storage; clearing site
  data deletes everything.

---

## 2. Architecture

`bycut` is a **Next.js App Router app compiled to a static export** — there is no
Node/edge runtime and no `app/api` directory. `next.config.ts` sets `output:
'export'` and wraps the config with `next-intl/plugin`.

```
                        the browser tab (no server)
  ┌───────────────────────────────────────────────────────────────┐
  │  React UI  (src/components/editor/*, src/hooks/*)               │
  │     ▲ useSyncExternalStore                    ▲ Zustand         │
  │     │ (src/hooks/use-editor.ts)               │ (src/stores/*)  │
  │  ┌──┴───────────────────────────────┐   ┌─────┴──────────────┐  │
  │  │ EditorCore singleton             │   │ UI-only state:     │  │
  │  │ (src/core/index.ts)              │   │ panels, layout,    │  │
  │  │  10 managers, observer pattern   │   │ keybindings, …     │  │
  │  └──┬────────────┬───────────┬──────┘   └────────────────────┘  │
  │     │ commands   │ render    │ persist                          │
  │  ┌──┴──┐   ┌─────┴──────┐  ┌─┴──────────────┐  ┌─────────────┐  │
  │  │ undo │   │ renderer   │  │ storageService │  │ transcription│ │
  │  │ bus  │   │ (mediabunny│  │ IndexedDB+OPFS │  │ Worker(WebGPU)│ │
  │  └──────┘   │ OffscreenC)│  └────────────────┘  └─────────────┘  │
  │             └────────────┘                                      │
  └───────────────────────────────────────────────────────────────┘
```

**Routing hierarchy** (locale-aware, `en`/`zh` from `src/i18n/routing.ts`):

- `src/app/page.tsx` → `redirect('/en')`.
- `src/app/[locale]/layout.tsx` — real HTML shell: `generateStaticParams`
  (`en`/`zh`), heavy `generateMetadata` (SEO/OpenGraph), 4 JSON-LD blocks, Geist
  fonts, `NextIntlClientProvider` + `ClientProviders` + `Toaster`.
- `src/app/[locale]/page.tsx` → `redirect('/{locale}/projects')`.
- `src/app/[locale]/projects/page.tsx` — project gallery (create/rename/duplicate/
  delete, sort/search).
- `src/app/[locale]/editor/page.tsx` — the editor. Reads `?projectId=` from
  `window.location.search`, redirects to `/projects` if absent, wraps everything in
  `<EditorProvider>` and a nested resizable panel layout (assets / preview /
  properties / timeline).
- `src/middleware.ts` — `next-intl` locale middleware. **Note:** middleware does
  not run under pure static export/Pages; it is a dev/SSR artifact.

**Three state seams** (know which one you're touching):

1. **Domain state** = manager singletons, observer pattern (§3). Source of truth
   for the project.
2. **UI-only state** = Zustand stores (`src/stores/`) — panel sizes, layout guide,
   keybindings, clipboard/snapping flags. Persisted where marked.
3. **Event bus** = `window` CustomEvents `playback-seek` / `playback-update`
   (§8) — connect playback → audio/preview without a subscribe edge.

---

## 3. The manager core & React bridge

`src/core/index.ts` — **`EditorCore` is a hard singleton** (`getInstance()` /
`reset()`). Its constructor instantiates 10 managers (each receives `this` so a
manager can reach its siblings) and calls `save.start()`:

```
command, playback, timeline, scenes, project, media, renderer, save, audio, selection
```

No React context provides `EditorCore`; every hook reaches the *same* instance via
`getInstance()`. `reset()` exists but is **not** wired to route changes — treat the
instance as process-global for the tab's life.

**Observer pattern.** Each manager holds plain in-memory state and exposes a
`subscribe(listener)` / `notify()` pair backed by its own `Set` of listeners. A
manager `notify()`s after any state change.

**React bridge.** `src/hooks/use-editor.ts` subscribes to *all* managers and
folds them into a **single `useSyncExternalStore` version counter** — any
manager's `notify()` bumps the counter and re-renders subscribed components.
Non-React code reaches translations through a module-global bridge
(`I18nBridge` in `src/components/providers/i18n-provider.tsx`, `src/lib/i18n.ts`).

### 3.1 Manager responsibilities

| Manager | File | Responsibility |
| --- | --- | --- |
| `command` | `commands.ts` | Undo/redo bus: `history[]` + `redoStack[]`; `execute/undo/redo/canUndo/canRedo/clear`. Executing clears the redo stack (§4). |
| `timeline` | `timeline-manager.ts` | All timeline mutations; **every method builds a Command and routes through `command.execute()`**. Tracks live in the active scene (`getTracks()` reads `scenes.getActiveScene().tracks`). Owns transitions (video tracks only). |
| `scenes` | `scenes-manager.ts` | Scene list + active scene + bookmarks. `updateSceneTracks` writes tracks back into the scene and syncs the active project. Auto-ensures a main scene + main track. |
| `project` | `project-manager.ts` | CRUD/load/save/duplicate/delete, settings, **thumbnail generation** (one frame at ⅓ duration via `CanvasRenderer`, max width 320, JPEG 0.7), **export** + **audio export** (delegates to renderer), and storage-migration orchestration. |
| `media` | `media-manager.ts` | In-memory `MediaAsset[]`, persistence via `storageService`, `URL.revokeObjectURL` cleanup, cascades element deletion when media is removed, integrates `videoCache`. |
| `playback` | `playback-manager.ts` | play/pause/seek/volume/mute/scrubbing; RAF clock; broadcasts `playback-seek` / `playback-update` window CustomEvents (§8). |
| `audio` | `audio-manager.ts` | Web Audio scheduling (§8). |
| `renderer` | `renderer-manager.ts` | Holds the current render tree (`RootNode`); `exportProject()` builds scene + optional audio buffer and drives `SceneExporter`, polling a 100ms cancel `setInterval`. |
| `selection` | `selection-manager.ts` | Selected-elements list. |
| `save` | `save-manager.ts` | Autosave (§6.3). |

### 3.2 Representative flow

"User drops a video on the timeline; it renders in the preview":

1. A timeline UI hook (`src/hooks/timeline/`) calls
   `editor.timeline.insertElement(...)`.
2. That builds `InsertElementCommand` (`src/lib/commands/timeline/element/
   insert-element.ts`) and runs it through `CommandManager.execute` → pushes to
   history. The command validates the element, auto-picks/creates a track, and —
   for the **first** visual element only — sets canvas size/fps from the asset
   with `pushHistory: false`. It calls `editor.timeline.updateTracks(...)`.
3. `updateTracks` → `scenes.updateSceneTracks` writes tracks into the active scene
   + active project, then `notify()`s.
4. Two subscribers react: (a) `SaveManager` marks dirty → 800ms later
   `project.saveCurrentProject()` → `storageService.saveProject`; (b) the preview
   panel rebuilds the render tree via `buildScene(...)` and stores it with
   `renderer.setRenderTree`.
5. The preview RAF loop (`useRafLoop`) calls
   `new CanvasRenderer(...).render({ node: renderTree, time })` each frame. A
   `VideoNode` pulls a decoded frame from `videoCache.getFrameAt(...)` and draws it.
6. On playback, `AudioManager` schedules the clip's audio through the Web Audio
   graph in sync with `playbackStartContextTime`.

---

## 4. Commands & undo/redo

`src/lib/commands/` — the **Command pattern** is the only sanctioned way to mutate
project state. `base-command.ts` defines `execute()` / `undo()` with `redo()`
defaulting to `execute()`; `batch-command.ts` executes forward and undoes in
reverse.

`CommandManager` (`src/core/managers/commands.ts`) keeps `history[]` and
`redoStack[]`: `execute(cmd)` runs the command and pushes it, **clearing the redo
stack** (a new action forks the timeline). `undo`/`redo` move commands between the
two stacks. `TimelineManager` methods never mutate tracks directly — they
construct a command and hand it to `execute`, so every timeline change is
reversible and observable.

Command categories:

| Category | Path | Examples |
| --- | --- | --- |
| media | `commands/media/` | add / remove media asset |
| project | `commands/project/` | project-level settings |
| scene | `commands/scene/` | create / delete / rename / bookmarks |
| timeline element | `commands/timeline/element/` | insert / delete / move / split / trim / duration / duplicate / detach-audio / toggle |
| timeline track | `commands/timeline/track/` | add / remove / reorder / toggle |
| clipboard | `commands/timeline/clipboard/` | paste |

**Gotcha — non-undoable side effect.** Inserting the *first* visual element
mutates project canvas size + fps from the asset with `pushHistory: false`
(`insert-element.ts`). That implicit settings change is **not** on the undo stack.

---

## 5. The render tree & export

`src/services/renderer/` is the compositing engine. It is deterministic: the same
render tree at the same `time` produces the same pixels in both preview and export.

### 5.1 `scene-builder.ts`

`buildScene(...)` is a **pure function** turning tracks + media + background into a
`RootNode` tree. It handles: track ordering (the main track draws at the bottom),
z-order, transition pairing (look-ahead adjacency + a `transitionLookup`), and
blur-background wrapping.

### 5.2 `canvas-renderer.ts`

Wraps `OffscreenCanvas` (falls back to `HTMLCanvasElement`). `render({node, time})`
clears to black then recurses the node tree; `renderToCanvas` blits the result to a
target canvas (used for the live preview and for thumbnails).

### 5.3 The node tree (`nodes/`)

`base-node` → `visual-node` (abstract: `getLocalTime` handles
playbackRate/reversed/trim; `renderVisual` handles contain-fit + transform / rotate
/ flip / opacity) → concrete `video-node`, `image-node`, `text-node`,
`sticker-node`, `color-node`, `blur-background-node`, `transition-node`,
`root-node`. `VideoNode.render` pulls a decoded frame from `videoCache` (§8/§11).

### 5.4 `scene-exporter.ts` (encode)

`SceneExporter extends EventEmitter` (`eventemitter3`) and encodes frame-by-frame
with **mediabunny** (`Output`, `CanvasSource`, `AudioBufferSource`, and
`Mp4OutputFormat` / `WebMOutputFormat`):

- Codecs: `avc` + `aac` (mp4) or `vp9` + `opus` (webm).
- Quality maps to mediabunny `QUALITY_*`.
- Supports cancel; emits `progress` / `complete` / `error` / `cancelled`.

`RendererManager.exportProject()` builds the scene + an optional mixed audio buffer
and drives the exporter, polling a 100ms `setInterval` for cancellation. **There is
no FFmpeg anywhere** — mp3 audio export uses `@mediabunny/mp3-encoder`.

---

## 6. Storage & persistence

`src/services/storage/` — `storageService` is a singleton. **The driver is chosen
by data type, not by a single toggle:**

| Data | Driver | Store name |
| --- | --- | --- |
| Project documents | IndexedDB (`indexeddb-adapter`) | `video-editor-projects` |
| Media **metadata** | IndexedDB (per project) | `video-editor-media-{projectId}` |
| Media **binary files** | OPFS (`opfs-adapter`) | `media-files-{projectId}` |
| Saved sounds | IndexedDB | `video-editor-saved-sounds` |

`isFullySupported()` requires **both** IndexedDB and OPFS; `storage-provider.tsx`
runs the check on mount and fires a warning toast if either is missing.

### 6.1 Adapters

- `indexeddb-adapter.ts` — generic KV over IndexedDB (keyPath `id`), with a
  `deleteDatabase` helper.
- `opfs-adapter.ts` — Origin Private File System adapter; static `isSupported()`
  gate; declares an async-iterator augmentation for `FileSystemDirectoryHandle`.

### 6.2 Serialization

On save: Dates → ISO strings; audio `buffer` fields are **stripped** (they are
re-decoded on demand and would bloat storage); project `duration` is recomputed via
`getProjectDurationFromScenes`. On load: object URLs are reconstructed (SVG images
with empty MIME are special-cased). Storage stats come from
`navigator.storage.estimate()`.

### 6.3 Autosave

`SaveManager` subscribes to `scenes` + `timeline`, debounces **800ms**
(`markDirty → queueSave → saveNow`), and supports pause/resume/flush. It **skips
while loading or migrating**. `getIsDirty()` drives the `beforeunload` guard wired
in `EditorProvider` → `EditorRuntimeBindings`, so the tab prompts before closing
with unsaved changes.

---

## 7. Migrations

`src/services/storage/migrations/` — versioned **project** migrations.
`CURRENT_PROJECT_VERSION = 4` (`index.ts`); the chain is `v0 → v1 → v2 → v3 → v4`.

`runner.ts`:

- **Version inference** — a numeric `version` field if present; else a
  scenes-array shape ⇒ v1; else v0.
- Runs ordered transforms (data transforms live in `migrations/transformers/`;
  `v1-to-v2.ts` is the largest, ~18KB).
- Enforces a **1s minimum dialog display** (`MIN_MIGRATION_DISPLAY_MS = 1000`) so
  the migration UI never flickers.
- One-time deletes the legacy `video-editor-meta` DB.

**Two entry points, idempotent.** Both `StorageService.ensureMigrations` and
`ProjectManager.ensureStorageMigrations` call `runStorageMigrations`; the latter
drives the migration progress dialog. Both are promise-memoized
(`migrationsPromise` / `storageMigrationPromise`) so the work runs once.
`__tests__/` (with `fixtures/`) are the **only** automated tests in the app.

**Keybindings** have their own independent migration chain under
`src/stores/keybindings/migrations/` (`CURRENT_VERSION`).

---

## 8. Playback & audio

**Playback clock.** `PlaybackManager` runs a RAF-driven clock for play/pause/seek/
scrub and broadcasts two `window` CustomEvents: `playback-seek` (on seek/scrub) and
`playback-update` (per tick). This event-bus seam sits **alongside** the observer
model — the audio subsystem and preview listen to these events rather than
subscribing to the manager.

**Web Audio.** `AudioManager` builds an `AudioContext` + a master `GainNode`,
decodes buffers (cached by `sourceKey`), and schedules `AudioBufferSourceNode`s
aligned to `playbackStartContextTime`. It subscribes to playback/timeline/media and
to the `playback-seek` window event, with a 300ms debounce on timeline changes. Key
correctness details:

- `decodeAudioData(arrayBuffer.slice(0))` — decode a **copy** to avoid
  detached-buffer errors.
- `playbackSessionId` — a monotonic id that **invalidates stale async
  scheduling** (a seek during an in-flight decode must not schedule the old audio).

---

## 9. Transcription (AI captions)

`src/services/transcription/` — on-device Whisper via Transformers.js.

- `worker.ts` — a **module Web Worker** running `@huggingface/transformers`;
  `pipeline('automatic-speech-recognition', …)` with **`device: 'webgpu'`** (a hard
  requirement — no CPU/WASM fallback). Uses `WhisperTextStreamer` for streaming
  token/chunk callbacks, aggregates per-file model-download progress, tunes chunk
  length for the distil model, and supports cancel.
- `service.ts` — `transcriptionService` singleton; spawns the worker via
  `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`,
  manages init / model-swap lifecycle, **transfers** the audio `Float32Array`
  buffer (zero-copy), and resolves streaming updates.
- Models & defaults live in `src/constants/transcription-constants.ts`
  (`whisper-tiny|base|small|large-v3-turbo`, `distil-small.en`; default
  `whisper-base`). Weights stream from the Hugging Face CDN and cache in the browser.

---

## 10. Data model

Types: `src/types/project.ts`, `src/types/timeline.ts`, `src/types/assets.ts`;
storage shapes in `src/services/storage/types.ts`.

- **`TProject`** — `{ metadata: TProjectMetadata (id, name, type, thumbnail,
  duration, createdAt, updatedAt), scenes: TScene[], currentSceneId, settings:
  TProjectSettings (fps, canvasSize, originalCanvasSize, background), version,
  timelineViewState }`. New projects default to `DEFAULT_FPS`,
  `DEFAULT_CANVAS_SIZE`, `DEFAULT_COLOR` background, `version = 4`
  (`project-manager.createNewProject`).
- **`TScene`** — `{ id, name, isMain, tracks: TimelineTrack[], bookmarks,
  createdAt, updatedAt }`. Always guaranteed a main scene + main track
  (`ensureScenesHaveMainTrack`).
- **`TimelineTrack`** (video / audio / text) with `elements[]`; a `VideoTrack`
  also has `transitions: TrackTransition[]`. Elements (video/image/audio/text/
  sticker) carry `startTime`, `duration`, `trimStart`, `trimEnd`, `transform`,
  `opacity`, plus type-specific fields (`playbackRate`, `reversed`, `mediaId`,
  `content`, `iconName`…).
- **`MediaAsset`** — `{ id, name, type, file: File, url, width, height, duration,
  thumbnailUrl, ephemeral }`. Persisted split: `MediaAssetData` metadata
  (IndexedDB) + raw `File` (OPFS).

**IDs.** Snowflake-style via `@cdlab/driftflake` `GenidOptimized({ workerId: 1 })`
(`src/utils/genid.ts`), stringified.

---

## 11. Concurrency & lifecycle gotchas

- **Dual state systems + an event bus.** Domain state = manager singletons
  (observer → `useSyncExternalStore`); UI state = Zustand; and a third seam —
  `window` CustomEvents (§8). Know which one you're modifying.
- **`EditorCore` is a hard singleton.** No context; `reset()` is not wired to route
  changes. Do not assume a fresh instance per navigation.
- **Manual object-URL lifecycle.** Object URLs are created and revoked by hand
  (`media-manager`, storage load) — a missed `revokeObjectURL` is a memory leak.
- **Audio session invalidation.** `AudioManager.playbackSessionId` guards against
  stale async scheduling; `decodeAudioData(buffer.slice(0))` avoids detached
  buffers.
- **Video-cache concurrency.** `videoCache` (`src/services/video-cache/`) is a
  per-media mediabunny `CanvasSink` frame provider with current/next-frame
  prefetch, a forward-iterate-vs-seek heuristic (iterate within a 2s window, else
  seek), `poolSize: 3`, `fit: 'contain'`. It **awaits pending prefetch before
  touching the iterator** and dedups init via `initPromises`; cleanup runs on media
  removal.
- **Timeline thumbnails.** `src/services/timeline-thumbnail/` uses a mediabunny
  `VideoSampleSink`, an LRU-ish cache (`MAX_CACHED_THUMBNAILS = 500`, height 120),
  and binary-search to the nearest cached time.
- **First-element canvas mutation** is non-undoable (§4).
- **Migrations run from two entry points** but are idempotent + promise-memoized
  (§7).

---

## 12. Configuration & deployment

### 12.1 Config

There is **no runtime config surface, no secrets, and no bindings** — `bycut` is a
static browser app. Build/runtime knobs:

| Knob | Where | Meaning |
| --- | --- | --- |
| `output: 'export'` | `next.config.ts` | Static export to `out/`. |
| `BUILD_TIME` | `next.config.ts` (`env`) | Build timestamp shown in the UI (`client-providers.tsx`). |
| `NODE_ENV` | — | `IS_DEV` (`src/constants/editor-constants.ts`). |
| `images.remotePatterns` | `next.config.ts` | Allowed remote image hosts. |
| locales | `src/i18n/routing.ts` | `['en','zh']`, default `en`. |
| project schema version | `src/services/storage/migrations/index.ts` | `CURRENT_PROJECT_VERSION` + chain. |
| autosave debounce | `src/core/managers/save-manager.ts` | 800ms. |
| Whisper models / chunking | `src/constants/transcription-constants.ts` | default `whisper-base`. |
| canvas/fps/color/blur defaults | `src/constants/project-constants.ts` | new-project defaults. |
| panel default sizes | `PANEL_CONFIG` in `src/constants/editor-constants.ts` | → `panel-store`. |
| export MIME / defaults | `src/constants/export-constants.ts` | mp4/webm MIME + default format/quality; codec selection + `QUALITY_*` maps live in `scene-exporter.ts` (§5.4). |
| default keybindings | `src/lib/actions/definitions.ts` (`ACTIONS.defaultShortcuts`) | via `getDefaultShortcuts()`. |
| thumbnail params | private statics in `ProjectManager` | max width 320, JPEG 0.7, time ratio ⅓. |

### 12.2 External services

All called **directly from the browser**; none proxied by this app:

- **Hugging Face model CDN** — Whisper ONNX weights (streamed once, cached).
- **Iconify** (`api.iconify.design` + `api.simplesvg.com` + `api.unisvg.com`
  failover, `src/lib/iconify-api.ts`) — sticker search.
- **Freesound** (`cdn.freesound.org`, `src/constants/sounds-data.ts`) — sound
  previews.

### 12.3 The three `/api/*` endpoints this app does not serve

`bycut` has **no** `app/api` directory, yet three features `fetch` server paths:

| Feature | Call | Source |
| --- | --- | --- |
| Text-to-speech | `POST /api/tts/generate` (returns base64 mp3) | `src/lib/tts/service.ts` |
| Reference-image upload | `POST /api/upload/image` | `src/lib/media/upload-reference.ts` |
| URL import (CORS proxy) | `GET /api/proxy/download?url=` | `src/lib/media/url-import.ts` |

These must be provided by the **deployment platform** (Cloudflare Pages Functions
or an external worker) at those paths. Core editing/export do **not** depend on
them — treat TTS, reference-image upload, and URL import as optional, platform-
provided features.

### 12.4 Build & deploy

| Command | Effect |
| --- | --- |
| `pnpm --filter @cdlab/bycut dev` | `nsl run next dev` → http://bycut.localhost:3355 |
| `pnpm --filter @cdlab/bycut build` | `next build` → static `out/` |
| `pnpm --filter @cdlab/bycut lint` | `next lint` |
| `pnpm --filter @cdlab/bycut typecheck` | `tsc --noEmit` |

Live site: static export on **Cloudflare Pages** (<https://bycut.pages.dev/>).
Because `output: 'export'` is set, `next start` and `middleware.ts` are dev/SSR
artifacts only. Root-repo lint/format is **Biome** (single quotes, no semicolons,
2-space). The only tests are the migration fixtures under
`src/services/storage/migrations/__tests__/` (no app-local `test` script; they run
under the monorepo-root runner).
