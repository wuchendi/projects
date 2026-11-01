import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
} from 'lucide-react'
import type { LaunchpadConfig } from '@/database/schema'

export type Theme = LaunchpadConfig['theme']
export type Background = NonNullable<Theme['background']>

// Platforms shown in the Socials picker before "View more" is expanded.
export const SOCIAL_PICKER_PREVIEW = 5

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/u
export const safeHex = (v: string, fallback = '#000000') =>
  HEX_RE.test(v) ? v : fallback

// Theme presets — each seeds a coordinated primary color + page background so a
// single click yields a finished look. Colors stay independently editable below.
export const PRESETS: { id: string; color: string; background: Background }[] =
  [
    {
      id: 'default',
      color: '#4f46e5',
      background: {
        type: 'gradient',
        from: '#e0e7ff',
        to: '#a5b4fc',
        dir: 'b',
      },
    },
    {
      id: 'midnight',
      color: '#a5b4fc',
      background: {
        type: 'gradient',
        from: '#312e81',
        to: '#0f172a',
        dir: 'b',
      },
    },
    {
      id: 'sunset',
      color: '#c2410c',
      background: {
        type: 'gradient',
        from: '#ffedd5',
        to: '#fdba74',
        dir: 'b',
      },
    },
    {
      id: 'forest',
      color: '#15803d',
      background: {
        type: 'gradient',
        from: '#dcfce7',
        to: '#86efac',
        dir: 'b',
      },
    },
    {
      id: 'rose',
      color: '#be123c',
      background: {
        type: 'gradient',
        from: '#ffe4e6',
        to: '#fda4af',
        dir: 'b',
      },
    },
    {
      id: 'ocean',
      color: '#0e7490',
      background: {
        type: 'gradient',
        from: '#cffafe',
        to: '#67e8f9',
        dir: 'b',
      },
    },
  ]

// Curated color swatches for quick primary-color selection.
export const SWATCHES = [
  '#4f46e5',
  '#2563eb',
  '#0891b2',
  '#15803d',
  '#ca8a04',
  '#ea580c',
  '#dc2626',
  '#e11d48',
  '#9333ea',
  '#000000',
]

export const SHAPES = ['rounded', 'pill', 'square'] as const
export const FILLS = ['solid', 'outline', 'soft'] as const
export const SHADOWS = ['none', 'soft', 'hard'] as const
export const FONTS = ['sans', 'serif', 'mono', 'rounded'] as const

// Border radius + shadow used to preview each block shape/shadow in its picker.
export const SHAPE_RADIUS: Record<(typeof SHAPES)[number], string> = {
  rounded: '0.5rem',
  pill: '9999px',
  square: '0px',
}
export const SHADOW_PREVIEW: Record<(typeof SHADOWS)[number], string> = {
  none: 'none',
  soft: '0 6px 14px -4px rgba(0, 0, 0, 0.3)',
  hard: '3px 3px 0 0 rgba(0, 0, 0, 0.6)',
}
export const BG_TYPES = ['solid', 'gradient', 'image'] as const
export const LAYOUTS = [
  'classic',
  'left',
  'hero',
  'banner',
  'cover',
  'compact',
] as const
export const DIRECTIONS: { id: Background['dir']; icon: typeof ArrowDown }[] = [
  { id: 'b', icon: ArrowDown },
  { id: 'r', icon: ArrowRight },
  { id: 'br', icon: ArrowDownRight },
  { id: 'tr', icon: ArrowUpRight },
]

// Preview a preset/background swatch as the actual gradient it produces.
export function bgPreview(bg: Background): string {
  const from = safeHex(bg.from, '#ffffff')
  if (bg.type === 'gradient' && bg.to) {
    const to = safeHex(bg.to, from)
    const dir = { b: '180deg', r: '90deg', br: '135deg', tr: '45deg' }[
      bg.dir ?? 'b'
    ]
    return `linear-gradient(${dir}, ${from}, ${to})`
  }
  return from
}
