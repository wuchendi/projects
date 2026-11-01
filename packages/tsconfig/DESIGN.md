# @cdlab/tsconfig — Design

> A config-only workspace package: one strict `base.json` and four framework
> overlays (`nextjs`, `hono`, `react-library`, `utils`), each extending `base`
> and patching only the module system, JSX runtime, and emit flags that differ
> per project type. No runtime code, no build step, no entry point — consumers
> extend a preset by raw subpath and `tsc` merges the options.

This is the authoritative design spec; the JSON files follow it. Section numbers
are stable anchors. The package's entire surface is five JSON files and a
`package.json`, so this doc is short by design — but it is the place to reason
about *why* each knob sits where it does before moving one.

**Contents**

1. [Background & goals](#1-background--goals)
2. [Package shape](#2-package-shape)
3. [The preset hierarchy](#3-the-preset-hierarchy)
4. [`base.json`](#4-basejson)
5. [The four overlays](#5-the-four-overlays)
6. [How consumers extend](#6-how-consumers-extend)
7. [Maintenance & gotchas](#7-maintenance--gotchas)

---

## 1. Background & goals

Every TypeScript project in the monorepo — 13 Next.js apps, 4 Hono Workers, and
the shared `packages/*` — needs the same core decisions: strict mode, a module
and resolution mode, a JSX runtime, and emit behavior. Encoded inline, those
decisions drift across ~22 config files. This package centralizes them.

Goals:

- **G1 — One source of strictness.** The strict suite and the shared compiler
  flags live in exactly one file (`base.json`). Tightening a rule propagates to
  every consumer on the next type-check.
- **G2 — Overlays, not forks.** A framework preset patches only what genuinely
  differs from `base`; it never re-declares the shared baseline (beyond one
  documented redundancy, §5.2).
- **G3 — Zero cost.** Raw JSON, no build, no `dist/`, no entry point — resolving
  the preset is a filesystem read, not a package load.

### Non-goals

- **Not a style tool.** Formatting and lint rules are Biome's domain; these
  presets govern only `tsc`'s checking and emit.
- **Not a publishable library.** It is workspace-internal (`private: true`); the
  `publishConfig` field is inert (§2).
- **Not a deep hierarchy.** Exactly one inheritance level (`base` → overlay). No
  overlay extends another; consumers extend an overlay, never chain two.

---

## 2. Package shape

`package.json` declares metadata only — **no** `main` / `module` / `exports`, no
`scripts`, no `dependencies`. Fields that matter:

| Field | Value | Consequence |
| --- | --- | --- |
| `name` | `@cdlab/tsconfig` | The subpath prefix consumers extend. |
| `version` | `1.0.0` | Static; never bumped because nothing publishes. |
| `private` | `true` | Workspace-internal; blocks accidental publish. |
| `publishConfig.access` | `public` | **Vestigial** — `private: true` overrides it, so this is a no-op. Treat the package as unpublished. |

The absence of an `exports` field is **load-bearing**: without it, Node/TypeScript
resolve `@cdlab/tsconfig/nextjs.json` straight to the file at the package root.
Adding an `exports` map would break every consumer's `extends` string unless each
subpath were mapped explicitly.

All five JSON files sit at the package root — no subdirectories:

```
packages/tsconfig/
  package.json
  base.json            the shared root preset
  nextjs.json          Next.js apps
  hono.json            Cloudflare Workers (Hono)
  react-library.json   packages/ui
  utils.json           tsdown library packages
```

---

## 3. The preset hierarchy

A single-level tree. `base.json` is the root and extends nothing; each overlay
extends `./base.json` and no overlay extends another.

```
base.json  (strict · NodeNext · ES2017 · DOM · declaration on)
  ├─ nextjs.json          Bundler · ESNext · jsx preserve · noEmit · next plugin
  ├─ hono.json            Bundler · ESNext · lib=[ESNext] · jsx react-jsx + hono/jsx
  ├─ react-library.json   Bundler · ESNext · jsx react-jsx
  └─ utils.json           Bundler · ESNext · target ES6 · declaration off · types=[node]
```

The overlays are distinguished almost entirely by three axes:

| Axis | base | nextjs | hono | react-library | utils |
| --- | --- | --- | --- | --- | --- |
| module / resolution | `NodeNext` | `ESNext` / `Bundler` | `ESNext` / `Bundler` | `ESNext` / `Bundler` | `ESNext` / `Bundler` |
| JSX runtime | — | `preserve` | `react-jsx` + `hono/jsx` | `react-jsx` | — |
| emit | declaration on | `noEmit` | (inherits) | (inherits) | declaration off, `noEmit: false` |

Everything else is inherited from `base` unchanged.

---

## 4. `base.json`

The shared root (`display: "Default"`). Its job is the strict suite plus the
flags that are safe for *every* consumer.

| Option | Value | Rationale |
| --- | --- | --- |
| `strict` | `true` | The reason the package exists — full strict for all. |
| `module` / `moduleResolution` | `NodeNext` | A correct default for anything extending `base` directly; every overlay switches to `Bundler`, so in practice few consumers run on NodeNext (§7). |
| `target` | `ES2017` | Broad baseline; `utils.json` lowers to `ES6`. |
| `lib` | `["dom", "dom.iterable", "esnext"]` | Browser + latest JS. Arrays replace on merge, so `hono.json` re-declares this to drop DOM. |
| `moduleDetection` | `force` | Every file is a module; no accidental global scripts. |
| `declaration` / `declarationMap` | `true` | Emit `.d.ts` + maps by default; `utils.json` turns both off. |
| `incremental` | `false` | No `.tsbuildinfo` written; consumers opt in if wanted. |
| `resolveJsonModule` | `true` | Allow `import x from './x.json'`. |
| `skipLibCheck` | `true` | Skip checking dependency `.d.ts` — faster, avoids third-party type noise. |
| `noUncheckedIndexedAccess` | `false` | Left off deliberately; opt-in per consumer (it is invasive on existing code). |

---

## 5. The four overlays

Each overlay documents *only its diff* from `base`.

### 5.1 `nextjs.json` (`display: "Next.js"`)

For the 13 App-Router apps. Switches to `module: ESNext` + `moduleResolution:
Bundler` (Next resolves its own graph), sets `jsx: preserve` (Next's compiler
transforms JSX, not `tsc`), `noEmit: true` (Next builds; `tsc` only type-checks),
`allowJs: true`, and registers the `next` language-service plugin
(`plugins: [{ name: "next" }]`). Consumers add `include: [..., ".next/types/**/*.ts"]`.

### 5.2 `hono.json` (`display: "Hono.js"`)

For the Cloudflare Workers (Hono) apps. `target` **and** `module` are `ESNext`,
`moduleResolution: Bundler`. Two Workers-specific choices:

- **`lib: ["ESNext"]`** — deliberately **drops the DOM libs** from `base`.
  Workers have no DOM; keeping `dom` would let code type-check against browser
  globals that don't exist at runtime.
- **`jsx: react-jsx` + `jsxImportSource: "hono/jsx"`** — Hono ships its own JSX
  factory for server-rendered HTML (`live-user`'s `src/pages/*.tsx`), so JSX
  compiles against `hono/jsx`, not React.

It also re-states `strict: true` and `skipLibCheck: true` — both already set in
`base`. This is **redundant cosmetic noise**, harmless, safe to leave or remove.

### 5.3 `react-library.json` (`display: "React Library"`)

For `packages/ui`. Bundler resolution + `jsx: react-jsx` (standard React 17+
automatic runtime), no framework plugin. It keeps `base`'s `declaration: true`
because `@cdlab/ui` ships raw source and its consumers want types.

### 5.4 `utils.json` (`display: "Utils Library"`)

For the tsdown-built library packages (`utils`, `cipher`, `uncrypto`, `db`).
Bundler resolution, and its emit stance is the **inverse** of `base`:

- `noEmit: false`, `declaration: false`, `declarationMap: false` — these packages
  emit via **tsdown** (which generates its own `.d.ts`), so `tsc`'s declaration
  emit would be redundant and conflicting.
- `target: ES6` — **lower** than `base`'s ES2017, a deliberate wider-compat floor
  for published-shape library output.
- `types: ["node"]` — restrict ambient types to Node (no DOM globals leaking in).

---

## 6. How consumers extend

The mechanism is TypeScript's `extends` merge:

1. Consumer `tsconfig.json` sets `extends: "@cdlab/tsconfig/<preset>.json"`.
2. That resolves by raw subpath (no `exports` field, §2) to the package-root JSON.
3. The preset's `extends: "./base.json"` loads `base` first.
4. Merge order is **base → overlay → consumer**: each layer's `compilerOptions`
   override the previous **key by key**. Arrays (`lib`, `types`, `plugins`)
   **replace wholesale**, they do not concatenate.
5. `include` / `exclude` and `paths` are the consumer's responsibility — presets
   never set them, because they depend on the consumer's source layout.

The canonical consumer block (Next.js) in the README shows `paths: { "@/*":
["./src/*"] }`, `include: ["next-env.d.ts", "**/*.ts", "**/*.tsx",
".next/types/**/*.ts"]`, `exclude: ["node_modules"]`.

**Consumer inventory (authoritative):**

| Preset | Consumers |
| --- | --- |
| `nextjs.json` | `bycut`, `byplay`, `byshot`, `bytts`, `clearify`, `dropply-web`, `flnk` (archived), `flox`, `text2img`, `values`, `vidl`, `wepush` |
| `hono.json` | `byplay-log`, `dropply-api`, `live-user` |
| `react-library.json` | `packages/ui` |
| `utils.json` | `packages/utils`, `packages/cipher`, `packages/uncrypto`, `packages/db` |
| `base.json` | everything, directly or transitively |

---

## 7. Maintenance & gotchas

There is no build, test, or deploy step. Validation is: change a preset, then
type-check a consumer that extends it.

```bash
pnpm --filter @cdlab/wepush build        # nextjs.json
pnpm --filter @cdlab/dropply-api build   # hono.json
pnpm --filter @cdlab/utils build         # utils.json
```

`react-library.json` has no script to exercise it — `packages/ui` ships raw
source with no build/typecheck step; validate it by type-checking an app that
consumes `@cdlab/ui`.

- **Arrays replace, they don't merge.** Editing `base.json`'s `lib` affects every
  consumer *except* `hono.json` (which re-declares `lib`). Same for `types` /
  `plugins`. Know which layer owns the array you're touching.
- **NodeNext vs Bundler.** `base` declares `NodeNext`, but all four overlays flip
  to `Bundler` — so almost no consumer actually runs on NodeNext. NodeNext only
  bites something that extends `base` *directly* without an overlay.
- **Prefer base for shared knobs, one overlay for scoped ones.** Duplicating a
  value across multiple overlays is a smell — either it belongs in `base` (all
  inherit) or in exactly one overlay (scoped).
- **`hono.json`'s repeated `strict`/`skipLibCheck`** are inherited from `base`
  already; they change nothing.
- **Don't add an `exports` field** to `package.json` — it would break every
  consumer's raw-subpath `extends` string (§2).
- **`private: true` wins** over `publishConfig.access: public`; the package is not
  and should not be published.
