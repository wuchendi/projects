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
  allowedDevOrigins: ['flox.a.wd.ds.cc'],
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'wcd.pages.dev' },
      // Douban images
      { protocol: 'https', hostname: 'img3.doubanio.com' },
      { protocol: 'https', hostname: 'img1.doubanio.com' },
      { protocol: 'https', hostname: 'img2.doubanio.com' },
      { protocol: 'https', hostname: 'img9.doubanio.com' },
      // Video source images - allow all subdomains with wildcards
      { protocol: 'http', hostname: '**.com' },
      { protocol: 'https', hostname: '**.com' },
      { protocol: 'http', hostname: '**.cn' },
      { protocol: 'https', hostname: '**.cn' },
      { protocol: 'http', hostname: '**.net' },
      { protocol: 'https', hostname: '**.net' },
      { protocol: 'http', hostname: '**.org' },
      { protocol: 'https', hostname: '**.org' },
      { protocol: 'http', hostname: '**.tv' },
      { protocol: 'https', hostname: '**.tv' },
      { protocol: 'http', hostname: '**.io' },
      { protocol: 'https', hostname: '**.io' },
      { protocol: 'http', hostname: '**.xyz' },
      { protocol: 'https', hostname: '**.xyz' },
      { protocol: 'http', hostname: '**.online' },
      { protocol: 'https', hostname: '**.online' },
      { protocol: 'http', hostname: '**.top' },
      { protocol: 'https', hostname: '**.top' },
    ],
  },
}

export default nextConfig
