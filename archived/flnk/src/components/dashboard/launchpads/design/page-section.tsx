import { Label } from '@cdlab/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import { cn } from '@cdlab/ui/lib/utils'
import {
  Check,
  ImageIcon,
  LayoutPanelTop,
  LayoutTemplate,
  MousePointerClick,
  Palette,
  PanelTop,
  Type,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Background, Theme } from './constants'
import {
  bgPreview,
  FILLS,
  FONTS,
  LAYOUTS,
  PRESETS,
  SHADOW_PREVIEW,
  SHADOWS,
  SHAPE_RADIUS,
  SHAPES,
  SWATCHES,
} from './constants'
import {
  ColorInput,
  LayoutThumb,
  OptionalColor,
  PickButton,
  Section,
  SubSection,
  SurfaceEditor,
  SurfaceTypeToggle,
} from './shared'

export function PageSection({
  theme,
  setTheme,
}: {
  theme: Theme
  setTheme: (patch: Partial<Theme>) => void
}) {
  const t = useTranslations('launchpads')

  const fill = theme.buttonFill ?? 'solid'
  const shadow = theme.buttonShadow ?? 'none'
  const font = theme.font ?? 'sans'
  const bg: Background = theme.background ?? { type: 'solid', from: '#ffffff' }
  function setBackground(patch: Partial<Background>) {
    setTheme({ background: { ...bg, ...patch } })
  }
  const layout = theme.layout ?? 'classic'
  const header: Background = theme.header ?? { type: 'solid', from: '#385189' }
  function setHeader(patch: Partial<Background>) {
    setTheme({ header: { ...header, ...patch } })
  }

  // Text-color overrides — an empty value clears back to auto-contrast (no
  // `delete`, per lint) by rebuilding the object without that key.
  function setTitleColor(v?: string) {
    const { title: _t, ...rest } = theme.textColor ?? {}
    setTheme({ textColor: v ? { ...rest, title: v } : rest })
  }
  function setBodyColor(v?: string) {
    const { body: _b, ...rest } = theme.textColor ?? {}
    setTheme({ textColor: v ? { ...rest, body: v } : rest })
  }
  function setButtonTextColor(v?: string) {
    setTheme({ buttonTextColor: v })
  }

  return (
    <Section icon={LayoutPanelTop} title={t('design.sections.page')}>
      <div className="space-y-6 [&>section+section]:border-t [&>section+section]:border-border [&>section+section]:pt-6">
        <SubSection icon={Palette} title={t('design.sections.theme')}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  setTheme({
                    preset: preset.id,
                    primaryColor: preset.color,
                    background: preset.background,
                  })
                }
                className={cn(
                  'group flex flex-col items-center gap-1.5 rounded-lg border p-2 text-xs transition-all hover:border-primary/60 hover:shadow-sm',
                  theme.preset === preset.id &&
                    'border-primary ring-1 ring-primary/30',
                )}
              >
                <span
                  className="relative h-10 w-full overflow-hidden rounded-md ring-1 ring-black/5"
                  style={{ background: bgPreview(preset.background) }}
                >
                  <span
                    className="absolute bottom-1 left-1/2 h-3 w-8 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: preset.color }}
                  />
                </span>
                {t(`design.presets.${preset.id}`)}
              </button>
            ))}
          </div>
        </SubSection>

        <SubSection icon={LayoutTemplate} title={t('design.layout.title')}>
          <div className="grid grid-cols-3 gap-2">
            {LAYOUTS.map((lay) => (
              <button
                key={lay}
                type="button"
                onClick={() => setTheme({ layout: lay })}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border p-2 text-xs transition-all hover:border-primary/60',
                  layout === lay && 'border-primary ring-1 ring-primary/30',
                )}
              >
                <LayoutThumb variant={lay} />
                {t(`design.layout.variants.${lay}`)}
              </button>
            ))}
          </div>
        </SubSection>

        {/* Header band only applies to the hero / banner layouts. */}
        {(layout === 'hero' || layout === 'banner') && (
          <SubSection
            icon={PanelTop}
            title={t('design.header.title')}
            action={<SurfaceTypeToggle value={header} onChange={setHeader} />}
          >
            <p className="text-xs text-muted-foreground">
              {t('design.header.hint')}
            </p>
            <SurfaceEditor value={header} onChange={setHeader} />
          </SubSection>
        )}

        <SubSection
          icon={ImageIcon}
          title={t('design.background.title')}
          action={<SurfaceTypeToggle value={bg} onChange={setBackground} />}
        >
          <SurfaceEditor value={bg} onChange={setBackground} />
        </SubSection>

        <SubSection icon={Type} title={t('design.typography.title')}>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('design.typography.font')}</Label>
            <Select
              value={font}
              onValueChange={(v) => setTheme({ font: v as Theme['font'] })}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONTS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {t(`design.typography.fonts.${f}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="space-y-1.5">
              <Label className="text-xs">
                {t('design.typography.titleColor')}
              </Label>
              <OptionalColor
                value={theme.textColor?.title}
                onChange={setTitleColor}
                autoLabel={t('design.typography.auto')}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {t('design.typography.bodyColor')}
              </Label>
              <OptionalColor
                value={theme.textColor?.body}
                onChange={setBodyColor}
                autoLabel={t('design.typography.auto')}
              />
            </div>
          </div>
        </SubSection>

        <SubSection icon={MousePointerClick} title={t('design.blocks.title')}>
          {/* Shape + fill previewed as the block outline itself. */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('design.buttonShape')}</Label>
            <div className="grid grid-cols-3 gap-2">
              {SHAPES.map((s) => (
                <PickButton
                  key={s}
                  active={theme.buttonShape === s}
                  ariaLabel={t(`design.shapes.${s}`)}
                  onClick={() => setTheme({ buttonShape: s })}
                >
                  <span
                    className="h-5 w-full bg-muted-foreground/30"
                    style={{ borderRadius: SHAPE_RADIUS[s] }}
                  />
                </PickButton>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('design.fill.label')}</Label>
            <div className="grid grid-cols-3 gap-2">
              {FILLS.map((f) => (
                <PickButton
                  key={f}
                  active={fill === f}
                  ariaLabel={t(`design.fill.${f}`)}
                  onClick={() => setTheme({ buttonFill: f })}
                >
                  <span
                    className={cn(
                      'h-5 w-full rounded-md',
                      f === 'solid' && 'bg-muted-foreground/40',
                      f === 'outline' && 'border-2 border-muted-foreground/40',
                      f === 'soft' && 'bg-muted-foreground/15',
                    )}
                  />
                </PickButton>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('design.shadow.label')}</Label>
            <div className="grid grid-cols-3 gap-2">
              {SHADOWS.map((s) => (
                <PickButton
                  key={s}
                  active={shadow === s}
                  ariaLabel={t(`design.shadow.${s}`)}
                  onClick={() => setTheme({ buttonShadow: s })}
                >
                  <span
                    className="h-5 w-full rounded-md bg-card ring-1 ring-border"
                    style={{ boxShadow: SHADOW_PREVIEW[s] }}
                  />
                </PickButton>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('design.blocks.blockColor')}</Label>
              <div className="flex flex-wrap items-center gap-2">
                {SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    onClick={() => setTheme({ primaryColor: color })}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full border transition-transform hover:scale-110',
                      theme.primaryColor.toLowerCase() === color &&
                        'ring-2 ring-ring ring-offset-2',
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {theme.primaryColor.toLowerCase() === color && (
                      <Check className="size-3.5 text-white" />
                    )}
                  </button>
                ))}
                <ColorInput
                  value={theme.primaryColor}
                  onChange={(primaryColor) => setTheme({ primaryColor })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('design.blocks.blockText')}</Label>
              <OptionalColor
                value={theme.buttonTextColor}
                onChange={setButtonTextColor}
                autoLabel={t('design.typography.auto')}
              />
            </div>
          </div>
        </SubSection>
      </div>
    </Section>
  )
}
