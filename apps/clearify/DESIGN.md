# clearify — Design

> A privacy-first, browser-only image & video toolbox. Three tools —
> background removal, image compression, and video compression — each a fully
> client-side pipeline that decodes, transforms, and re-encodes media inside the
> tab using WebGPU, WebAssembly, and WebCodecs. There is no server: the app is a
> static Next.js App Router SPA on Cloudflare Pages, and no file ever leaves the
> device.

This is the authoritative design spec; the implementation follows it. Section
numbers are stable anchors — reference them as `design §N`.

**Contents**

1. [Background & goals](#1-background--goals)
2. [Architecture](#2-architecture)
3. [Image compression (`/squish`)](#3-image-compression-squish)
4. [Background removal (`/bg`)](#4-background-removal-bg)
5. [Video compression (`/compress`)](#5-video-compression-compress)
6. [State & persistence](#6-state--persistence)
7. [Configuration & deployment](#7-configuration--deployment)

---

## 1. Background & goals

Every "compress this online" or "remove background" web tool follows the same
shape: upload the file to a server, wait, download the result. That model costs
the user privacy (their media sits on someone else's disk) and costs the
operator a backend to run. Modern browsers no longer require it — WebGPU, the
WebAssembly image codecs, and WebCodecs can do the same work locally.

`clearify` holds itself to these goals:

- **G1 — Zero upload.** All processing is in-tab. There is no API route, no
  server action, no backend; the "server" ships static assets only.
- **G2 — Real codecs.** Use production-grade engines (Transformers.js/ONNX,
  jSquash, `mediabunny`/WebCodecs), not a lossy canvas re-draw.
- **G3 — Batch where it pays.** Image compression must process many files with
  bounded parallelism and offer single + ZIP download.
- **G4 — Survive a reload.** Completed results persist locally so a refresh or
  tab close doesn't destroy work.
- **G5 — One static bundle.** Deploy as a Cloudflare Pages SPA with no origin
  server and no runtime configuration.

### Non-goals

- **Not a general media editor** — no timeline, layers, or filters; each tool
  does one transform.
- **Not offline-first for models** — the background-removal model weights are
  fetched from the Hugging Face Hub each session (the model cache is disabled,
  §4); the *app shell* is static, the first matte is not.
- **Not a uniform pipeline** — the three tools have deliberately different
  concurrency and persistence models (§3–§5); do not refactor them to look the
  same.
- **No server-side rendering of data** — every route is `'use client'`; there
  are no server components that fetch, no middleware, and no `runtime` export.

---

## 2. Architecture

```
                          browser tab (no backend)
  ┌───────────────────────────────────────────────────────────────┐
  │ Next.js App Router SPA  (all routes 'use client')              │
  │                                                                │
  │  /            landing + tool picker                            │
  │  /bg          Transformers.js  →  WebGPU (ONNX WASM fallback)  │
  │  /squish      jSquash WASM codecs (lazy per format)            │
  │  /compress    mediabunny  →  WebCodecs                         │
  │                                                                │
  │  Zustand persist → IndexedDB (@cdlab/zustand-idb)              │
  │    metadata + result blobs in one row per store                │
  └───────────────────────────────────────────────────────────────┘
        │ outbound network (never your files):
        ├── Hugging Face Hub   model weights (/bg)
        ├── Cloudinary         sample images
        └── Google Analytics   page views
```

**Entry surface.** `src/app/layout.tsx` is the root layout (Geist fonts, four
JSON-LD blocks, `GoogleAnalytics gaId="G-FPHG7CDDVQ"`, `IKHeader`, `Toaster`,
client providers). The four route pages (`page.tsx`, `bg/`, `squish/`,
`compress/`) plus `error.tsx` / `not-found.tsx` are the whole app. There are no
`api/` routes.

**UI stack.** Components come from the workspace package `@cdlab/ui` (shadcn
"radix-nova" primitives + `reactbits` visual components) and the `IK*` wrappers.
State is Zustand; drag-drop is `react-dropzone`; toasts are `sonner`; icons are
`lucide-react`.

**Shared lib (`src/lib/`).** Pure logic, re-exported from `index.ts`:
`wasm.ts` (lazy jSquash loader), `imageProcessing.ts` (decode/encode/getFileType),
`process.ts` (background-removal engine), `canvas.ts` + `resize.ts` (canvas
helpers), `formatDefaults.ts`, `genid.ts`
(snowflake ids via `@cdlab/driftflake`, `workerId: 1`).

> **Dead code note.** `src/hooks/useImageProcessing.ts` (a local-`setState`
> single-image variant) is **not imported by any page** — the live `/squish`
> path is `useImageQueue`. Mentioned, not deleted.

---

## 3. Image compression (`/squish`)

The canonical pipeline. **Entry:** `src/app/squish/page.tsx` +
`src/hooks/useImageQueue.ts`.

### 3.1 Ingest

`onDrop` (drop / paste / sample-image click) builds `ImageFile[]` — each with a
`genid.nextId()` id and a `URL.createObjectURL` preview — calls
`addImages()` into `useSquishStore`, then `addToQueue(id)` per file inside a
`requestAnimationFrame`.

### 3.2 Bounded parallel queue

`useImageQueue` runs a **bounded-concurrency queue, `MAX_PARALLEL_PROCESSING =
3`**, tracked via `processingCount` / `processingImages` refs. Compression
`options` and `outputType` are held in **refs**, so a job that started before a
settings change still reads the latest values when it runs. When a slot frees,
`processNextInQueue` pulls the next queued images (up to the free-slot count)
from `useSquishStore.getState().images` and dispatches them.

### 3.3 Per-image transform

Per image (`useImageQueue.processImage`):

1. `image.file.arrayBuffer()` → `getFileType(file)` — special-cases `.jxl` by
   extension and normalizes `jpeg` → `jpg` (`imageProcessing.ts`).
2. `decode(sourceType, buffer)` → `ImageData`.
3. `encode(outputType, imageData, { quality })` → `ArrayBuffer`.
4. `Blob(type: image/<outputType>)` → objectURL preview.
5. `updateImage(status:'complete', blob, compressedSize, outputType)`.

### 3.4 Lazy WASM

`decode` / `encode` both call `ensureWasmLoaded(format)` (`wasm.ts`) first,
which **lazy dynamic-`import()`s the matching `@jsquash/*` module once**,
memoized in a `Map<OutputType, boolean>`. The first image of a given format pays
the module load; subsequent ones are free.

### 3.5 Format specifics

`OutputType = 'avif' | 'jpeg' | 'jxl' | 'png' | 'webp'`. Encoder knobs
(`imageProcessing.ts`, `formatDefaults.ts`):

| Format | Quality default | Notes |
| --- | --- | --- |
| AVIF | 50 | hardcoded `effort: 4` (medium) |
| JPEG | 75 | — |
| JXL | 75 | — |
| WebP | 75 | — |
| PNG | — (lossless) | quality ignored, no default entry |

> There is **no resize on the squish path** — `lib/resize.ts` exists and is
> exported but the encode path re-encodes at the original dimensions.

### 3.6 Download

Single file → `downloadFile`; multiple → `downloadFilesAsZip(files,
'clearify')`, both from `@cdlab/utils` (ZIP name is `clearify_<timestamp>.zip`).
There is no `jszip` dependency in this app — zipping lives in `@cdlab/utils`.

---

## 4. Background removal (`/bg`)

**Entry:** `src/app/bg/page.tsx` + `src/lib/process.ts` (Transformers.js).

### 4.1 Model cascade

Three models, tried in order (`process.ts` constants):

| Model id | Backend | Role |
| --- | --- | --- |
| `wuchendi/modnet` | WebGPU | Preferred. |
| `briaai/RMBG-2.0` | WASM (ONNX) | Fallback if WebGPU init fails. |
| `briaai/RMBG-1.4` | WASM (ONNX) | Cross-browser last resort. |

The page's `ensureModelInitialized` drives the cascade with user-facing toasts;
`initializeModel(forceModelId?)` also self-recurses to RMBG-1.4 when a
WebGPU/RMBG-2.0 init throws.

### 4.2 iOS pin & WebGPU probe

- **iOS is force-pinned to RMBG-1.4** regardless of selection. iOS is detected
  via `navigator.platform` ∈ {iPad, iPhone, iPod} or the Mac-with-touch
  heuristic (`navigator.userAgent.includes('Mac') && 'ontouchend' in document`).
- WebGPU is gated on `navigator.gpu.requestAdapter()`. The ONNX WASM backend is
  configured with `proxy = true`, `numThreads = 1`, `initTimeout = 10000`, and a
  100 ms warm-up delay before loading the model.

### 4.3 Model cache disabled

Transformers.js `env` sets `allowLocalModels = false` and **`cacheDir = ''`** —
the model cache is intentionally off, so weights are re-fetched from the Hugging
Face Hub each session. This is the one network dependency of the "offline" app;
the app shell is static, the first matte is not.

### 4.4 Matte & output

`processImage(File)`: `RawImage.fromURL` → processor → model → mask resized to
the original dimensions → written into the alpha channel of a 2D canvas holding
the original → `canvas.toBlob('image/png')` → a `File` named
`<name>-bg-blasted.png`. Multiple images run **strictly sequentially** via the
`processImages` loop (contrast §3's parallel queue). The UI can then replace the
background with a solid color or a custom image, or export with transparency.

---

## 5. Video compression (`/compress`)

**Entry:** `src/app/compress/page.tsx` (`mediabunny`, WebCodecs). Single file
(`maxFiles: 1`); all state is local `useState` — **no store, no IndexedDB**.

### 5.1 Conversion

An `Input({ source: BlobSource, formats: ALL_FORMATS })` is converted through
`Conversion.init` into an `Output({ format: Mp4OutputFormat, target:
BufferTarget })` (in-memory). Three `compressionMethod` modes (`types/compress.ts`):

| Method | Target bitrate derivation |
| --- | --- |
| `quality` (default) | preset → `QUALITY_LOW/MEDIUM/HIGH/VERY_HIGH` |
| `bitrate` | `parseBitrate('2500k')` → bits/sec |
| `filesize` | `targetBits / duration − audioBits`, floored to 100 kbps |

`resolution` / `frameRate` add `height` / `frameRate` to the video options when
not `'original'`.

### 5.2 Capability negotiation

The browser's WebCodecs support is queried at runtime:

- `canEncodeVideo(codec)` — if the selected `hevc` can't encode but `avc` can,
  auto-fall back to H.264 with a toast; if neither encodes, throw.
- `canEncodeAudio('aac')` — if false, the audio track is discarded
  (`{ discard: true }`) and the output is muted with a warning.

### 5.3 Progress

`conversion.onProgress(ratio)` updates a percent (log throttled to once per
percent); the preview `<video>` scrubs to `progress%` of the duration during
processing. The output `buffer` becomes a downloadable Blob.

---

## 6. State & persistence

Two Zustand stores with `persist` middleware — `useBgStore`
(`clearify-bg-images`) and `useSquishStore` (`clearify-squish-images`). `/compress`
has no store.

### 6.1 One-tier storage

Both stores persist through `createIndexedDBStorage('clearify', 'stores')`
(`@cdlab/zustand-idb`), so metadata **and** the result `Blob` land in a single
IndexedDB row — IndexedDB uses the structured clone algorithm, so no
serialization split and no id → blob mapping is needed. The row key is the
`persist` name: `clearify-bg-images`, `clearify-squish-images`.

### 6.2 What persists

`partialize` writes **only `status:'complete'` items** and strips `file` /
`error` and the session-only objectURLs (`preview`, `processedUrl`) — originals
are never persisted, only compressed/matted results and their metadata.

### 6.3 Hydration

IndexedDB is browser-only, so both stores set `skipHydration: true` and call
`persist.rehydrate()` once on the client. `onRehydrateStorage` then rebuilds a
fresh objectURL from each persisted `Blob` (objectURLs cannot outlive the
document). ObjectURLs are revoked on remove / clear / unmount throughout to
avoid leaks.

---

## 7. Configuration & deployment

### 7.1 Config

There are **no env vars, secrets, or bindings**. The only build-time input is
`BUILD_TIME` (injected in `next.config.ts`, logged to the browser console by
`IKVersionInfo` via `ClientProviders`). `next.config.ts` also sets:

- `images.unoptimized: true` — required; Cloudflare Pages has no Next image
  optimizer.
- image `remotePatterns` allow-list: `res.cloudinary.com`, `wcd.pages.dev`.
- `allowedDevOrigins: ['clearify.a.wd.ds.cc']`.

In-code tunables live at their point of use: `MAX_PARALLEL_PROCESSING = 3`
(`useImageQueue.ts`), `DEFAULT_QUALITY_SETTINGS` (`formatDefaults.ts`), AVIF
`effort: 4` (`imageProcessing.ts`), model ids + WASM timeouts (`process.ts`),
video `defaultSettings` (`types/compress.ts`).

### 7.2 Build

`build` is `next build --webpack`. **Turbopack is deliberately not used** — the
WebAssembly async modules + workers mix requires webpack. `build:cf` runs
`@cloudflare/next-on-pages` to produce the Pages output. There is no
`wrangler.jsonc`, no edge-runtime declaration, and no test suite.

### 7.3 Deploy

Cloudflare Pages via `@cloudflare/next-on-pages`. Live at
<https://clearify.pages.dev/>. Because there is no server, deploy is purely a
static-asset publish — no migrations, no secrets, no bindings to sync.
