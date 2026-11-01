import '@cdlab/ui/globals.css'

import { Toaster } from '@cdlab/ui/components/sonner'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { ClientProviders } from '@/components/layout'

const SITE_NAME = 'Flnk'
const SITE_URL = 'https://flnk.cdlab.workers.dev'
const SITE_TITLE = `${SITE_NAME} — privacy-first link shortener`
const SITE_DESCRIPTION =
  'Privacy-first link shortener with geo / device routing and edge analytics, running on Cloudflare Workers.'
const SITE_IMAGE =
  'https://cdn.jsdelivr.net/gh/cdLab996/picture-lib/wudi/flnk/index.png'
const AUTHOR = {
  name: 'wudi',
  url: 'https://github.com/WuChenDi',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
  creator: AUTHOR.name,
  publisher: AUTHOR.name,
  keywords: [
    'link shortener',
    'url shortener',
    'short links',
    'privacy-first',
    'geo routing',
    'device routing',
    'edge analytics',
    'Cloudflare Workers',
    'serverless',
    'Flnk',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SITE_IMAGE,
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@wuchendi96',
    creator: '@wuchendi96',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_IMAGE],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  image: SITE_IMAGE,
  inLanguage: 'en',
  author: {
    '@type': 'Person',
    name: AUTHOR.name,
    url: AUTHOR.url,
  },
}

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  screenshot: SITE_IMAGE,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  author: {
    '@type': 'Person',
    name: AUTHOR.name,
    url: AUTHOR.url,
  },
  inLanguage: 'en',
  isAccessibleForFree: true,
}

function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const locale = await getLocale()

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD structured data
          dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD structured data
          dangerouslySetInnerHTML={{ __html: jsonLdScript(softwareJsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider>
          <ClientProviders>
            {children}
            <Toaster richColors position="top-right" />
          </ClientProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
