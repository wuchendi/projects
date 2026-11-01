import type { LinkRef } from '@/components/launchpad/launchpad-view'
import type { LaunchpadBlock } from '@/database/schema'
import type { LinkRow } from '@/lib/platform/api'

export type BlockType = LaunchpadBlock['type']

// The header is a pinned singleton edited from the fixed card at the top of
// the build tab — it is not addable as a content block.
export type AddableBlockType = Exclude<BlockType, 'header'>

// Add-menu order. `socials` is intentionally excluded: social links are now a
// page-level bar edited from the Design tab. Legacy `socials` content blocks
// still render, but no new ones are created here.
export const BLOCK_TYPES: AddableBlockType[] = [
  'button',
  'shortlink',
  'image',
  'text',
  'divider',
]

// Fresh block of `type` with sensible empty defaults and a unique id.
export function newBlock(type: AddableBlockType): LaunchpadBlock {
  const id = crypto.randomUUID()
  switch (type) {
    case 'socials':
      return { id, type, enabled: true, items: [] }
    case 'button':
      return {
        id,
        type,
        enabled: true,
        label: '',
        target: { kind: 'url', url: '' },
      }
    case 'shortlink':
      return { id, type, enabled: true, linkIds: [] }
    case 'image':
      return { id, type, enabled: true, src: '' }
    case 'text':
      return { id, type, enabled: true, text: '' }
    case 'divider':
      return { id, type, enabled: true }
  }
}

// Build the linkId → reference map the renderer needs from the loaded links.
export function buildLinkRefs(links: LinkRow[]): Record<string, LinkRef> {
  const refs: Record<string, LinkRef> = {}
  for (const link of links) {
    refs[link.id] = { slug: link.slug, label: link.title || link.slug }
  }
  return refs
}
