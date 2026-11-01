import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@cdlab/ui/components/input-group'
import { Label } from '@cdlab/ui/components/label'
import { ToggleGroup, ToggleGroupItem } from '@cdlab/ui/components/toggle-group'
import { cn } from '@cdlab/ui/lib/utils'
import { ChevronUp, GripVertical, Plus, Share2, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
  SOCIAL_MAP,
  SOCIAL_PLATFORMS,
} from '@/components/launchpad/social-icons'
import type { LaunchpadConfig } from '@/database/schema'
import { SOCIAL_PICKER_PREVIEW } from './constants'
import { Section } from './shared'

type Socials = NonNullable<LaunchpadConfig['socials']>

export function SocialsSection({
  socials,
  setSocials,
}: {
  socials: Socials
  setSocials: (patch: Partial<Socials>) => void
}) {
  const t = useTranslations('launchpads')
  const [showAllSocials, setShowAllSocials] = useState(false)
  // Drag state for the reorderable socials list.
  const [socialDrag, setSocialDrag] = useState<number | null>(null)

  function addSocial(platform: string) {
    setSocials({ items: [...socials.items, { platform, url: '' }] })
  }
  function updateSocial(index: number, url: string) {
    setSocials({
      items: socials.items.map((it, i) => (i === index ? { ...it, url } : it)),
    })
  }
  // Normalize a social destination on blur: the Email row accepts a bare address
  // (e.g. `me@example.com`), which fails the http(s)/mailto schema unless we add
  // the `mailto:` scheme — otherwise the link silently can't be saved.
  function normalizeSocial(index: number) {
    const item = socials.items[index]
    if (!item) return
    const v = item.url.trim()
    if (
      item.platform === 'gmail' &&
      v &&
      v.includes('@') &&
      !/^(?:https?:\/\/|mailto:)/iu.test(v)
    ) {
      updateSocial(index, `mailto:${v}`)
    } else if (v !== item.url) {
      updateSocial(index, v)
    }
  }
  function removeSocial(index: number) {
    setSocials({ items: socials.items.filter((_, i) => i !== index) })
  }
  function moveSocial(from: number, to: number) {
    if (to < 0 || to >= socials.items.length) return
    const next = [...socials.items]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item!)
    setSocials({ items: next })
  }

  return (
    <Section icon={Share2} title={t('design.socials.title')}>
      <div className="space-y-1.5">
        <Label className="text-xs">{t('design.socials.pick')}</Label>
        <div className="flex flex-wrap gap-1.5">
          {(showAllSocials
            ? SOCIAL_PLATFORMS
            : SOCIAL_PLATFORMS.slice(0, SOCIAL_PICKER_PREVIEW)
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addSocial(p.id)}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary/60"
            >
              <p.Icon className="size-3.5" style={{ color: p.color }} />
              {p.label}
            </button>
          ))}
          {SOCIAL_PLATFORMS.length > SOCIAL_PICKER_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllSocials((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:border-primary/60"
            >
              {showAllSocials ? (
                <>
                  <ChevronUp className="size-3.5" />
                  {t('design.socials.viewFewer')}
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  {t('design.socials.viewMore')}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {socials.items.length > 0 && (
        <div className="space-y-2">
          {socials.items.map((item, i) => {
            const p = SOCIAL_MAP[item.platform]
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional, platforms may repeat
                key={i}
                draggable
                onDragStart={() => setSocialDrag(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (socialDrag !== null) moveSocial(socialDrag, i)
                  setSocialDrag(null)
                }}
                onDragEnd={() => setSocialDrag(null)}
                className={cn(
                  'flex items-center gap-2',
                  socialDrag === i && 'opacity-50',
                )}
              >
                <GripVertical
                  className="size-4 shrink-0 cursor-grab text-muted-foreground"
                  aria-label={t('design.socials.reorder')}
                />
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-md border"
                  style={{ color: p?.color }}
                >
                  {p ? (
                    <p.Icon className="size-4" />
                  ) : (
                    <Share2 className="size-4" />
                  )}
                </span>
                <InputGroup className="flex-1">
                  <InputGroupInput
                    value={item.url}
                    placeholder={t('design.socials.urlPlaceholder')}
                    maxLength={2048}
                    onChange={(e) => updateSocial(i, e.target.value)}
                    onBlur={() => normalizeSocial(i)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={t('design.socials.remove')}
                      onClick={() => removeSocial(i)}
                    >
                      <Trash2 className="text-destructive" />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </div>
            )
          })}
        </div>
      )}

      {socials.items.length > 0 && (
        <div className="flex flex-wrap gap-6">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('design.socials.iconColor')}</Label>
            <ToggleGroup
              type="single"
              value={socials.iconColor ?? 'brand'}
              onValueChange={(v) =>
                v && setSocials({ iconColor: v as 'brand' | 'mono' })
              }
              variant="outline"
            >
              <ToggleGroupItem value="brand" className="px-4">
                {t('design.socials.brand')}
              </ToggleGroupItem>
              <ToggleGroupItem value="mono" className="px-4">
                {t('design.socials.mono')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('design.socials.placement')}</Label>
            <ToggleGroup
              type="single"
              value={socials.placement ?? 'top'}
              onValueChange={(v) =>
                v && setSocials({ placement: v as 'top' | 'bottom' })
              }
              variant="outline"
            >
              <ToggleGroupItem value="top" className="px-4">
                {t('design.socials.top')}
              </ToggleGroupItem>
              <ToggleGroupItem value="bottom" className="px-4">
                {t('design.socials.bottom')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      )}
    </Section>
  )
}
