'use client'

import { addMonths } from 'date-fns'
import { useState } from 'react'
import type { LinkRow } from '@/lib/platform/api'
import type { CreateLinkInput } from '@/schemas/link'

const SLUG_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export function randomSlug(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let out = ''
  for (let i = 0; i < length; i++)
    out += SLUG_ALPHABET[bytes[i]! % SLUG_ALPHABET.length]
  return out
}

export interface GeoRow {
  id: string
  country: string
  url: string
}

export function geoRow(country = '', url = ''): GeoRow {
  return { id: crypto.randomUUID(), country, url }
}

// QR defaults — kept in sync with the popover so an uncustomized link renders
// the same code in both places (and `buildPayload` can omit a default `qr`).
export type QrDot = 'dot' | 'square'
export type QrCorner = 'rounded' | 'square'
export type QrErrorLevel = 'L' | 'M' | 'Q' | 'H'
const QR_DEFAULTS = {
  fgColor: '#0f172a',
  bgColor: '#ffffff',
  dotStyle: 'dot' as QrDot,
  cornerStyle: 'rounded' as QrCorner,
  errorLevel: 'M' as QrErrorLevel,
  margin: 2,
}

export interface FormState {
  url: string
  slug: string
  displayTitle: string
  comment: string
  tags: string[]
  expiresAt: number | null
  maxVisits: number | null
  password: string
  apple: string
  google: string
  title: string
  description: string
  image: string
  cloaking: boolean
  redirectWithQuery: boolean
  unsafe: boolean
  geo: GeoRow[]
  qrFg: string
  qrBg: string
  qrDot: QrDot
  qrCorner: QrCorner
  qrError: QrErrorLevel
  qrMargin: number
  qrLogo: string
}

// New links can default to a one-month expiry; the user can clear it for a
// permanent link.
function defaultExpiryValue(): number {
  return addMonths(new Date(), 1).getTime()
}

export interface UseLinkFormOptions {
  existing?: LinkRow
  // Read the link's display title into the form (link-drawer only).
  withTitle?: boolean
  // Read the link's QR customization into the form (link-drawer only).
  withQr?: boolean
  // Read the link's maxVisits cap into the form (link-editor only).
  withMaxVisits?: boolean
  // New links default to a one-month expiry (link-drawer only).
  defaultExpiry?: boolean
}

function initialState(options: UseLinkFormOptions): FormState {
  const { existing, withTitle, withQr, withMaxVisits, defaultExpiry } = options
  const c = existing?.config ?? {}
  const qr = withQr ? c.qr : undefined
  return {
    url: existing?.url ?? '',
    slug: existing?.slug ?? '',
    displayTitle: withTitle ? (existing?.title ?? '') : '',
    comment: existing?.comment ?? '',
    tags: existing?.tags ?? [],
    expiresAt: existing
      ? existing.expiresAt
        ? new Date(existing.expiresAt).getTime()
        : null
      : defaultExpiry
        ? defaultExpiryValue()
        : null,
    maxVisits: withMaxVisits ? (c.maxVisits ?? null) : null,
    password: '',
    apple: c.apple ?? '',
    google: c.google ?? '',
    title: c.title ?? '',
    description: c.description ?? '',
    image: c.image ?? '',
    cloaking: c.cloaking ?? false,
    redirectWithQuery: c.redirectWithQuery ?? false,
    unsafe: c.unsafe ?? false,
    geo: c.geo
      ? Object.entries(c.geo).map(([country, url]) => geoRow(country, url))
      : [],
    qrFg: qr?.fgColor ?? QR_DEFAULTS.fgColor,
    qrBg: qr?.bgColor ?? QR_DEFAULTS.bgColor,
    qrDot: qr?.dotStyle ?? QR_DEFAULTS.dotStyle,
    qrCorner: qr?.cornerStyle ?? QR_DEFAULTS.cornerStyle,
    qrError: qr?.errorLevel ?? QR_DEFAULTS.errorLevel,
    qrMargin: qr?.margin ?? QR_DEFAULTS.margin,
    qrLogo: qr?.logo ?? '',
  }
}

// A QR config is only persisted when it differs from the defaults — otherwise
// every link would carry a redundant `qr` block.
function isCustomQr(f: FormState): boolean {
  return (
    f.qrFg !== QR_DEFAULTS.fgColor ||
    f.qrBg !== QR_DEFAULTS.bgColor ||
    f.qrDot !== QR_DEFAULTS.dotStyle ||
    f.qrCorner !== QR_DEFAULTS.cornerStyle ||
    f.qrError !== QR_DEFAULTS.errorLevel ||
    f.qrMargin !== QR_DEFAULTS.margin ||
    f.qrLogo.trim() !== ''
  )
}

export function buildPayload(f: FormState): CreateLinkInput {
  const config: CreateLinkInput['config'] = {}
  if (f.apple) config.apple = f.apple
  if (f.google) config.google = f.google
  if (f.title) config.title = f.title
  if (f.description) config.description = f.description
  if (f.image) config.image = f.image
  if (f.cloaking) config.cloaking = true
  if (f.redirectWithQuery) config.redirectWithQuery = true
  if (f.unsafe) config.unsafe = true
  if (f.maxVisits) config.maxVisits = f.maxVisits
  const geo = f.geo
    .filter((g) => g.country.trim() && g.url.trim())
    .reduce<Record<string, string>>((acc, g) => {
      acc[g.country.trim().toUpperCase()] = g.url.trim()
      return acc
    }, {})
  if (Object.keys(geo).length) config.geo = geo
  if (isCustomQr(f)) {
    config.qr = {
      fgColor: f.qrFg,
      bgColor: f.qrBg,
      dotStyle: f.qrDot,
      cornerStyle: f.qrCorner,
      errorLevel: f.qrError,
      margin: f.qrMargin,
      ...(f.qrLogo.trim() ? { logo: f.qrLogo.trim() } : {}),
    }
  }

  return {
    url: f.url.trim(),
    slug: f.slug.trim() || undefined,
    title: f.displayTitle.trim() || undefined,
    comment: f.comment.trim() || undefined,
    tags: f.tags,
    expiresAt: f.expiresAt ?? null,
    config,
    password: f.password.trim() || undefined,
  }
}

// Shared link create/edit form state used by both the links drawer and the
// standalone link editor. Each host keeps its own JSX; only the state shape,
// initialization, and payload serialization live here.
export function useLinkForm(options: UseLinkFormOptions) {
  const [form, setForm] = useState<FormState>(() => initialState(options))

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }))
  }

  return { form, setForm, set }
}
