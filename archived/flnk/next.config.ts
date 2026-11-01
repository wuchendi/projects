import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // TypeScript 7 dropped the legacy compiler JS API; route type-checking
  // through the TS CLI instead.
  experimental: {
    useTypeScriptCli: true,
  },
  env: {
    BUILD_TIME: new Date().toLocaleString(),
  },
  allowedDevOrigins: ['flnk.localhost', 'flnk.a.wd.ds.cc'],
  // Keep the libsql packages unbundled so wrangler resolves them at runtime via
  // the correct `workerd` export condition. `@libsql/isomorphic-ws` ships
  // workerd-specific code; per OpenNext docs it (and the libsql client/hrana
  // chain that pulls it in) must be external, otherwise the build fails with
  // "Could not resolve @libsql/isomorphic-ws".
  // https://opennext.js.org/cloudflare/howtos/workerd
  serverExternalPackages: [
    '@libsql/client',
    '@libsql/hrana-client',
    '@libsql/isomorphic-ws',
  ],
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
  },
}

export default withNextIntl(nextConfig)

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
// `remoteBindings: false` keeps local dev fully offline — the `AI` binding has no
// local emulation and would otherwise open a credential-gated remote proxy that
// blocks the Cloudflare context. AI is unused in this phase, so a local stub is
// fine. Skipped entirely during `next build` (NEXT_PHASE) to avoid any proxy.
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

if (process.env.NEXT_PHASE !== 'phase-production-build') {
  void initOpenNextCloudflareForDev({ remoteBindings: false })
}
