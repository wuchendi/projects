import * as z from 'zod'
import { SLUG_REGEX } from '@/lib/redirect/slug'

const HexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/u, 'Invalid hex color')

const slugField = z
  .string()
  .trim()
  .max(2048)
  .regex(SLUG_REGEX, 'Invalid slug format')

// A URL bound for an `href` on the public `/m/<slug>` page. Reject any
// non-http(s) scheme (`javascript:`, `data:`, …) — these render into anchors
// served to every visitor, so a foreign scheme is a stored-XSS vector.
const httpUrl = z
  .url()
  .max(2048)
  .refine((v) => {
    try {
      return /^https?:$/u.test(new URL(v).protocol)
    } catch {
      return false
    }
  }, 'Only http(s) URLs are allowed')

// avatar / og.image are optional absolute image URLs held to the same http(s)
// policy as block href/src. The editor emits '' when the field is cleared, so
// tolerate the empty string alongside a valid http(s) URL.
const optionalHttpUrl = z.union([httpUrl, z.literal('')]).optional()

// Background images are interpolated into a CSS `url("…")`, so reject any
// character that could break out of the quoted string and inject CSS. Mirrors
// the renderer's `safeCssImageUrl` guard (defense-in-depth).
const cssImageUrl = z
  .union([
    httpUrl.refine(
      (v) => !/[\s"'()\\]/u.test(v),
      'URL contains characters not allowed in a background image',
    ),
    z.literal(''),
  ])
  .optional()

// Social-bar destinations additionally permit `mailto:` (safe in an href) so an
// Email platform can link a real address; every other scheme is rejected.
const socialUrl = z
  .string()
  .max(2048)
  .refine((v) => {
    try {
      const p = new URL(v).protocol
      return /^https?:$/u.test(p) || p === 'mailto:'
    } catch {
      return false
    }
  }, 'Only http(s) or mailto URLs are allowed')

// Fields shared by every block. Type-specific fields are added per variant.
const blockBase = {
  id: z.string().min(1),
  enabled: z.boolean(),
}

// Content block union (config.blocks). `button`/`shortlink` targets carry a
// link id reference — never a copied URL.
const BlockSchema = z.discriminatedUnion('type', [
  z.object({ ...blockBase, type: z.literal('header') }),
  z.object({
    ...blockBase,
    type: z.literal('socials'),
    items: z
      .array(
        z.object({
          platform: z.string().trim().min(1).max(32),
          url: httpUrl,
        }),
      )
      .max(50),
  }),
  z.object({
    ...blockBase,
    type: z.literal('button'),
    label: z.string().trim().min(1).max(128),
    target: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('link'), linkId: z.string().min(1) }),
      z.object({ kind: z.literal('url'), url: httpUrl }),
    ]),
  }),
  z.object({
    ...blockBase,
    type: z.literal('shortlink'),
    linkIds: z.array(z.string().min(1)).max(100),
  }),
  z.object({
    ...blockBase,
    type: z.literal('image'),
    src: httpUrl,
    link: httpUrl.optional(),
  }),
  z.object({
    ...blockBase,
    type: z.literal('text'),
    text: z.string().max(4096),
  }),
  z.object({ ...blockBase, type: z.literal('divider') }),
])

// A paintable surface (page background or header band): a solid color, a
// two-color gradient, or a cover image with an optional dark scrim.
const SurfaceSchema = z.object({
  type: z.enum(['solid', 'gradient', 'image']),
  from: HexColor,
  to: HexColor.optional(),
  dir: z.enum(['b', 'r', 'br', 'tr']).optional(),
  image: cssImageUrl,
  overlay: z.number().min(0).max(100).optional(),
})

const ConfigSchema = z.object({
  profile: z.object({
    avatar: optionalHttpUrl,
    name: z.string().trim().max(128).optional(),
    bio: z.string().trim().max(512).optional(),
  }),
  theme: z.object({
    preset: z.string().trim().max(64),
    primaryColor: HexColor,
    buttonShape: z.enum(['rounded', 'pill', 'square']),
    buttonFill: z.enum(['solid', 'outline', 'soft']).optional(),
    buttonShadow: z.enum(['none', 'soft', 'hard']).optional(),
    buttonTextColor: HexColor.optional(),
    background: SurfaceSchema.optional(),
    font: z.enum(['sans', 'serif', 'mono', 'rounded']).optional(),
    textColor: z
      .object({ title: HexColor.optional(), body: HexColor.optional() })
      .optional(),
    layout: z
      .enum(['classic', 'left', 'hero', 'banner', 'cover', 'compact'])
      .optional(),
    header: SurfaceSchema.optional(),
  }),
  socials: z
    .object({
      items: z
        .array(
          z.object({
            platform: z.string().trim().min(1).max(32),
            url: socialUrl,
          }),
        )
        .max(50),
      iconColor: z.enum(['brand', 'mono']).optional(),
      placement: z.enum(['top', 'bottom']).optional(),
    })
    .optional(),
  hideBranding: z.boolean().optional(),
  blocks: z.array(BlockSchema).max(100),
})

const OgSchema = z.object({
  title: z.string().trim().max(256).optional(),
  description: z.string().trim().max(2048).optional(),
  image: optionalHttpUrl,
})

export const CreateLaunchpadSchema = z.object({
  slug: slugField.optional(),
  title: z.string().trim().max(256).optional(),
  status: z.enum(['draft', 'published']).optional(),
  config: ConfigSchema.optional(),
  og: OgSchema.optional(),
  // Epoch milliseconds; null/omitted means never expires.
  expiresAt: z.number().int().positive().nullable().optional(),
})

export const EditLaunchpadSchema = CreateLaunchpadSchema.extend({
  id: z.string().min(1, 'id is required'),
})

export const UpsertLaunchpadSchema = CreateLaunchpadSchema

export const DeleteLaunchpadSchema = z.object({
  id: z.string().min(1),
})

export const PublishLaunchpadSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['draft', 'published']),
})

// Click-beacon payload sent from the public `/m/<slug>` page: which launchpad
// (slug) and which block was clicked. Records a `launchpad_block` engagement.
export const TrackLaunchpadSchema = z.object({
  slug: z.string().trim().min(1).max(2048),
  blockId: z.string().trim().min(1).max(128),
})

export type CreateLaunchpadInput = z.infer<typeof CreateLaunchpadSchema>
export type EditLaunchpadInput = z.infer<typeof EditLaunchpadSchema>
