# @cdlab/ui — Design

> A source-distributed React 19 component library with **no build step**. Every
> subpath in the `exports` map points straight at a `.tsx`/`.ts` file under
> `src/`; consumers compile the source inside their own bundler. It bundles
> shadcn/ui primitives, an opinionated app-shell "asset kit" (`IK/`), brand
> icons, hooks, WebGL/`motion` effects, and one Tailwind v4 theme entry whose
> `@source` globs scan the whole monorepo.

This is the authoritative design spec; the implementation follows it. Section
numbers are stable anchors. This is a **library, not an app** — there is no
server, no runtime, no deploy target, and no database.

**Contents**

1. [Background & goals](#1-background--goals)
2. [Architecture](#2-architecture)
3. [The exports contract](#3-the-exports-contract)
4. [Primitives (`components/`)](#4-primitives-components)
5. [The asset kit (`IK/`)](#5-the-asset-kit-ik)
6. [Effects, icons, hooks, lib](#6-effects-icons-hooks-lib)
7. [Styling & theming](#7-styling--theming)
8. [The RSC boundary](#8-the-rsc-boundary)
9. [Tooling: lint, type-check, shadcn CLI](#9-tooling-lint-type-check-shadcn-cli)
10. [Configuration](#10-configuration)

---

## 1. Background & goals

A shared component library in a multi-app repo normally carries a publish loop —
build to `dist/`, emit `.d.ts`, bump a version, reinstall in each consumer. In a
single Turborepo where every consumer already compiles TypeScript and processes
Tailwind, that loop buys nothing. `@cdlab/ui` removes it and holds itself to
these goals:

- **G1 — Zero build step.** Ship raw source; the consumer's bundler compiles it.
  No `dist/`, no type emit, no `build`/`dev`/`test` script.
- **G2 — Edit-and-reload.** A change to any component is visible on the next app
  reload with no rebuild/reinstall.
- **G3 — RSC-safe by default.** Server-renderable primitives must render in an
  App Router server component with no `'use client'` wrapper; only components that
  need the browser opt into client mode.
- **G4 — One theme.** A single Tailwind v4 CSS entry drives light/dark tokens for
  every consuming app, with no per-app Tailwind config.
- **G5 — CLI-extensible.** Primitives and effects are added/updated through the
  `shadcn` CLI (stock + custom registries), not hand-copied.

### Non-goals

- **Not a published package.** `"private": true`; it never leaves the monorepo,
  so backward-compat / semver of the source surface is a non-concern.
- **Not relocatable in isolation.** The theme's `@source` globs (§7) hard-code the
  `packages/ui` ↔ `apps/**` relative layout; the package can't move without
  breaking Tailwind class detection.
- **Not a single UI ecosystem beyond the primitives.** Interactive primitives
  are uniformly `@base-ui/react` (§4), but several components still wrap
  third-party drivers (`recharts`, `cmdk`, `react-day-picker`, …, §4.2).
- **No demo site / Storybook / visual tests.** Validation is delegated to the
  consuming apps and root tooling (§9).

---

## 2. Architecture

There is no runtime graph — the "architecture" is a resolution + compilation
boundary between this package and each consumer:

```
  apps/<app>  (Next.js / Vite bundler + Tailwind v4)
      │  import '@cdlab/ui/components/button'
      │  import '@cdlab/ui/IK/IKHeader'
      │  @import '@cdlab/ui/globals.css'
      ▼
  packages/ui/package.json  exports  (wildcard subpaths, no barrel)
      ▼
  src/
    components/*.tsx   59 shadcn/ui primitives   (@base-ui/react)
    IK/*.tsx           10 app-shell parts        (composed from primitives)
    reactbits/*.tsx    10 effects                (ogl / raw-WebGL / motion)
    icon/*.tsx         2 brand SVGs
    hooks/*.ts         useIsMobile
    lib/*.ts           cn
    styles/globals.css Tailwind v4 theme  ─►  @source scans apps/** at build
```

Key properties:

- **The consumer's bundler is the compiler.** TSX/JSX transform, tree-shaking,
  and type-checking all happen in-consumer. This package emits nothing.
- **No dependency inversion at runtime** — every dep in `package.json`
  (`@base-ui/react`, `ogl`, `recharts`, `qrcode`, `motion`, …) is a
  client library the consumer's bundle pulls in on demand.
- **The only cross-package runtime coupling is CSS** — `globals.css` `@source`
  reaches into `apps/**` (§7).

---

## 3. The exports contract

`package.json` `exports` is the entire public API. There is **no barrel
`index`**; each subpath is a `/*` wildcard mapping to exactly one source file:

| Subpath | Resolves to |
| --- | --- |
| `./globals.css` | `src/styles/globals.css` |
| `./postcss.config` | `postcss.config.mjs` |
| `./components/*` | `src/components/*.tsx` |
| `./IK/*` | `src/IK/*.tsx` |
| `./icon/*` | `src/icon/*.tsx` |
| `./reactbits/*` | `src/reactbits/*.tsx` |
| `./hooks/*` | `src/hooks/*.ts` |
| `./lib/*` | `src/lib/*.ts` |

`IK/index.ts` and `icon/index.ts` are internal barrels **not exposed** in the map
— consumers must import by leaf subpath (`@cdlab/ui/IK/IKHeader`), never
`@cdlab/ui/IK`. Adding a file to a mapped directory makes it importable with no
`package.json` change; adding a *new* top-level directory requires a new exports
entry.

---

## 4. Primitives (`components/`)

59 files, shadcn/ui `style: base-nova` (`components.json`). They are the bulk of
the library and the part that is **not linted** (§9).

### 4.1 Primitive ecosystem: Base UI

- **`@base-ui/react`** (Base UI) is the single primitive base — **28**
  components import it, via per-primitive subpaths
  (`import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"`) plus the
  `@base-ui/react/use-render` / `@base-ui/react/merge-props` helpers.
- **Composition uses the `render` prop**, not `asChild` — e.g.
  `<DialogTrigger render={<Button />} />`. New or edited components must follow
  the same pattern.

### 4.2 Driver-backed wrappers

Several primitives wrap a third-party library rather than a Base UI primitive:

| Component | Backed by |
| --- | --- |
| `chart` | `recharts` |
| `qr-code` | `qrcode` (canvas/svg backend switch + imperative `QRCodeHandle` ref: `download`, `toDataURL`) |
| `sonner` | `sonner` (reads theme via `next-themes`) |
| `command` | `cmdk` |
| `calendar` | `react-day-picker` |
| `resizable` | `react-resizable-panels` |
| `input-otp` | `input-otp` |

### 4.3 Non-stock extras

Beyond stock shadcn, the set includes bespoke primitives: `cascader`,
`color-picker`, `copy-button`, `heatmap-calendar`, `image-compare`,
`password-input`, `input-with-back`, `audio-waveform`, `waveform-player`,
`spark-chart`. These are still added/maintained via the `shadcn` CLI custom
registries (§9) but have no upstream shadcn equivalent.

---

## 5. The asset kit (`IK/`)

10 components (`IK/*.tsx`) plus the internal `IK/index.ts` barrel. Unlike
`components/`, these are **opinionated app-shell pieces composed *from* the
primitives** — the shared chrome and lifecycle screens every app reuses.

| File | Role |
| --- | --- |
| `IKHeader` | Top chrome. Hard-codes the brand logo `https://wcd.pages.dev/logo.png` and a "more projects" link to `https://wcd.pages.dev/projects/`. |
| `IKFooter` | Copyright / link to `https://github.com/WuChenDi/`. |
| `IKPageContainer` | Page width/padding wrapper. |
| `IKEmpty` | Empty-state screen. |
| `IKAssetLoading` / `IKAssetFailed` | Loading / failure screens for asset flows. |
| `IKAssetRenderer` | Status-switch renderer — exports `enum StatusEnum { PROCESSING, FAILED, COMPLETED }` + render-prop callbacks (`renderLoading` / `renderFailure` / `renderSuccess`), memoized on `status`. The representative "asset lifecycle" pattern. |
| `IKConfirmDialog` | Composes the `alert-dialog` primitive with `isPending`, `extraButton`, and custom confirm/cancel text. |
| `IKAudioAssetPlayer` | `'use client'` — plays audio on mouse-enter (hover-preview). |
| `IKVersionInfo` | `'use client'`, renders `null`; side-effect only — a styled `console` banner of `{ name, version, buildTime }`. |

Only `IKAudioAssetPlayer` and `IKVersionInfo` are client components; the rest are
server-safe (§8).

---

## 6. Effects, icons, hooks, lib

- **`reactbits/` (10, all `'use client'`, browser-only)** — visual effects from
  reactbits.dev. `Aurora`, `Particles`, `Plasma`, `Threads` create an `ogl`
  WebGL context and embed inline GLSL vertex/fragment shaders (`Aurora` and
  `Plasma` target `#version 300 es`, `Particles`/`Threads` classic GLSL ES);
  `SplashCursor` runs a raw-WebGL fluid simulation. `BlurText`, `CountUp`,
  `GradientText`, `ShinyText`, `SpotlightCard` are lighter DOM/`motion` effects.
  The GPU effects are heavy — treat them as opt-in.
- **`icon/` (2)** — `GitHubIcon`, `XIcon` — inline brand SVGs. (Everything else
  uses `lucide-react` directly per `components.json` `iconLibrary`.)
- **`hooks/` (1)** — `use-mobile.ts` → `useIsMobile()`: `window.matchMedia` on a
  768px breakpoint, SSR-safe (initial `undefined` → coerced to `false`).
- **`lib/` (1)** — `utils.ts` → `cn(...) = twMerge(clsx(...))`. Imported by nearly
  every component as `@cdlab/ui/lib/utils`; it is the one shared runtime helper.

---

## 7. Styling & theming

`src/styles/globals.css` (single theme entry, Tailwind **v4**):

1. `@import "tailwindcss"`, then `@import "tw-animate-css"` and
   `@import "shadcn/tailwind.css"`.
2. **`@source` globs** — `../../../apps/**`, `../../../components/**`, and `../**`
   — so Tailwind's JIT scans class usage across the entire workspace. This is why
   utility classes written in an app are compiled even though the class strings
   also live inside this package's components. **Moving `packages/ui` or `apps/`
   breaks this.**
3. `@custom-variant dark (&:is(.dark *))` — class-based dark mode. Consumers add
   the `.dark` class (via `next-themes`); `sonner.tsx` also reads the theme from
   `next-themes`.
4. `@theme inline { … }` maps Tailwind color/radius tokens to CSS vars; `:root`
   (light) and `.dark` provide `oklch` color values and a `--radius` scale
   (`--radius-sm` … `--radius-4xl`).
5. **External fonts** — `--font-sans` and `--font-mono: var(--font-geist-mono)`
   are only *referenced*; the consuming app must define them (e.g. via
   `next/font`).

`@layer base` sets border/outline defaults, `body` bg/fg, and a pointer cursor on
enabled buttons.

---

## 8. The RSC boundary

The library targets React 19 with `rsc: true` (`components.json`), so it must be
safe under React Server Components:

- **Client components carry `'use client'`** — 44 of 59 primitives, plus
  `IKAudioAssetPlayer`, `IKVersionInfo`, and all 10 reactbits effects.
- **Server-safe components omit it** — e.g. `button`, `badge`, `card`, `alert`,
  `input`, `textarea`, `skeleton`, `spinner`, `breadcrumb`, `button-group`,
  `color-picker`, `empty`, and most `IK/*` chrome (`IKHeader`, `IKFooter`,
  `IKAssetRenderer`, `IKPageContainer`, `IKEmpty`, `IKConfirmDialog`, …).

The invariant: a server component can import a server-safe primitive directly; a
client-only primitive imported into a server component must sit below a
`'use client'` boundary. When editing, do not add `'use client'` to a server-safe
primitive without cause — it would pull the component (and its importers) into the
client bundle.

---

## 9. Tooling: lint, type-check, shadcn CLI

There is no build/test pipeline in this package. Validation is external:

- **Root Biome** (`biome.json`) **excludes** `packages/ui/src/reactbits/**/*.tsx`
  and `packages/ui/src/components/**/*.tsx` — both 3rd-party-derived. Only `IK/`,
  `hooks/`, `lib/`, `icon/`, and `styles/` are linted. This is why the linted dirs
  use single quotes (Biome style) while generated components use double quotes.
- **Type-check** is delegated to consuming apps. `tsconfig.json` extends
  `@cdlab/tsconfig/react-library.json` (path alias `@cdlab/ui/* → ./src/*`);
  `tsconfig.lint.json` (`include: ["src","turbo"]`) exists for editor/CI
  type-checking but its `dist` `outDir` is a phantom — nothing is emitted.
- **shadcn CLI** (`components.json`) adds/updates primitives and effects:
  `style: base-nova`, `rsc: true`, `baseColor: neutral`, `iconLibrary: lucide`,
  aliases at `@cdlab/ui/*`, and two custom registries — `@react-bits` →
  `https://reactbits.dev/r/{name}.json`, `@ikui` →
  `https://ik-ui.pages.dev/r/{name}.json`.

---

## 10. Configuration

- **`package.json`** — `"private": true`, `"type": "module"`, `"scripts": {}`
  (the no-build design), and the `exports` map (§3). Dependencies are pinned via
  the pnpm catalog (`catalog:prod` / `catalog:dev`, resolved in root
  `pnpm-workspace.yaml`: React 19, `@base-ui/react`, `ogl`,
  `recharts`, `qrcode`, `motion`, …).
- **`components.json`** — shadcn CLI config (§9).
- **`postcss.config.mjs`** — the `@tailwindcss/postcss` plugin only; re-exported as
  `@cdlab/ui/postcss.config` for apps that want the shared PostCSS setup.
- **`tsconfig.json` / `tsconfig.lint.json`** — TS config (§9).

There are **no environment variables, secrets, bindings, or deploy target** — the
package is compiled into whichever app imports it, and those apps own their own
build and deployment.
