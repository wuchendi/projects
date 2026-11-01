import { cn } from '@cdlab/ui/lib/utils'
import { Globe } from 'lucide-react'
import type { CSSProperties } from 'react'
import { FlnkLogo } from '@/components/layout/logo'
import type { LaunchpadBlock, LaunchpadConfig } from '@/database/schema'
import { SOCIAL_MAP } from './social-icons'

// Resolved short-link reference for button/shortlink blocks: the public route
// (`/<slug>`) the click flows through and a display label. The block stores only
// a link id; the server resolves it to this before rendering.
export interface LinkRef {
  slug: string
  label: string
}

export interface LaunchpadViewProps {
  config: LaunchpadConfig
  // linkId → reference. Missing ids (deleted links) are skipped at render.
  linkRefs: Record<string, LinkRef>
  // Skip the desktop content card — set by the editor's scaled preview, which
  // already frames the page in a phone mock.
  bare?: boolean
}

type Theme = LaunchpadConfig['theme']

const SHAPE_CLASS = {
  rounded: 'rounded-lg',
  pill: 'rounded-full',
  square: 'rounded-none',
} as const

const GRADIENT_DIR = {
  b: 'to bottom',
  r: 'to right',
  br: 'to bottom right',
  tr: 'to top right',
} as const

// System font stacks — no web-font fetch, so the page paints instantly.
const FONT_STACK: Record<NonNullable<Theme['font']>, string | undefined> = {
  sans: undefined,
  serif: 'Georgia, Cambria, "Times New Roman", serif',
  mono: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace',
  rounded:
    '"SF Pro Rounded", "Segoe UI Rounded", "Hiragino Maru Gothic ProN", "Nunito", ui-rounded, system-ui, sans-serif',
}

// Social-bar destinations allow http(s) + mailto (mirrors the zod policy).
function safeSocialHref(url: string): string {
  return /^(?:https?:\/\/|mailto:)/iu.test(url) ? url : '#'
}

// A background image URL is interpolated into a `url("…")` CSS context, so it
// must not contain any character that could break out of the quoted string and
// inject arbitrary CSS. Reject foreign schemes and any whitespace / quote /
// paren / backslash. Returns null → the caller falls back to a solid fill. This
// also guards the editor's live preview, which renders pre-validation input.
function safeCssImageUrl(raw: string): string | null {
  if (/[\s"'()\\]/u.test(raw)) return null
  try {
    return /^https?:$/u.test(new URL(raw).protocol) ? raw : null
  } catch {
    return null
  }
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/u

// The editor's live preview can feed a half-typed hex here; fall back rather
// than render `NaN` colors. Saved configs are already validated by zod.
function safeHex(hex: string | undefined, fallback: string): string {
  return hex && HEX_RE.test(hex) ? hex : fallback
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.slice(1)
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  const n = Number.parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Perceived-brightness contrast pick — dark ink on light fills, white on dark.
function readableInk(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0a0a0a' : '#ffffff'
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

type Surface = NonNullable<Theme['background']>

// Resolve a paintable surface (page background or header band) to a CSS value +
// the ink color that reads on it. Returns null when unset (legacy pages inherit
// the app surface).
function resolveSurface(
  bg: Surface | undefined,
): { background: string; ink: string } | null {
  if (!bg) return null
  if (bg.type === 'image' && bg.image) {
    // Only render the image if it survives CSS-context sanitization; otherwise
    // fall through to a plain fill so a bad URL can't inject CSS.
    const src = safeCssImageUrl(bg.image)
    if (src) {
      const scrim = Math.min(100, Math.max(0, bg.overlay ?? 40)) / 100
      return {
        background: `linear-gradient(rgba(0, 0, 0, ${scrim}), rgba(0, 0, 0, ${scrim})), url("${src}") center / cover no-repeat`,
        ink: '#ffffff',
      }
    }
  }
  const from = safeHex(bg.from, '#ffffff')
  if (bg.type === 'gradient' && bg.to) {
    const to = safeHex(bg.to, from)
    const dir = GRADIENT_DIR[bg.dir ?? 'b']
    return {
      background: `linear-gradient(${dir}, ${from}, ${to})`,
      ink: readableInk(from),
    }
  }
  return { background: from, ink: readableInk(from) }
}

// The color painted on the viewport behind the centered card (visible beyond the
// card on wide screens). Matches the card's bottom edge so they blend: the
// gradient end for gradients, the fill for solids, a dark neutral for images.
function edgeColor(bg: Surface | undefined): string | undefined {
  if (!bg) return undefined
  if (bg.type === 'image') return '#0b0b12'
  if (bg.type === 'gradient' && bg.to)
    return safeHex(bg.to, safeHex(bg.from, '#ffffff'))
  return safeHex(bg.from, '#ffffff')
}

const BUTTON_SHADOW = {
  none: undefined,
  soft: '0 8px 24px -8px rgba(0, 0, 0, 0.35)',
  hard: '4px 4px 0 0 rgba(0, 0, 0, 0.85)',
} as const

// Fill + elevation for a clickable block button, derived from the theme.
function buttonStyle(theme: Theme): CSSProperties {
  const primary = safeHex(theme.primaryColor, '#4f46e5')
  const fill = theme.buttonFill ?? 'solid'
  const label = theme.buttonTextColor // explicit label color, else per-fill default
  const shadow = { boxShadow: BUTTON_SHADOW[theme.buttonShadow ?? 'none'] }
  switch (fill) {
    case 'outline':
      return {
        backgroundColor: 'transparent',
        color: label ?? primary,
        border: `2px solid ${primary}`,
        ...shadow,
      }
    case 'soft':
      return {
        backgroundColor: rgba(primary, 0.14),
        color: label ?? primary,
        border: `1px solid ${rgba(primary, 0.24)}`,
        ...shadow,
      }
    default: {
      // A faint ink-tinted edge keeps a near-black solid fill visible even on a
      // dark surface (the previous default-preset invisibility).
      const ink = readableInk(primary)
      return {
        backgroundColor: primary,
        color: label ?? ink,
        border: `1px solid ${rgba(ink, 0.16)}`,
        ...shadow,
      }
    }
  }
}

// Neutralize a foreign-scheme URL (`javascript:`, `data:`, …) before it reaches
// an `href`. Defense-in-depth: the schema already rejects non-http(s) on write,
// but legacy rows and the editor's unsaved live preview can still flow in here.
// Only for absolute external URLs — internal `/<slug>` hrefs are built directly.
function safeHref(url: string): string {
  return /^https?:\/\//iu.test(url) ? url : '#'
}

// Pure, isomorphic renderer for a launchpad's profile + blocks. Takes already
// resolved data (no DB / server-only imports) so the dashboard editor can reuse
// it for a live preview. Clicks are tracked by a delegated listener keyed on the
// `data-block-id` each clickable element carries — this component stays
// handler-free so it renders identically on the server and in the editor.
export function LaunchpadView({ config, linkRefs, bare }: LaunchpadViewProps) {
  const { profile, theme, blocks, socials } = config
  const shape = SHAPE_CLASS[theme.buttonShape]
  const page = resolveSurface(theme.background)
  // The viewport (behind the card) takes the card's edge color; the font
  // cascades to everything. The theme surface itself paints the card (below).
  const mainStyle: CSSProperties = {
    ...(page ? { background: edgeColor(theme.background) } : {}),
    fontFamily: FONT_STACK[theme.font ?? 'sans'],
  }
  const cardStyle: CSSProperties | undefined = page
    ? { background: page.background, color: page.ink }
    : undefined
  const titleColor = theme.textColor?.title ?? page?.ink
  // Secondary (bio / text / muted) copy: explicit override wins, else fade the
  // inherited ink over a custom background, else the app's muted token.
  const secondary: { className: string; style?: CSSProperties } = theme
    .textColor?.body
    ? { className: '', style: { color: theme.textColor.body } }
    : { className: page ? 'opacity-70' : 'text-muted-foreground' }
  const btnStyle = buttonStyle(theme)

  // Bitly-style single card: the theme surface + font live on one centered
  // panel (max 680px, rounded top, drop-shadow) that holds everything including
  // the footer badge. The viewport behind it takes the card's edge color so the
  // two blend. `framed` adds the rounded/shadow chrome on the real page; the
  // editor preview (`bare`) drops it since its phone frame already frames things.
  const framed = Boolean(page) && !bare

  const socialBar = socials?.items.length ? (
    <SocialBar socials={socials} />
  ) : null
  const placement = socials?.placement ?? 'top'

  const layout = theme.layout ?? 'classic'
  const hasProfile = Boolean(profile.avatar || profile.name || profile.bio)
  // Header band fill + ink for the band-based layouts (hero / banner): the
  // configured header surface, or the primary color as a visible default.
  const headerSurface = resolveSurface(theme.header)
  const heroBg =
    headerSurface?.background ?? safeHex(theme.primaryColor, '#4f46e5')
  const heroInk =
    headerSurface?.ink ?? readableInk(safeHex(theme.primaryColor, '#4f46e5'))

  const avatar = (cls: string) =>
    profile.avatar ? (
      // biome-ignore lint/performance/noImgElement: public render is plain HTML, no next/image
      <img
        src={profile.avatar}
        alt={profile.name ?? ''}
        className={cn('object-cover', cls)}
      />
    ) : null
  const nameEl = profile.name ? (
    <h1 className="text-xl font-semibold" style={{ color: titleColor }}>
      {profile.name}
    </h1>
  ) : null
  const bioEl = profile.bio ? (
    <p
      className={`max-w-sm text-sm ${secondary.className}`}
      style={secondary.style}
    >
      {profile.bio}
    </p>
  ) : null

  let header: React.ReactNode = null
  if (layout === 'hero') {
    header = (
      <div className="w-full">
        <div className="h-28 w-full" style={{ background: heroBg }} />
        <div className="-mt-10 flex flex-col items-center gap-2 px-5 text-center">
          {avatar('size-20 rounded-full ring-4 ring-white/80')}
          {nameEl}
          {bioEl}
        </div>
      </div>
    )
  } else if (layout === 'banner') {
    // Taller band with the avatar + name + bio all sitting on it (band ink).
    header = (
      <div
        className="flex w-full flex-col items-center gap-2 px-5 py-10 text-center"
        style={{ background: heroBg, color: heroInk }}
      >
        {avatar('size-20 rounded-full ring-4 ring-white/25')}
        {profile.name && (
          <h1 className="text-xl font-semibold">{profile.name}</h1>
        )}
        {profile.bio && (
          <p className="max-w-sm text-sm opacity-80">{profile.bio}</p>
        )}
      </div>
    )
  } else if (hasProfile && layout === 'left') {
    header = (
      <header className="flex items-center gap-4 px-5 pt-16">
        {avatar('size-16 rounded-full ring-2 ring-black/5')}
        <div className="min-w-0 text-left">
          {nameEl}
          {bioEl}
        </div>
      </header>
    )
  } else if (hasProfile && layout === 'cover') {
    // Large rounded-square avatar — an image-forward "cover" header.
    header = (
      <header className="flex flex-col items-center gap-3 px-5 pt-16 text-center">
        {avatar('size-28 rounded-2xl ring-2 ring-black/5')}
        {nameEl}
        {bioEl}
      </header>
    )
  } else if (hasProfile && layout === 'compact') {
    // Small avatar inline with the name; tight header.
    header = (
      <header className="flex flex-col items-center gap-1.5 px-5 pt-16 text-center">
        <div className="flex items-center gap-2.5">
          {avatar('size-12 rounded-full ring-2 ring-black/5')}
          {nameEl}
        </div>
        {bioEl}
      </header>
    )
  } else if (hasProfile) {
    header = (
      <header className="flex flex-col items-center gap-2 px-5 pt-16 text-center">
        {avatar(
          'size-20 rounded-full ring-2 ring-black/5 ring-offset-2 ring-offset-transparent',
        )}
        {nameEl}
        {bioEl}
      </header>
    )
  }

  return (
    // The viewport takes the card's edge color; the card (max 680px, centered)
    // carries the theme surface and holds everything as one unit — including the
    // footer badge — so it reads as a single cohesive panel like bitly.
    <main
      data-preset={theme.preset}
      style={mainStyle}
      className={cn(
        'flex min-h-screen w-full flex-col items-center',
        // Float the card below the top edge so its rounded corners show against
        // the viewport edge color (public page only; the preview stays flush).
        framed && 'pt-6 sm:pt-10',
      )}
    >
      <div
        className={cn(
          'flex w-full max-w-[680px] flex-1 flex-col overflow-hidden',
          framed &&
            'rounded-t-[2rem] [filter:drop-shadow(0_0.4rem_4.8rem_#00000029)]',
        )}
        style={cardStyle}
      >
        {header}

        <div
          className={cn(
            'flex w-full flex-col gap-4 px-5 pb-12',
            header ? 'pt-6' : 'pt-16',
          )}
        >
          {placement === 'top' && socialBar}

          <div className="flex w-full flex-col gap-3">
            {blocks
              .filter((block) => block.enabled)
              .map((block) => (
                <Block
                  key={block.id}
                  block={block}
                  linkRefs={linkRefs}
                  shape={shape}
                  btnStyle={btnStyle}
                  secondary={secondary}
                />
              ))}
          </div>

          {placement === 'bottom' && socialBar}
        </div>

        {/* Flnk footer badge — part of the card, pinned to its bottom. */}
        {!config.hideBranding && (
          <div className="mt-auto flex w-full justify-center px-5 pb-6 pt-4">
            <a
              href="https://flnk.cdlab.workers.dev"
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1.5 text-xs font-semibold opacity-50 transition-opacity hover:opacity-100"
            >
              <FlnkLogo className="size-4" />
              Flnk
            </a>
          </div>
        )}
      </div>
    </main>
  )
}

// Page-level social icon bar — curated brand glyphs, painted brand-colored or
// monochrome (inheriting the page ink). Clicks record a `socials` engagement.
function SocialBar({
  socials,
}: {
  socials: NonNullable<LaunchpadConfig['socials']>
}) {
  const mono = socials.iconColor === 'mono'
  const items = socials.items.filter((i) => i.platform && i.url)
  if (items.length === 0) return null
  return (
    <nav className="flex flex-wrap items-center justify-center gap-4">
      {items.map((item) => {
        const platform = SOCIAL_MAP[item.platform]
        const Icon = platform?.Icon
        return (
          <a
            key={`${item.platform}:${item.url}`}
            href={safeSocialHref(item.url)}
            target="_blank"
            rel="noreferrer noopener"
            data-block-id="socials"
            aria-label={platform?.label ?? item.platform}
            className="transition-transform hover:-translate-y-0.5"
            style={mono ? undefined : { color: platform?.color }}
          >
            {Icon ? <Icon className="size-6" /> : <Globe className="size-6" />}
          </a>
        )
      })}
    </nav>
  )
}

function Block({
  block,
  linkRefs,
  shape,
  btnStyle,
  secondary,
}: {
  block: LaunchpadBlock
  linkRefs: Record<string, LinkRef>
  shape: string
  btnStyle: CSSProperties
  secondary: { className: string; style?: CSSProperties }
}) {
  const buttonClass = `block w-full px-5 py-3 text-center text-sm font-medium transition-transform hover:-translate-y-0.5 ${shape}`

  switch (block.type) {
    case 'header':
      // The profile header is rendered once at the top; an in-list header block
      // is a no-op marker.
      return null

    case 'socials':
      return (
        <nav className="flex flex-wrap justify-center gap-3">
          {block.items.map((item) => (
            <a
              key={`${item.platform}:${item.url}`}
              href={safeHref(item.url)}
              target="_blank"
              rel="noreferrer noopener"
              data-block-id={block.id}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              {item.platform}
            </a>
          ))}
        </nav>
      )

    case 'button': {
      const href =
        block.target.kind === 'link'
          ? linkRefs[block.target.linkId]
            ? `/${linkRefs[block.target.linkId]!.slug}`
            : null
          : safeHref(block.target.url)
      if (!href) return null
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          data-block-id={block.id}
          className={buttonClass}
          style={btnStyle}
        >
          {block.label}
        </a>
      )
    }

    case 'shortlink': {
      const refs = block.linkIds
        .map((id) => linkRefs[id])
        .filter((ref): ref is LinkRef => Boolean(ref))
      if (refs.length === 0) return null
      return (
        <>
          {refs.map((ref) => (
            <a
              key={ref.slug}
              href={`/${ref.slug}`}
              target="_blank"
              rel="noreferrer noopener"
              data-block-id={block.id}
              className={buttonClass}
              style={btnStyle}
            >
              {ref.label}
            </a>
          ))}
        </>
      )
    }

    case 'image': {
      const img = (
        // biome-ignore lint/performance/noImgElement: public render is plain HTML, no next/image
        <img
          src={block.src}
          alt=""
          // Constrain to a 16:9 frame (cover-cropped) so a tall source image
          // doesn't dominate the page.
          className="aspect-video w-full rounded-lg object-cover"
        />
      )
      if (!block.link) return img
      return (
        <a
          href={safeHref(block.link)}
          target="_blank"
          rel="noreferrer noopener"
          data-block-id={block.id}
          className="block"
        >
          {img}
        </a>
      )
    }

    case 'text':
      return (
        <p
          className={`whitespace-pre-wrap text-center text-sm ${secondary.className}`}
          style={secondary.style}
        >
          {block.text}
        </p>
      )

    case 'divider':
      return <hr className="my-2 w-full border-current opacity-15" />

    default:
      return null
  }
}
