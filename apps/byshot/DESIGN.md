# byshot — Design

> A zero-infrastructure personal photography site. A Cloudinary folder is the
> entire backend: the site fetches the folder listing at build time, projects it
> into a lean image shape, and statically exports a masonry gallery plus one
> deep-linkable page per photo. There is no database, no app-side storage, and no
> image server — every rendered image URL is a Cloudinary transform, and the only
> persistence in-process is two per-build in-memory caches.

This is the authoritative design spec; the implementation follows it. Section
numbers are stable anchors. It is a lineage rewrite of Vercel's `next.js`
image-gallery example, re-shaped around Cloudinary folders, an `asset_id`-keyed
routing model, and Cloudflare Pages static export.

**Contents**

1. [Background & goals](#1-background--goals)
2. [Architecture](#2-architecture)
3. [Data flow](#3-data-flow)
4. [Caching model](#4-caching-model)
5. [The lightbox](#5-the-lightbox)
6. [Data model](#6-data-model)
7. [Security & hardening](#7-security--hardening)
8. [Configuration & deployment](#8-configuration--deployment)

---

## 1. Background & goals

A personal photo gallery is easy to over-build: an upload UI, object storage, a
database of image rows, a thumbnail-generation job, and an image-optimizing
server. `byshot` treats all of that as already solved by Cloudinary and ships
only the view.

- **G1 — No app-side state.** The source of truth is a Cloudinary folder; the app
  adds no database, no binding, and no persisted store.
- **G2 — Delegate image work.** Resizing, format negotiation, and CDN delivery
  happen in Cloudinary transform URLs. Next's own image optimizer is off
  (`images.unoptimized`).
- **G3 — Static export.** Every page (home + per-photo) must be resolvable at
  build time so the output is a plain static bundle for Cloudflare Pages.
- **G4 — Stable deep links.** A photo's URL is keyed by its Cloudinary
  `asset_id`, not an array index, so links survive reordering and re-uploads.
- **G5 — Edge/Workers-safe.** Build-time helpers must run under the Workers/Edge
  runtime (no Node `Buffer`), and the blur pass must stay under the subrequest
  cap.

### Non-goals

- **Not a CMS.** No in-app add/edit/delete; the Cloudinary folder is managed out
  of band.
- **Not dynamic.** No live refresh, pagination, or infinite scroll — a rebuild
  publishes new photos. More than 400 photos are truncated (§4).
- **No auth / multi-tenancy.** A single personal collection.

---

## 2. Architecture

```
                         build time (RSC)                       Cloudflare Pages
  Cloudinary ── Admin API search ──►┌──────────────────────┐      (static export)
  (folder listing)                  │ getResults() singleton│ ──► out/ (HTML + assets)
                                    └──────────┬────────────┘
                                               │ ImageProps[]
                                    ┌──────────┴───────────┐
                                    │ home / (Gallery)     │
                                    │ /p/[assetId] (SSG)   │
                                    └──────────┬───────────┘
                                               │ runtime (client)
  Cloudinary ◄── transform URLs (delivery CDN) ┘  c_scale,w_720 / w_1920 / w_8 / …
```

`byshot` is a **Next.js App Router (RSC)** app compiled to a static export
(`output: 'export'`, `next.config.ts`) and wrapped for Cloudflare Pages by
`@cloudflare/next-on-pages`. No `wrangler` config or Cloudflare
binding exists; the only Cloudflare-specific constraint is the subrequest limit
that caps the blur pass (§4).

Two entry surfaces, both statically generated:

- **Home** `src/app/page.tsx` — an RSC that fetches the folder listing and renders
  the masonry `Gallery` (client). In-grid photo viewing is a query-param modal
  (`/?photoId=<asset_id>`), so there is no separate route for it.
- **Deep link** `src/app/p/[photoId]/page.tsx` — one statically-generated page per
  photo. `generateStaticParams` pre-renders all photos; `dynamicParams = false`
  makes an unknown id `404`.

**The config looks contradictory but is deliberate:** the code fetches Cloudinary
"live" from an RSC, yet `output: 'export'` requires everything to be resolvable
at build. It works because the fetch happens *during* the build render — the
module-level caches and `generateStaticParams` make the whole site build-time
static, then next-on-pages packages it. `images.unoptimized: true` is required
for static export (no Next image server exists in a static bundle); Cloudinary
does the resizing via URL transforms instead.

---

## 3. Data flow

The home page, end to end (all at build time):

1. `HomePage()` (RSC) calls `getResults()` (`src/utils/cachedImages.ts`).
2. `getResults()` runs
   `cloudinary.v2.search.expression('folder:${CLOUDINARY_FOLDER}/*').sort_by('public_id','desc').max_results(400).execute()`
   and stores the whole `ResourceApiResponse` in a **module-level `cachedResults`
   singleton** — one Cloudinary Admin API call per build process, shared with the
   deep-link route. `cloudinary.v2` is configured once at import in
   `src/utils/cloudinary.ts` (`secure: true`).
3. Resources are mapped to the lean `ImageProps` shape: `id` = array index,
   `asset_id`, `height`, `width`, `public_id`, `format`.
4. **Blur placeholders**: only the first `BLUR_PLACEHOLDER_COUNT = 30` photos get
   one, fetched in parallel via `Promise.all(getBase64ImageUrl)`. The cap keeps
   the render under Cloudflare Workers' subrequest limit and matches what is
   visible in the first viewport (§4).
5. Data is handed to `<Gallery images={reducedResults}/>` inside `<Suspense>`.
6. `Gallery` (client) renders the masonry grid (`columns-1 sm:columns-2
   xl:columns-3 2xl:columns-4`), a hero header cell, and one
   `<Link href="/?photoId=<asset_id>" scroll={false}>` per photo. Grid image `src`
   is a `c_scale,w_720` transform; blur is applied only when `blurDataUrl` is set.
7. Clicking a photo sets `?photoId=<asset_id>`; `Gallery` reads it via
   `useSearchParams` and, if it matches an image, mounts `<Modal>` (§5).

The deep-link route (`p/[photoId]/page.tsx`) reuses the same singleton via
`loadPhoto(assetId)`, finds the photo's index, fetches its single blur
placeholder, and renders `<Carousel>`. It also emits per-photo OG/Twitter
metadata (a `c_scale,w_2560` image).

---

## 4. Caching model

There is no database and nothing persisted — but two **module-level, per-build**
in-memory caches keep the build cheap:

### 4.1 The folder-listing singleton

`cachedResults` (`src/utils/cachedImages.ts`) memoizes the entire Admin API
`search` response. Because it is module-level, the home page and every
`/p/[photoId]` page render in the same build process share **one** Admin API call
rather than one per page. This is safe precisely because the site is static: the
listing never needs to change within a build.

### 4.2 The blur `Map` cache

`getBase64ImageUrl` (`src/utils/generateBlurPlaceholder.ts`) memoizes each
placeholder in a module-level `Map` keyed by `public_id.format`, so a photo shown
on both the home grid and its deep-link page fetches its 8px transform once.

### 4.3 The subrequest cap (the key constraint)

Generating a blur placeholder is an outgoing `fetch` of a tiny
`f_jpg,w_8,q_70` transform. Cloudflare Workers cap outgoing subrequests (50 free
/ 1000 paid), so `page.tsx` fetches placeholders for **only the first 30 photos**
(`BLUR_PLACEHOLDER_COUNT`) — the ones in the first viewport. Photos past the cap
render without blur (`blurDataUrl` is `undefined`, and `getBase64ImageUrl`
returns `undefined` on a non-OK response too — the image simply renders sharp).
This is the single most important design constraint in the app.

### 4.4 The 400-photo cap

`max_results(400)` bounds both the home listing and `generateStaticParams`. A
folder with more than 400 photos is **silently truncated**; those photos never
appear and their deep links `404`. Raising the ceiling means raising both call
sites together.

---

## 5. The lightbox

One shared UI component, `src/components/SharedModal.tsx`, is driven by two
wrappers that branch on a `navigation` flag.

### 5.1 SharedModal

Renders the current image (a `c_scale,w_1280` transform when navigating, else
`w_1920`), `motion` spring slide transitions (±1000px enter/exit variants),
`react-swipeable` touch/mouse swiping, a bottom thumbnail strip filtered to the
**±15** photos around the current index (`w_180`), and top-right actions. It is
UI-only: navigation and close are callbacks passed by the wrapper.

### 5.2 In-grid modal (`Modal.tsx`)

Mounted by `Gallery` when `?photoId` matches a photo. Built on the shared
`@cdlab/ui` `Dialog` (`Dialog` + `DialogPortal` + `DialogOverlay`) plus raw
`radix-ui` `Dialog.Content`/`Title` for a full-screen, uncentered layout.
Keyboard arrows via `react-use-keypress`. **Prev/next uses
`window.history.replaceState`** to update `?photoId` without a route change or
re-render — only *close* uses `router.push('/')`. Renders `SharedModal
navigation={true}`; its top-right action is **open full-size** (`ExternalLink`).

### 5.3 Deep-link viewer (`Carousel.tsx`)

Rendered by `/p/[photoId]`. A blurred full-screen backdrop is drawn from
`blurDataUrl`; `Escape` closes. `changePhotoId` is a **no-op** (a single photo,
no in-place navigation), and close returns to `/` while recording the last-viewed
`asset_id` for scroll restoration. Renders `SharedModal navigation={false}`; its
top-right action is **Share on X** with a `byshot.pages.dev/p/<asset_id>` intent
link.

### 5.4 Scroll restoration

`src/utils/useLastViewedPhoto.ts` is a Zustand store holding `lastViewedAssetId`.
On close, the viewer sets it; back on the grid, `Gallery`'s effect scrolls that
photo into view (`block: 'center'`) and clears the store.

---

## 6. Data model

There is no database. The "model" is Cloudinary's
`ResourceApiResponse.resources`, projected into the lean `ImageProps`
(`src/utils/types.ts`):

| Field | Source | Role |
| --- | --- | --- |
| `id` | array index | Animation direction + thumbnail-strip windowing **only** — not a routing key. |
| `asset_id` | Cloudinary | **The routing key everywhere** (`/?photoId=`, `/p/[photoId]`, scroll-restore, share URL) — stable across reordering. |
| `public_id`, `format` | Cloudinary | Build every delivery/transform URL. |
| `width`, `height` | Cloudinary | Intrinsic dimensions. |
| `blurDataUrl` | derived (§4) | Optional base64 blur; only set for the first 30 (home) / current (deep-link). |

**Storage** = the Cloudinary media library; the only in-app persistence is the
two per-build in-memory caches (§4).

---

## 7. Security & hardening

Though there is no auth surface, a few deliberate hardening choices exist:

- **Edge-safe base64** — `generateBlurPlaceholder.ts` inlines the blur JPEG with a
  manual `Uint8Array` → `String.fromCharCode` → `btoa` loop rather than Node's
  `Buffer`, so it runs under the Workers/Edge runtime.
- **JSON-LD XSS hardening** — the two `<script type="application/ld+json">` blobs
  in `layout.tsx` (WebSite + Person) are injected via `dangerouslySetInnerHTML`
  with `<` manually escaped to `\u003c`, so structured data can't break out of the
  script tag.
- **CORS download** — `downloadPhoto.ts` fetches the full-size image with
  `mode: 'cors'`, converts to a blob, and triggers a client download via
  `createObjectURL` (revoked in a `finally`). Relies on Cloudinary's CORS headers.
- **`remotePatterns` allow-list** — `next.config.ts` restricts image hosts to
  `res.cloudinary.com` and `wcd.pages.dev`.
- **Client-only gradient** — the theme-dependent gradient background is rendered
  client-side only (`client-providers.tsx` reads `resolvedTheme` and gates on a
  `mounted` flag) to avoid a hydration mismatch. (`themeColor` itself is static,
  declared server-side in the `viewport` export in `layout.tsx`.)

---

## 8. Configuration & deployment

### 8.1 Config

Four runtime-required env vars, read from `process.env` (see the
[README](README.md#configuration)): `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (public,
also used in client delivery URLs), `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`
(secrets, Admin API), and `CLOUDINARY_FOLDER`. `cloudinary.v2` is configured once
at import (`src/utils/cloudinary.ts`). `BUILD_TIME` is injected at build in
`next.config.ts` and shown by the footer version badge.

### 8.2 Build & deploy

`build` runs `next build` → a static export in `out/`. `build:cf` runs
`@cloudflare/next-on-pages`, the real deploy build for **Cloudflare Pages**. There
is no `wrangler` config, no cron, and no server. `typecheck` is `tsc --noEmit`;
`lint` is `next lint` (Biome is the monorepo-level formatter). There are no
tests.

### 8.3 Constraints to preserve

- Keep the blur pass ≤ the subrequest cap (`BLUR_PLACEHOLDER_COUNT`, §4.3).
- Raise `max_results(400)` at **both** call sites together (§4.4).
- Keep `images.unoptimized: true` — a static export has no Next image server;
  Cloudinary transforms do all resizing.
- Route by `asset_id`, never the numeric `id` — the id is index-only (§6).
