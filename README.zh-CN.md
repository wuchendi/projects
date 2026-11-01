# @cdlab/projects-monorepo

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2020-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%E2%89%A5%2011-f69220.svg)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/built%20with-Turborepo-cc00ff.svg)](https://turbo.build/)
[![NSL](https://img.shields.io/badge/dev%20proxy-%40dotns%2Fnsl-4a9eff.svg)](https://github.com/dotns/nsl)

[English](./README.md) | [中文](./README.zh-CN.md)

一组隐私优先的 Web 工具,共享同一个 **Turborepo + pnpm** 工作区 —— Next.js、Nuxt
与 Hono/Cloudflare Workers 并存。本地开发由
[@dotns/nsl](https://github.com/dotns/nsl) 代理:每个应用都有固定访问地址
`http://<name>.localhost:3355`,无需记忆端口。

> [!IMPORTANT]
> 大多数应用**完全在浏览器中运行**、**零服务端上传** —— 你的数据从不离开设备。
> 隐私优先 · 本地优先 · 性能优先。

本 README 是入口;**每个子项目都有自己的文档** —— 深入了解请从子项目开始。

## 应用

| 应用 | 简介 | 线上 |
| --- | --- | --- |
| [bycut](./apps/bycut) | 浏览器视频编辑器 —— 基于时间线,零上传 | [↗](https://bycut.pages.dev/) |
| [byplay](./apps/byplay) | 在线 HLS / MP4 播放器 | [↗](https://byplay.pages.dev/) |
| [byplay-log](./apps/byplay-log) | ByPlay 播放日志采集服务 | — |
| [byshot](./apps/byshot) | 基于 Cloudinary 的摄影作品集 | [↗](https://byshot.pages.dev/) |
| [bytts](./apps/bytts) | 基于 Azure Speech 的文本转语音(支持自定义服务商) | [↗](https://bytts.pages.dev/) |
| [clearify](./apps/clearify) | 图像 / 视频工具箱(抠图 · 压缩 · 转码) | [↗](https://clearify.pages.dev/) |
| [dropply-api](./apps/dropply-api) | 端到端加密文件分享 API | — |
| [dropply-web](./apps/dropply-web) | 端到端加密文件分享 —— 密钥仅存于 URL 片段 | [↗](https://dropply.pages.dev/) |
| [flox](./apps/flox) | 多源视频聚合与播放(SSE) | [↗](https://floxx.pages.dev/) |
| [live-user](./apps/live-user) | 实时在线人数统计(WebSocket Hibernation DO) | [↗](https://live-user.cdlab.workers.dev/) |
| [repo-changelog](./apps/repo-changelog) | GitHub 发布 / 更新日志看板(Nuxt) | [↗](https://repo-changelog.vercel.app/) |
| [text2img](./apps/text2img) | 浏览器 AI 文生图(Workers AI) | [↗](https://text2img.cdlab.workers.dev/) |
| [values](./apps/values) | 加密货币 / 法币 / 大宗商品价值对比 | [↗](https://values.pages.dev/) |
| [vidl](./apps/vidl) | 浏览器视频下载器(M3U8 / HLS → MP4) | [↗](https://vidl.pages.dev/) |
| [wepush](./apps/wepush) | 多租户微信模板消息推送控制台 | [↗](https://wepush.cdlab.workers.dev/) |

## 已归档

已冻结,不再迭代。仍可部署,但不参与根目录的 `build` / `dev` / `lint` 与 Biome 检查,
也不保证跟进依赖升级。

| 应用 | 简介 | 后继 |
| --- | --- | --- |
| [flnk](./archived/flnk) | 隐私优先短链服务,支持地域 / 设备路由 | [tinylink](https://github.com/WuChenDi/tinylink) · [↗](https://tinylink.cdlab.workers.dev/) |

## 共享包

| 包 | 简介 |
| --- | --- |
| [@cdlab/ui](./packages/ui) | 共享 React + Tailwind v4 组件库(无构建步骤) |
| [@cdlab/utils](./packages/utils) | 通用工具 —— 剪贴板、下载、格式化、日志等 |
| [@cdlab/cipher](./packages/cipher) | 流式密码库 —— XChaCha20-Poly1305 + Argon2id + ECIES |
| [@cdlab/db](./packages/db) | 双驱动 Drizzle 工厂(Cloudflare D1 / libSQL) |
| [@cdlab/uncrypto](./packages/uncrypto) | 跨运行时 WebCrypto 垫片(Node / 浏览器 / Workers) |
| [@cdlab/tsconfig](./packages/tsconfig) | 共享 TypeScript 配置预设 |

## 文档

每个应用和包都提供三份文档 —— 进入子项目目录,从它的 `README.md` 开始:

- **`README.md`** —— 是什么、为什么、快速开始与速查表。
- **`DESIGN.md`** —— 权威的、带章节编号的架构规格。
- **`llms.txt`** —— 面向 AI agent 的指南(关键文件、坑点、命令)。

## 快速开始

**前置要求:** Node.js ≥ 20,pnpm ≥ 11。

```bash
git clone https://github.com/WuChenDi/projects.git
cd projects
pnpm install                 # 同时构建工作区内的包
```

开发服务器由 [@dotns/nsl](https://github.com/dotns/nsl) 代理 —— 每个应用可在
`http://<name>.localhost:3355` 访问(`<name>` = 去掉 scope 的包名)。

```bash
# 工作区级
pnpm dev                     # 并行启动所有应用
pnpm build                   # 构建全部
pnpm lint                    # Biome 检查
pnpm format                  # Biome 格式化 --write
pnpm clean                   # 清除 node_modules / 缓存 / 构建产物

# 单个项目 —— <name> 是包名(如 values、wepush)
pnpm --filter @cdlab/<name> dev       # → http://<name>.localhost:3355
pnpm --filter @cdlab/<name> build
```

dev 名是去掉 scope 的包名 —— 即目录名(如 `values`、`wepush`)。具体脚本、开发
地址和部署命令见各子项目的 README。

## 目录结构

```
apps/         16 个可部署产品(Next.js · Nuxt · Hono/Workers)
packages/     6 个共享库(ui · utils · cipher · uncrypto · db · tsconfig)
```

## 技术栈

| 层 | 技术 |
| --- | --- |
| **前端** | React + Next.js 16(App Router) · Vue 3 + Nuxt 4 |
| **语言** | TypeScript 6 |
| **UI** | shadcn/ui · Tailwind CSS v4 · Nuxt UI |
| **浏览器 API** | WebAssembly(FFmpeg.wasm) · WebGPU · Web Workers · Streams API |
| **后端** | Cloudflare Workers · Hono + Zod · Durable Objects |
| **数据库** | Drizzle ORM + Cloudflare D1 / libSQL |
| **工程化** | Turborepo · pnpm workspaces · Biome · @dotns/nsl |

## 许可证

[MIT](./LICENSE) © 2026-至今 [wudi](https://github.com/WuChenDi)
