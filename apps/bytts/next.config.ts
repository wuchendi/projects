import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // TypeScript 7 dropped the legacy compiler JS API; route type-checking
  // through the TS CLI instead.
  experimental: {
    useTypeScriptCli: true,
  },
  env: {
    BUILD_TIME: new Date().toLocaleString(),
  },
  // reactStrictMode: true,
  // poweredByHeader: false,
  allowedDevOrigins: ['bytts.a.wd.ds.cc'],
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wcd.pages.dev',
      },
    ],
  },
}

export default nextConfig
