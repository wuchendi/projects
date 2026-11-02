# @cdlab/projects-monorepo

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2020-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%E2%89%A5%2011-f69220.svg)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/built%20with-Turborepo-cc00ff.svg)](https://turbo.build/)
[![NSL](https://img.shields.io/badge/dev%20proxy-%40dotns%2Fnsl-4a9eff.svg)](https://github.com/dotns/nsl)

[English](./README.md) | [中文](./README.zh-CN.md)

A collection of privacy-first web tools sharing one **Turborepo + pnpm** workspace —
Next.js, Nuxt, and Hono/Cloudflare Workers side by side. Local dev is proxied by
[@dotns/nsl](https://github.com/dotns/nsl): every app gets a stable URL at
`http://<name>.localhost:3355`, no port hunting.

> [!IMPORTANT]
> Most apps run **entirely in the browser** with **zero server uploads** — your
> data never leaves your device. Privacy-first · Local-first · Performance-first.

This README is the entry point; **each sub-project has its own docs** — start
there for depth.

## Applications

| App | What it is | Live |
| --- | --- | --- |
| [bycut](./apps/bycut) | Browser video editor — timeline-based, zero uploads | [↗](https://bycut.pages.dev/) |
| [byplay](./apps/byplay) | Online HLS / MP4 player | [↗](https://byplay.pages.dev/) |
| [byplay-log](./apps/byplay-log) | ByPlay playback-log ingest service | — |
| [byshot](./apps/byshot) | Cloudinary-backed photography gallery | [↗](https://byshot.pages.dev/) |
| [bytts](./apps/bytts) | Text-to-speech via Azure Speech (+ custom providers) | [↗](https://bytts.pages.dev/) |
| [clearify](./apps/clearify) | Image / video toolbox (bg removal · compress · transcode) | [↗](https://clearify.pages.dev/) |
| [dropply-api](./apps/dropply-api) | End-to-end encrypted file-sharing API | — |
| [dropply-web](./apps/dropply-web) | E2E encrypted file sharing — key lives in the URL fragment | [↗](https://dropply.pages.dev/) |
| [flox](./apps/flox) | Multi-source video aggregation & playback (SSE) | [↗](https://floxx.pages.dev/) |
| [live-user](./apps/live-user) | Real-time online-user counter (WebSocket Hibernation DO) | [↗](https://live-user.cdlab.workers.dev/) |
| [repo-changelog](./apps/repo-changelog) | GitHub release / changelog dashboard (Nuxt) | [↗](https://repo-changelog.vercel.app/) |
| [text2img](./apps/text2img) | Browser AI text-to-image (Workers AI) | [↗](https://text2img.cdlab.workers.dev/) |
| [values](./apps/values) | Crypto / fiat / commodity value comparison | [↗](https://values.pages.dev/) |
| [vidl](./apps/vidl) | Browser video downloader (M3U8 / HLS → MP4) | [↗](https://vidl.pages.dev/) |
| [wepush](./apps/wepush) | Multi-tenant WeChat template-message push console | [↗](https://wepush.cdlab.workers.dev/) |

## Archived

Frozen — no further development. Still deployable, but excluded from the root
`build` / `dev` / `lint` and Biome, and not guaranteed to keep up with dependency upgrades.

| App | What it is | Successor |
| --- | --- | --- |
| [flnk](./archived/flnk) | Privacy-first link shortener with geo / device routing | [tinylink](https://github.com/wuchendi/tinylink-docs) · [↗](https://tinylink.cdlab.workers.dev/) |

## Packages

| Package | What it is |
| --- | --- |
| [@cdlab/ui](./packages/ui) | Shared React + Tailwind v4 component library (no build step) |
| [@cdlab/utils](./packages/utils) | Generic utilities — clipboard, download, format, logger, … |
| [@cdlab/cipher](./packages/cipher) | Stream cipher — XChaCha20-Poly1305 + Argon2id + ECIES |
| [@cdlab/db](./packages/db) | Dual-driver Drizzle factory (Cloudflare D1 / libSQL) |
| [@cdlab/uncrypto](./packages/uncrypto) | Cross-runtime WebCrypto shim (Node / browser / Workers) |
| [@cdlab/tsconfig](./packages/tsconfig) | Shared TypeScript config presets |

## Documentation

Every app and package ships three docs — open the sub-project directory and start
with its `README.md`:

- **`README.md`** — what it is, why, quick start, and reference tables.
- **`DESIGN.md`** — the authoritative, section-numbered architecture spec.
- **`llms.txt`** — an agent-oriented guide (key files, gotchas, commands).

## Getting started

**Prerequisites:** Node.js ≥ 20, pnpm ≥ 11.

```bash
git clone https://github.com/WuChenDi/projects.git
cd projects
pnpm install                 # also builds workspace packages
```

Dev servers are proxied by [@dotns/nsl](https://github.com/dotns/nsl) — each app is
reachable at `http://<name>.localhost:3355` (`<name>` = package name, scope
stripped).

```bash
# Workspace-wide
pnpm dev                     # dev all apps (parallel)
pnpm build                   # build all
pnpm lint                    # Biome lint
pnpm format                  # Biome format --write
pnpm clean                   # wipe node_modules / caches / build output

# A single project — <name> is the package name (e.g. values, wepush)
pnpm --filter @cdlab/<name> dev       # → http://<name>.localhost:3355
pnpm --filter @cdlab/<name> build
```

The dev name is the package name with the scope stripped — the directory name
(e.g. `values`, `wepush`). See each sub-project's README for its exact scripts,
dev URL, and deploy command.

## Layout

```
apps/         16 deployable products (Next.js · Nuxt · Hono/Workers)
packages/     6 shared libraries (ui · utils · cipher · uncrypto · db · tsconfig)
```

## Tech stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React + Next.js 16 (App Router) · Vue 3 + Nuxt 4 |
| **Language** | TypeScript 6 |
| **UI** | shadcn/ui · Tailwind CSS v4 · Nuxt UI |
| **Browser APIs** | WebAssembly (FFmpeg.wasm) · WebGPU · Web Workers · Streams API |
| **Backend** | Cloudflare Workers · Hono + Zod · Durable Objects |
| **Database** | Drizzle ORM + Cloudflare D1 / libSQL |
| **Engineering** | Turborepo · pnpm workspaces · Biome · @dotns/nsl |

## License

[MIT](./LICENSE) © 2026-PRESENT [wudi](https://github.com/WuChenDi)
