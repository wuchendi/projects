import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  // TypeScript 7 dropped the legacy compiler JS API; route type-checking
  // through the TS CLI instead.
  experimental: {
    useTypeScriptCli: true,
  },
  env: {
    BUILD_TIME: new Date().toLocaleString(),
  },
  images: {
    unoptimized: true,
    qualities: [50, 75, 100],
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'wcd.pages.dev' },
    ],
  },
  // compiler: {
  //   ...(process.env.NODE_ENV === 'production' && {
  //     removeConsole: {
  //       exclude: ['error'],
  //     },
  //   }),
  // },
}

export default nextConfig
