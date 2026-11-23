'use client'

import { Input } from '@cdlab/ui/components/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import { cn } from '@cdlab/ui/lib/utils'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { memo, useCallback, useMemo, useState } from 'react'
import { PanelBaseView as BaseView } from '@/components/editor/panels/panel-base-view'
import {
  PropertyGroup,
  PropertyItem,
  PropertyItemLabel,
  PropertyItemValue,
} from '@/components/editor/panels/properties/property-item'
import {
  BLUR_INTENSITY_PRESETS,
  CANVAS_SIZE_PRESETS,
  DEFAULT_BLUR_INTENSITY,
  DEFAULT_COLOR,
  FPS_PRESETS,
} from '@/constants/project-constants'
import { patternCraftGradients } from '@/data/colors/pattern-craft'
import { colors } from '@/data/colors/solid'
import { syntaxUIGradients } from '@/data/colors/syntax-ui'
import { useEditor } from '@/hooks/use-editor'

export function SettingsView() {
  return <ProjectSettingsTabs />
}

function ProjectSettingsTabs() {
  const t = useTranslations()
  const editor = useEditor()
  const isAudioProject = editor.project.getActive()?.metadata.type === 'audio'

  return (
    <BaseView
      defaultTab="project-info"
      tabs={[
        {
          value: 'project-info',
          label: t('projects.info'),
          content: (
            <div className="p-5">
              <ProjectInfoView />
            </div>
          ),
        },
        ...(isAudioProject
          ? []
          : [
              {
                value: 'background',
                label: t('properties.background'),
                content: (
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex-1">
                      <BackgroundView />
                    </div>
                  </div>
                ),
              },
            ]),
      ]}
      className="flex h-full flex-col justify-between p-0"
    />
  )
}

const CANVAS_FIT_VALUE = 'fit'
const CANVAS_CUSTOM_VALUE = 'custom'

function resolveCanvasSizePresetValue({
  width,
  height,
  originalCanvasSize,
}: {
  width: number
  height: number
  originalCanvasSize: { width: number; height: number } | null
}): string {
  const isOriginalMatch =
    originalCanvasSize &&
    originalCanvasSize.width === width &&
    originalCanvasSize.height === height
  if (isOriginalMatch) {
    return CANVAS_FIT_VALUE
  }

  for (const preset of CANVAS_SIZE_PRESETS) {
    if (preset.width === width && preset.height === height) {
      return preset.label
    }
  }

  return CANVAS_CUSTOM_VALUE
}

function ProjectInfoView() {
  const t = useTranslations()
  const editor = useEditor()
  const activeProject = editor.project.getActive()
  const isAudioProject = activeProject.metadata.type === 'audio'

  const currentCanvasSize = activeProject.settings.canvasSize
  const originalCanvasSize = activeProject.settings.originalCanvasSize ?? null

  const selectedValue = resolveCanvasSizePresetValue({
    width: currentCanvasSize.width,
    height: currentCanvasSize.height,
    originalCanvasSize,
  })

  const isCustom = selectedValue === CANVAS_CUSTOM_VALUE
  const [customWidth, setCustomWidth] = useState(currentCanvasSize.width)
  const [customHeight, setCustomHeight] = useState(currentCanvasSize.height)

  const handleCanvasSizeChange = ({ value }: { value: string }) => {
    if (value === CANVAS_FIT_VALUE) {
      const canvasSize = originalCanvasSize ?? currentCanvasSize
      void editor.project.updateSettings({ settings: { canvasSize } })
      return
    }

    if (value === CANVAS_CUSTOM_VALUE) {
      setCustomWidth(currentCanvasSize.width)
      setCustomHeight(currentCanvasSize.height)
      return
    }

    const matched = CANVAS_SIZE_PRESETS.find((preset) => preset.label === value)
    if (matched) {
      void editor.project.updateSettings({
        settings: {
          canvasSize: { width: matched.width, height: matched.height },
        },
      })
    }
  }

  const applyCustomSize = ({
    width,
    height,
  }: {
    width: number
    height: number
  }) => {
    const clampedWidth = Math.max(1, Math.round(width))
    const clampedHeight = Math.max(1, Math.round(height))
    void editor.project.updateSettings({
      settings: {
        canvasSize: {
          width: clampedWidth,
          height: clampedHeight,
        },
      },
    })
  }

  const handleFpsChange = (value: string) => {
    const fps = parseFloat(value)
    void editor.project.updateSettings({ settings: { fps } })
  }

  return (
    <div className="flex flex-col gap-4">
      <PropertyItem direction="column">
        <PropertyItemLabel>{t('common.name')}</PropertyItemLabel>
        <PropertyItemValue>{activeProject.metadata.name}</PropertyItemValue>
      </PropertyItem>

      {!isAudioProject && (
        <>
          <PropertyItem direction="column">
            <PropertyItemLabel>{t('export.canvasSize')}</PropertyItemLabel>
            <PropertyItemValue>
              <Select
                value={selectedValue}
                items={[
                  {
                    value: CANVAS_FIT_VALUE,
                    label: originalCanvasSize
                      ? t('properties.fitWithSize', {
                          width: originalCanvasSize.width,
                          height: originalCanvasSize.height,
                        })
                      : t('properties.fit'),
                  },
                  ...CANVAS_SIZE_PRESETS.map((preset) => ({
                    value: preset.label,
                    label: `${preset.label} (${preset.width}×${preset.height})`,
                  })),
                  { value: CANVAS_CUSTOM_VALUE, label: t('common.custom') },
                ]}
                onValueChange={(value) => {
                  if (value !== null) handleCanvasSizeChange({ value })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('export.selectCanvasSize')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CANVAS_FIT_VALUE}>
                    {originalCanvasSize
                      ? t('properties.fitWithSize', {
                          width: originalCanvasSize.width,
                          height: originalCanvasSize.height,
                        })
                      : t('properties.fit')}
                  </SelectItem>
                  {CANVAS_SIZE_PRESETS.map((preset) => (
                    <SelectItem key={preset.label} value={preset.label}>
                      {preset.label} ({preset.width}×{preset.height})
                    </SelectItem>
                  ))}
                  <SelectItem value={CANVAS_CUSTOM_VALUE}>
                    {t('common.custom')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </PropertyItemValue>
          </PropertyItem>

          {isCustom && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={customWidth}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setCustomWidth(value)
                }}
                onBlur={() =>
                  applyCustomSize({ width: customWidth, height: customHeight })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    applyCustomSize({
                      width: customWidth,
                      height: customHeight,
                    })
                  }
                }}
                className="w-0 flex-1"
                aria-label={t('properties.canvasWidth')}
              />
              <span className="text-muted-foreground text-xs">×</span>
              <Input
                type="number"
                min={1}
                value={customHeight}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setCustomHeight(value)
                }}
                onBlur={() =>
                  applyCustomSize({ width: customWidth, height: customHeight })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    applyCustomSize({
                      width: customWidth,
                      height: customHeight,
                    })
                  }
                }}
                className="w-0 flex-1"
                aria-label={t('properties.canvasHeight')}
              />
            </div>
          )}

          <PropertyItem direction="column">
            <PropertyItemLabel>{t('export.frameRate')}</PropertyItemLabel>
            <PropertyItemValue>
              <Select
                value={activeProject.settings.fps.toString()}
                items={FPS_PRESETS.map((preset) => ({
                  value: preset.value,
                  label: preset.label,
                }))}
                onValueChange={(value) => {
                  if (value !== null) handleFpsChange(value)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('export.selectFrameRate')} />
                </SelectTrigger>
                <SelectContent>
                  {FPS_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyItemValue>
          </PropertyItem>
        </>
      )}
    </div>
  )
}

const BlurPreview = memo(
  ({
    blur,
    isSelected,
    onSelect,
    t,
  }: {
    blur: { label: string; value: number }
    isSelected: boolean
    onSelect: () => void
    t: (key: string, options?: Record<string, string>) => string
  }) => (
    <button
      className={cn(
        'border-foreground/15 hover:border-primary relative aspect-square size-20 cursor-pointer overflow-hidden rounded-sm border',
        isSelected && 'border-primary border-2',
      )}
      onClick={onSelect}
      type="button"
      aria-label={t('properties.selectBlur', { label: blur.label })}
    >
      <Image
        src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
        alt={`Blur preview ${blur.label}`}
        fill
        className="object-cover"
        style={{ filter: `blur(${blur.value}px)` }}
        loading="eager"
      />
      <div className="absolute right-1 bottom-1 left-1 text-center">
        <span className="rounded bg-black/50 px-1 text-xs text-white">
          {t(blur.label)}
        </span>
      </div>
    </button>
  ),
)

BlurPreview.displayName = 'BlurPreview'

const BackgroundPreviews = memo(
  ({
    backgrounds,
    currentBackgroundColor,
    isColorBackground,
    handleColorSelect,
    useBackgroundColor = false,
  }: {
    backgrounds: string[]
    currentBackgroundColor: string
    isColorBackground: boolean
    handleColorSelect: ({ bg }: { bg: string }) => void
    useBackgroundColor?: boolean
  }) => {
    return useMemo(
      () =>
        backgrounds.map((bg, index) => (
          <button
            key={`${index}-${bg}`}
            className={cn(
              'border-foreground/15 hover:border-primary aspect-square size-20 cursor-pointer rounded-sm border',
              isColorBackground &&
                bg === currentBackgroundColor &&
                'border-primary border-2',
            )}
            style={
              useBackgroundColor
                ? { backgroundColor: bg }
                : {
                    background: bg,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }
            }
            onClick={() => handleColorSelect({ bg })}
            type="button"
            aria-label={`Select background ${useBackgroundColor ? bg : index + 1}`}
          />
        )),
      [
        backgrounds,
        isColorBackground,
        currentBackgroundColor,
        handleColorSelect,
        useBackgroundColor,
      ],
    )
  },
)

BackgroundPreviews.displayName = 'BackgroundPreviews'

function BackgroundView() {
  const t = useTranslations()
  const editor = useEditor()
  const activeProject = editor.project.getActive()
  const blurLevels = useMemo(() => BLUR_INTENSITY_PRESETS, [])

  const handleBlurSelect = useCallback(
    async ({ blurIntensity }: { blurIntensity: number }) => {
      await editor.project.updateSettings({
        settings: { background: { type: 'blur', blurIntensity } },
      })
    },
    [editor.project],
  )

  const handleColorSelect = useCallback(
    async ({ color }: { color: string }) => {
      await editor.project.updateSettings({
        settings: { background: { type: 'color', color } },
      })
    },
    [editor.project],
  )

  const currentBlurIntensity =
    activeProject.settings.background.type === 'blur'
      ? activeProject.settings.background.blurIntensity
      : DEFAULT_BLUR_INTENSITY

  const currentBackgroundColor =
    activeProject.settings.background.type === 'color'
      ? activeProject.settings.background.color
      : DEFAULT_COLOR

  const isBlurBackground = activeProject.settings.background.type === 'blur'
  const isColorBackground = activeProject.settings.background.type === 'color'

  const blurPreviews = useMemo(
    () =>
      blurLevels.map((blur) => (
        <BlurPreview
          key={blur.value}
          blur={blur}
          isSelected={isBlurBackground && currentBlurIntensity === blur.value}
          onSelect={() => handleBlurSelect({ blurIntensity: blur.value })}
          t={t}
        />
      )),
    [blurLevels, isBlurBackground, currentBlurIntensity, handleBlurSelect, t],
  )

  const backgroundSections = [
    {
      title: t('properties.colors'),
      backgrounds: colors,
      useBackgroundColor: true,
    },
    { title: t('assets.patternCraft'), backgrounds: patternCraftGradients },
    { title: t('misc.syntaxUI'), backgrounds: syntaxUIGradients },
  ]

  return (
    <div className="flex h-full flex-col">
      <PropertyGroup
        title={t('properties.blur')}
        hasBorderTop={false}
        defaultExpanded={false}
      >
        <div className="flex flex-wrap gap-2">{blurPreviews}</div>
      </PropertyGroup>

      {backgroundSections.map((section) => (
        <PropertyGroup
          key={section.title}
          title={section.title}
          defaultExpanded={false}
        >
          <div className="flex flex-wrap gap-2">
            <BackgroundPreviews
              backgrounds={section.backgrounds}
              currentBackgroundColor={currentBackgroundColor}
              isColorBackground={isColorBackground}
              handleColorSelect={({ bg }) => handleColorSelect({ color: bg })}
              useBackgroundColor={section.useBackgroundColor}
            />
          </div>
        </PropertyGroup>
      ))}
    </div>
  )
}
