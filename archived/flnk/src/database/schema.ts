import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

const trackingFields = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  isDeleted: integer('is_deleted').notNull().default(0),
}

// Per-link behaviour, stored as a single JSON column so the redirect engine can
// read everything in one row. All fields are optional — an empty object means a
// plain redirect to `url`.
export interface LinkConfig {
  // Geo routing: ISO-3166-1 alpha-2 country code → destination URL.
  geo?: Record<string, string>
  // Device routing: override destination for Apple / Android user agents.
  apple?: string
  google?: string
  // Social-bot OG metadata.
  title?: string
  description?: string
  image?: string
  // When true, serve the OG HTML to everyone (link cloaking) instead of redirecting.
  cloaking?: boolean
  // Per-link override of the global REDIRECT_WITH_QUERY behaviour.
  redirectWithQuery?: boolean
  // When true, show an interstitial warning before redirecting.
  unsafe?: boolean
  // Click limit: expire the link after this many visits (KV counter `visits:{id}`).
  maxVisits?: number
  // When true, the link is paused: the redirect path serves not-found without
  // soft-deleting the row.
  disabled?: boolean
  // Argon2id hash of the link password (`<saltHex>:<hashHex>`, via
  // `@cdlab/utils` hashPasswordFn/verifyPasswordFn); when set, the
  // destination is gated behind a password form.
  passwordHash?: string
  // Per-link QR style. The QR encodes the link's public `/<slug>?qr=1` URL and
  // is rendered client-side (never stored as an image). `logo` is an R2 asset
  // URL (R2 on → upload) or a pasted image URL (R2 off).
  qr?: {
    fgColor: string
    bgColor: string
    logo?: string
    dotStyle?: 'dot' | 'square'
    cornerStyle?: 'rounded' | 'square'
    errorLevel?: 'L' | 'M' | 'Q' | 'H'
    margin?: number
  }
}

export const links = sqliteTable(
  'links',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    domain: text('domain').notNull().default(''),
    url: text('url').notNull(),
    // Human-readable management display name shown as the primary label in the
    // dashboard. Distinct from `comment` (free-form note) and `config.title`
    // (OG title served to social crawlers).
    title: text('title').notNull().default(''),
    comment: text('comment').notNull().default(''),
    // Owner key (= user.id) used for tenant scoping. Backfilled from `created_by`
    // via the email→user.id lookup; empty for legacy/unmappable rows.
    ownerId: text('owner_id').notNull().default(''),
    // Email of the signed-in user who created the link (display/audit only —
    // owner scoping is by `ownerId`). Empty for legacy rows.
    createdBy: text('created_by').notNull().default(''),
    // Tag IDs (referencing `tags.id`) stored inline as a JSON array. Storing IDs
    // rather than names means renaming a tag is a single-row update to `tags`
    // with no fan-out rewrite of every link that carries it.
    tags: text('tags', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default([]),
    config: text('config', { mode: 'json' })
      .$type<LinkConfig>()
      .notNull()
      .default({}),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    ...trackingFields,
  },
  (table) => [
    uniqueIndex('uniq_links_slug_domain').on(table.slug, table.domain),
    index('idx_links_expires_at').on(table.expiresAt),
    // Owner-scoped list/count/search + analytics slug resolution all filter by
    // `owner_id` (= user.id) and default-sort by `created_at`; this composite
    // serves the filter, range, and ordering in one index. Owner scoping moved
    // off `created_by` (email) to `owner_id`.
    index('idx_links_owner_id_created_at').on(table.ownerId, table.createdAt),
  ],
)

// Launchpad page config, stored as a single JSON column. `profile` backs the
// header block; `theme` drives the page-level look; `blocks` is the ordered
// content list (array order = render order).
export interface LaunchpadConfig {
  profile: {
    avatar?: string
    name?: string
    bio?: string
  }
  theme: {
    preset: string
    primaryColor: string
    buttonShape: 'rounded' | 'pill' | 'square'
    // Button fill + elevation. Optional for backward compatibility — legacy
    // rows render as a solid, shadowless button.
    buttonFill?: 'solid' | 'outline' | 'soft'
    buttonShadow?: 'none' | 'soft' | 'hard'
    // Explicit block/button label color; unset = auto-contrast against the fill.
    buttonTextColor?: string
    // Optional page background. When absent the public page inherits the app
    // theme surface (legacy behavior); when present it paints its own gradient,
    // solid fill, or cover image and the renderer auto-picks a readable ink.
    background?: {
      type: 'solid' | 'gradient' | 'image'
      from: string
      to?: string
      dir?: 'b' | 'r' | 'br' | 'tr'
      // `image` backgrounds: cover image URL + a 0–100 dark scrim for legibility.
      image?: string
      overlay?: number
    }
    // Page font family (system stacks — no web-font fetch). Defaults to sans.
    font?: 'sans' | 'serif' | 'mono' | 'rounded'
    // Explicit text-color overrides; when unset the renderer auto-contrasts
    // against the background.
    textColor?: { title?: string; body?: string }
    // Header/profile layout. classic = centered (default); left = avatar + text
    // left-aligned; hero = header band with the avatar overlapping it; banner =
    // taller band with name/bio inside it; cover = large rounded-square avatar;
    // compact = small avatar inline with the name.
    layout?: 'classic' | 'left' | 'hero' | 'banner' | 'cover' | 'compact'
    // Header band surface (used by the `hero` layout). Same shape as
    // `background`; `solid` paints a single color, `gradient` two, `image` a
    // cover photo with an optional dark scrim.
    header?: {
      type: 'solid' | 'gradient' | 'image'
      from: string
      to?: string
      dir?: 'b' | 'r' | 'br' | 'tr'
      image?: string
      overlay?: number
    }
  }
  // Page-level social icon bar (curated brand glyphs), rendered above or below
  // the content. Distinct from the legacy `socials` content block.
  socials?: {
    items: { platform: string; url: string }[]
    iconColor?: 'brand' | 'mono'
    placement?: 'top' | 'bottom'
  }
  // Hide the "Flnk" footer badge. Absent/false = shown (default on).
  hideBranding?: boolean
  blocks: LaunchpadBlock[]
}

// A launchpad content block. Array order = render order; each block carries an
// `id`, `type`, and `enabled` flag plus type-specific fields. `button`/
// `shortlink` targets store the LINK ID (reference), never a copied URL, so
// clicks route through `/<slug>` and reuse the short link's stats + editable
// destination.
export type LaunchpadBlock =
  | { id: string; type: 'header'; enabled: boolean }
  | {
      id: string
      type: 'socials'
      enabled: boolean
      items: { platform: string; url: string }[]
    }
  | {
      id: string
      type: 'button'
      enabled: boolean
      label: string
      target: { kind: 'link'; linkId: string } | { kind: 'url'; url: string }
    }
  | { id: string; type: 'shortlink'; enabled: boolean; linkIds: string[] }
  | { id: string; type: 'image'; enabled: boolean; src: string; link?: string }
  | { id: string; type: 'text'; enabled: boolean; text: string }
  | { id: string; type: 'divider'; enabled: boolean }

// Page-level Open Graph metadata for sharing `/m/<slug>`.
export interface LaunchpadOg {
  title?: string
  description?: string
  image?: string
}

export type LaunchpadStatus = 'draft' | 'published'

// Default config seeded on a fresh launchpad — empty profile, neutral theme,
// no blocks. Used as the column default and by the repository on create.
export const DEFAULT_LAUNCHPAD_CONFIG: LaunchpadConfig = {
  profile: {},
  theme: {
    preset: 'default',
    primaryColor: '#4f46e5',
    buttonShape: 'rounded',
    buttonFill: 'solid',
    buttonShadow: 'soft',
    background: { type: 'gradient', from: '#e0e7ff', to: '#a5b4fc', dir: 'b' },
  },
  blocks: [],
}

// Hosted marketing / link-in-bio pages, managed in the dashboard and published
// at `/m/<slug>`. `slug` is globally unique (the public route resolves by URL
// with no auth context). `ownerId` (= user.id) is stamped on every write but
// NOT filtered yet — the shared-workspace baseline; isolation flips later via
// the `scopeToOwner` helper with no schema backfill.
export const launchpads = sqliteTable(
  'launchpads',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    ownerId: text('owner_id').notNull().default(''),
    title: text('title').notNull().default(''),
    status: text('status').$type<LaunchpadStatus>().notNull().default('draft'),
    config: text('config', { mode: 'json' })
      .$type<LaunchpadConfig>()
      .notNull()
      .default(DEFAULT_LAUNCHPAD_CONFIG),
    og: text('og', { mode: 'json' }).$type<LaunchpadOg>().notNull().default({}),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    ...trackingFields,
  },
  (table) => [
    uniqueIndex('uniq_launchpads_slug').on(table.slug),
    // Owner-scoped list/count + analytics slug resolution filter by `owner_id`
    // and default-sort by `created_at`.
    index('idx_launchpads_owner_id_created_at').on(
      table.ownerId,
      table.createdAt,
    ),
  ],
)

// Tag dictionary — each tag name exists exactly once and is the single source
// of truth. Links reference a tag by its `id` (stored in the inline
// `links.tags` array), so renaming a tag is a single-row update here.
export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    // Owner key (= user.id) used for tenant scoping. Backfilled from `created_by`
    // via the email→user.id lookup; empty for legacy/unmappable rows.
    ownerId: text('owner_id').notNull().default(''),
    // Email of the signed-in user who first created the tag (display/audit only —
    // owner scoping is by `ownerId`). Empty for legacy rows.
    createdBy: text('created_by').notNull().default(''),
    ...trackingFields,
  },
  (table) => [
    uniqueIndex('uniq_tags_name_owner_id').on(table.name, table.ownerId),
    // `listTags` filters by `owner_id` alone; the composite unique index above
    // leads with `name`, so it can't serve an owner-only lookup.
    index('idx_tags_owner_id').on(table.ownerId),
  ],
)

// better-auth core tables. Column/table names must match better-auth's expected
// schema so the drizzle adapter maps them without overrides.

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .default(false)
    .notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
})

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
)

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('account_user_id_idx').on(table.userId)],
)

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

// The persisted `links` row carries tag IDs in its inline `tags` column. The
// repository resolves those IDs to names (via the `tags` dictionary) before
// handing a link to the API/UI, so `Link.tags` is always a name list.
export type LinkRow = typeof links.$inferSelect
export type Link = LinkRow
export type NewLink = typeof links.$inferInsert

export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert

export type Launchpad = typeof launchpads.$inferSelect
export type NewLaunchpad = typeof launchpads.$inferInsert

export type User = typeof user.$inferSelect
export type Session = typeof session.$inferSelect
export type Account = typeof account.$inferSelect
export type Verification = typeof verification.$inferSelect
