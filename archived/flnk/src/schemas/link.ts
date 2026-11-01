import * as z from 'zod'
import { SLUG_REGEX } from '@/lib/redirect/slug'

// Geo routing map: ISO-3166-1 alpha-2 (UPPERCASE) → destination URL. Keys are
// uppercased here so the redirect engine's `config.geo[cf.country]` lookup
// (CF country codes are uppercase) always matches.
const GeoSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return value
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k.trim().toUpperCase(),
        v,
      ]),
    )
  },
  z.record(
    z.string().regex(/^[A-Z]{2}$/u, 'Country must be a 2-letter ISO code'),
    z.url().max(2048),
  ),
)

// Per-link QR style. `logo` may be an R2 asset path (`/api/asset/…`) or an
// absolute image URL, so it's a bounded string rather than a strict URL.
const HexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/u, 'Invalid hex color')
const QrSchema = z.object({
  fgColor: HexColor,
  bgColor: HexColor,
  logo: z.string().trim().max(2048).optional(),
  dotStyle: z.enum(['dot', 'square']).optional(),
  cornerStyle: z.enum(['rounded', 'square']).optional(),
  errorLevel: z.enum(['L', 'M', 'Q', 'H']).optional(),
  margin: z.number().int().min(0).max(16).optional(),
})

// Link behaviour config as sent by the dashboard (no passwordHash — the server
// derives that from the optional plaintext `password` field).
export const LinkConfigInputSchema = z.object({
  geo: GeoSchema.optional(),
  apple: z.url().max(2048).optional(),
  google: z.url().max(2048).optional(),
  title: z.string().trim().max(256).optional(),
  description: z.string().trim().max(2048).optional(),
  image: z.url().max(2048).optional(),
  cloaking: z.boolean().optional(),
  redirectWithQuery: z.boolean().optional(),
  unsafe: z.boolean().optional(),
  maxVisits: z.number().int().positive().optional(),
  disabled: z.boolean().optional(),
  qr: QrSchema.optional(),
})

const slugField = z
  .string()
  .trim()
  .max(2048)
  .regex(SLUG_REGEX, 'Invalid slug format')

// Bounded free-form tags for link organization.
const tagsField = z.array(z.string().trim().min(1).max(32)).max(20)

export const CreateLinkSchema = z.object({
  url: z.url('Please provide a valid URL').max(2048),
  slug: slugField.optional(),
  domain: z.string().trim().max(255).optional(),
  // Management display name (primary label in the dashboard).
  title: z.string().trim().max(256).optional(),
  comment: z.string().trim().max(2048).optional(),
  tags: tagsField.optional(),
  // Epoch milliseconds; null/omitted means never expires.
  expiresAt: z.number().int().positive().nullable().optional(),
  config: LinkConfigInputSchema.optional(),
  // Plaintext password — hashed server-side into config.passwordHash.
  password: z.string().min(1).max(128).nullable().optional(),
})

export const EditLinkSchema = CreateLinkSchema.extend({
  id: z.string().min(1, 'id is required'),
  url: z.url().max(2048).optional(),
})

export const UpsertLinkSchema = CreateLinkSchema

export const DeleteLinkSchema = z.object({
  id: z.string().min(1),
})

// Add or remove one tag across a batch of links (dashboard bulk action).
export const BulkTagSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  tag: z.string().trim().min(1).max(32),
  op: z.enum(['add', 'remove']),
})

// Replace one link's entire tag set (inline editor saves on popover close).
export const SetTagsSchema = z.object({
  id: z.string().min(1),
  tags: tagsField,
})

export type CreateLinkInput = z.infer<typeof CreateLinkSchema>
export type EditLinkInput = z.infer<typeof EditLinkSchema>
export type LinkConfigInput = z.infer<typeof LinkConfigInputSchema>

// Import accepts the exported stored shape (config kept verbatim incl.
// passwordHash; timestamps as epoch ms).
const ImportConfigSchema = z
  .object({
    // Redirect targets must be http(s) URLs, matching the create path
    // (LinkConfigInputSchema) — importing raw strings would bypass that gate.
    geo: GeoSchema.optional(),
    apple: z.url().max(2048).optional(),
    google: z.url().max(2048).optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    image: z.url().max(2048).optional(),
    cloaking: z.boolean().optional(),
    redirectWithQuery: z.boolean().optional(),
    unsafe: z.boolean().optional(),
    maxVisits: z.number().int().positive().optional(),
    disabled: z.boolean().optional(),
    // Argon2id hash produced by hashPasswordFn: `hex(16B salt):hex(32B hash)`.
    // Bound the shape so import can't smuggle an arbitrary string in.
    passwordHash: z
      .string()
      .regex(/^[0-9a-f]{32}:[0-9a-f]{64}$/u, 'Invalid password hash format')
      .optional(),
    qr: QrSchema.optional(),
  })
  .optional()

export const ImportLinkSchema = z.object({
  // Accepted but ignored on import (a fresh id is minted) — kept lenient.
  id: z.string().nullable().optional(),
  slug: z.string().trim().min(1).max(2048),
  domain: z.string().trim().max(255).optional(),
  url: z.url().max(2048),
  title: z.string().max(256).optional(),
  comment: z.string().max(2048).optional(),
  tags: tagsField.optional(),
  config: ImportConfigSchema,
  expiresAt: z.number().int().nullable().optional(),
  createdAt: z.number().int().optional(),
})

export const ImportDataSchema = z.object({
  version: z.string().optional(),
  links: z.array(ImportLinkSchema).min(1).max(1000),
})

export type ImportLinkInput = z.infer<typeof ImportLinkSchema>
